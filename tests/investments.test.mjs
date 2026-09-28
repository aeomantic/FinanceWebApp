import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

function load(path) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/lib/${path}.ts`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  runInNewContext(source, { exports, process, fetch, AbortSignal, require: createRequire(import.meta.url) });
  return exports;
}
const { calculatePortfolioMetrics } = load('portfolio');
const { createQuoteService } = load('investments/quotes');
const holding = { id: '1', ticker: 'AAPL', name: 'Apple', shares: 10.5, buy_price: 100, currency: 'USD', sector: 'Technology' };

test('eight-decimal holdings survive JSON numeric readback and form editing', () => {
  const { investmentDecimal, investmentSchema } = load('investments/validation');
  assert.equal(investmentDecimal(0.00000001), '0.00000001');
  const parsed = investmentSchema.safeParse({ ticker: ' aapl ', name: 'Apple', shares: investmentDecimal(1e-8), buy_price: investmentDecimal(1e-8), currency: 'USD', sector: 'Technology' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.ticker, 'AAPL');
  assert.equal(parsed.data.shares, 1e-8);
});

test('fractional shares, returns and allocation use market value', () => {
  const result = calculatePortfolioMetrics([{ ...holding, current_price: 120 }, { ...holding, id: '2', ticker: 'VOO', sector: 'Index Fund / ETF', shares: 2, buy_price: 200, current_price: 150 }]);
  assert.equal(result.totalInvested, 1450);
  assert.equal(result.totalCurrentValue, 1560);
  assert.equal(result.totalGain, 110);
  assert.equal(result.enrichedPositions[0].unrealizedGain, 210);
  assert.equal(result.enrichedPositions[1].unrealizedGain, -100);
  assert.ok(Math.abs(result.sectorAllocation.reduce((s, a) => s + a.percentage, 0) - 100) < 1e-10);
});

test('empty, zero-cost and unavailable-price portfolios remain finite', () => {
  const empty = calculatePortfolioMetrics([]);
  assert.equal(empty.totalCurrentValue, 0);
  assert.equal(empty.totalGainPercent, 0);
  for (const current_price of [undefined, NaN, Infinity, -1, 0]) {
    const result = calculatePortfolioMetrics([{ ...holding, current_price }]);
    assert.equal(result.totalCurrentValue, 1050);
    assert.equal(result.totalGain, 0);
    assert.equal(result.unavailableCount, 1);
  }
  assert.equal(calculatePortfolioMetrics([{ ...holding, buy_price: 0, current_price: 100 }]).totalGainPercent, 0);
  assert.throws(() => calculatePortfolioMetrics([holding, { ...holding, currency: 'SGD' }]), /currency/);
});

test('allocation safely supports prototype-like sector names and rejects invalid amounts', () => {
  assert.equal(calculatePortfolioMetrics([{ ...holding, sector: '__proto__' }]).sectorAllocation[0].value, 1050);
  assert.throws(() => calculatePortfolioMetrics([{ ...holding, shares: -2 }]), /Invalid/);
});

function fixture(respond = () => Response.json({ c: 120, dp: 1.4, t: 1700000000 })) {
  let time = 1700000010000;
  const calls = [];
  const service = createQuoteService({ apiKey: () => 'test-key', now: () => time, fetcher: async (url, options) => { calls.push({ url, options }); return respond(); } });
  return { ...service, calls, advance: n => { time += n; } };
}

test('quotes deduplicate concurrent requests and cache for 60 seconds', async () => {
  const f = fixture();
  const [a, b] = await Promise.all([f.getQuote('aapl'), f.getQuote(' AAPL ')]);
  assert.equal(a.price, 120); assert.equal(b.price, 120);
  assert.equal(f.calls.length, 1);
  await f.getQuote('AAPL'); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].options.cache, 'force-cache');
  assert.equal(f.calls[0].options.next.revalidate, 60);
  assert.equal(f.calls[0].url.includes('test-key'), false);
  f.advance(60001); await f.getQuote('AAPL'); assert.equal(f.calls.length, 2);
});

test('invalid tickers and malformed provider data are unavailable and negatively cached', async () => {
  const f = fixture(() => Response.json({ c: 0, t: 0 }));
  assert.equal((await f.getQuote('ZZZZZ')).status, 'unavailable');
  await f.getQuote('ZZZZZ'); assert.equal(f.calls.length, 1);
  assert.equal((await f.getQuote('../secret')).status, 'unavailable');
  assert.equal(f.calls.length, 1);
  const malformed = fixture(() => Response.json({ c: '120', t: 1700000000 }));
  assert.equal((await malformed.getQuote('AAPL')).price, null);
});

test('429 cooldown blocks additional provider calls without throwing', async () => {
  const f = fixture(() => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
  assert.equal((await f.getQuote('AAPL')).status, 'rate_limited');
  assert.equal((await f.getQuote('NVDA')).status, 'rate_limited');
  assert.equal(f.calls.length, 1);
  f.advance(61000);
  await f.getQuote('AAPL'); assert.equal(f.calls.length, 1);
  f.advance(61000);
  await f.getQuote('AAPL'); assert.equal(f.calls.length, 2);
});

test('timeouts, provider failures and missing configuration degrade to cost-basis fallback', async () => {
  for (const response of [() => { throw new Error('timeout'); }, () => new Response('', { status: 500 }), () => new Response('bad JSON')]) {
    assert.equal((await fixture(response).getQuote('AAPL')).status, 'unavailable');
  }
  const service = createQuoteService({ apiKey: () => undefined, fetcher: () => { throw new Error('must not fetch'); } });
  assert.equal((await service.getQuote('AAPL')).status, 'not_configured');
});

test('per-instance burst and minute budgets bound provider calls', async () => {
  const f = fixture();
  const symbols = Array.from({ length: 26 }, (_, i) => `A${String.fromCharCode(65 + i)}`);
  await Promise.all(symbols.map(f.getQuote));
  assert.equal(f.calls.length, 25);
  f.advance(1001);
  await Promise.all(symbols.map(s => f.getQuote(`B${s}`)));
  assert.equal(f.calls.length, 50);
  f.advance(1001);
  assert.equal((await f.getQuote('MSFT')).status, 'rate_limited');
  assert.equal(f.calls.length, 50);
});
