import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const source = ts.transpileModule(readFileSync(new URL('../src/app/dashboard/actions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
}).outputText;
const dbError = { code: '42P01', message: 'relation "wallets" does not exist', details: 'trigger context', hint: 'check search path' };
function fixture({ defaultWallet = false, user = { id: 'owner', email: 'owner@example.com' }, allowed = true, override = {}, throwAt } = {}) {
  const calls = [], logs = [], refreshed = [], queries = [];
  const responses = [
    { data: { id, is_default: defaultWallet }, error: null },
    { data: { id: other }, error: null },
    { error: null },
    { count: 0, error: null },
    { error: null },
    { count: 1, error: null },
    { data: { id }, error: null },
  ];
  const client = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    schema(name) { assert.equal(name, 'public'); return this; },
    from(table) {
      const query = { table, filters: [], operation: 'select' }; queries.push(query);
      const builder = {};
      for (const name of ['select', 'delete', 'update', 'eq', 'neq', 'or', 'order', 'limit', 'maybeSingle']) {
        builder[name] = (...args) => {
          if (name === 'delete' || name === 'update') query.operation = name;
          query.filters.push([name, ...args]);
          return builder;
        };
      }
      builder.then = (resolve, reject) => {
        const index = queries.indexOf(query);
        return (index === throwAt ? Promise.reject(new Error('Network unavailable')) : Promise.resolve(override[index] ?? responses[index])).then(resolve, reject);
      };
      return builder;
    },
    async rpc(name, args) {
      assert.equal(name, 'set_default_wallet', 'must never call either deletion RPC');
      calls.push({ name, args });
      return { error: override.rpcError ?? null };
    },
  };
  const modules = {
    'next/cache': { revalidatePath: path => refreshed.push(path) },
    '@/lib/auth/allowlist': { isAllowedEmail: () => allowed },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/dashboard/validation': { uuidSchema: { safeParse: value => ({ success: value === id }) } },
  };
  const loadedModule = { exports: {} };
  runInNewContext(source, { exports: loadedModule.exports, module: loadedModule, console: { error: (...args) => logs.push(args) }, require: name => {
    assert.ok(Object.hasOwn(modules, name), name); return modules[name];
  } });
  return { run: value => loadedModule.exports.deleteWallet(value ?? id), queries, logs, refreshed, calls };
}
test('wallet deletion uses public tables, owned filters and complete transfer cleanup', async () => {
  const f = fixture(); assert.equal((await f.run()).success, true);
  assert.deepEqual(f.queries.map(q => [q.table, q.operation]), [['wallets','select'],['wallets','select'],['transactions','delete'],['transactions','select'],['recurring_rules','update'],['wallets','select'],['wallets','delete']]);
  for (const q of f.queries) assert.ok(q.filters.some(([name, field, value]) => name === 'eq' && field === 'user_id' && value === 'owner'));
  assert.ok(f.queries[2].filters.some(([name, value]) => name === 'or' && value === `wallet_id.eq.${id},destination_wallet_id.eq.${id}`));
  assert.ok(f.queries[4].filters.some(([name, value]) => name === 'update' && value.wallet_id === null));
  assert.equal(f.calls.length, 0);
  assert.ok(f.refreshed.includes('/wallets'));
});
test('default deletion promotes the oldest remaining wallet before cleanup', async () => {
  const f = fixture({ defaultWallet: true }); assert.equal((await f.run()).success, true);
  assert.equal(f.calls[0].args.p_wallet_id, other);
  assert.deepEqual(f.queries[1].filters.filter(([n]) => n === 'order').map(([,v]) => v), ['created_at','id']);
});
test('invalid ID, expired session, disallowed account, missing wallet and sole wallet never mutate', async () => {
  for (const options of [{user:null}, {allowed:false}, {override:{0:{data:null,error:null}}}, {override:{1:{data:null,error:null}}}]) {
    const f = fixture(options); assert.equal((await f.run()).success, false);
    assert.ok(f.queries.every(q => q.operation === 'select')); assert.equal(f.calls.length, 0);
  }
  const f=fixture(); assert.equal((await f.run('not-a-uuid')).success,false); assert.equal(f.queries.length,0);
});
test('database exceptions stay in server logs, never in the modal result', async () => {
  for (const index of [0,1,2,3,4,5,6]) {
    const f = fixture({override:{[index]:{error:dbError}}}); const result=await f.run();
    assert.equal(result.success,false); assert.doesNotMatch(JSON.stringify(result),/42P01|relation|wallets|trigger context/);
    assert.equal(f.logs[0][1].details,dbError.details); assert.equal(f.logs[0][1].hint,dbError.hint);
    assert.equal(f.queries.length,index+1);
  }
});
test('RLS-filtered cleanup, unknown counts and filtered wallet deletion cannot report success', async () => {
  for (const [index,response] of [[3,{count:1,error:null}],[3,{count:null,error:null}],[5,{count:0,error:null}],[6,{data:null,error:null}]]) {
    const f=fixture({override:{[index]:response}}); assert.equal((await f.run()).success,false); assert.equal(f.queries.length,index+1);
  }
});
test('default promotion failure stops before any ledger mutations', async () => {
  const f=fixture({defaultWallet:true,override:{rpcError:dbError}}); assert.equal((await f.run()).success,false);
  assert.equal(f.queries.length,2); assert.equal(f.logs[0][1].code,'42P01');
});
test('partial/network failures refresh affected views and report unfinished cleanup', async () => {
  const f=fixture({throwAt:4}); const result=await f.run(); assert.equal(result.success,false);
  assert.match(result.error,/Some changes may already be saved/); assert.ok(f.refreshed.includes('/transactions'));
});
