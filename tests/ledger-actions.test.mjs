import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the real component handlers with a tiny hook/JSX host. No network
// or database writes are made by these UI tests.
function ledgerFixture() {
  const state = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const source = ts.transpileModule(readFileSync(new URL('../src/components/dashboard/transactions-view.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules = {
    react: { useId: () => 'test', useMemo: fn => fn(), useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    '@/lib/dashboard/summary': { formatMoney: amount => String(amount) },
    './transaction-list': { dateHeading: value => value, MerchantAvatar: 'MerchantAvatar' },
    './delete-transactions-dialog': { DeleteTransactionsDialog: 'DeleteTransactionsDialog' },
  };
  const exports = {};
  runInNewContext(source, { exports, require: name => modules[name] ?? new Proxy({}, { get: (_, key) => key === 'default' ? {} : key }) });
  const transaction = { id: 'entry', title: 'Test expense', type: 'expense', date: '2026-09-28', amountMinor: 100, walletId: 'wallet', currency: 'SGD' };
  const props = { wallets: [], transactions: [transaction], today: '2026-09-28', periodStart: '2026-01-01', name: 'Test' };
  return { render: () => { cursor = 0; return exports.TransactionsView(props); }, props };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function button(tree, text) { return nodes(tree).find(node => node.type === 'button' && node.props.children === text); }

test('deleting the final selected transaction exits selection and closes confirmation', () => {
  const f = ledgerFixture();
  button(f.render(), 'Select').props.onClick();
  const row = nodes(f.render()).find(node => node.props?.role === 'checkbox');
  assert.equal(row.props['aria-checked'], false);
  row.props.onClick();
  assert.equal(nodes(f.render()).find(node => node.props?.role === 'checkbox').props['aria-checked'], true);
  const deleteButton = nodes(f.render()).find(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Delete ('));
  deleteButton.props.onClick();
  const dialog = nodes(f.render()).find(node => node.type === 'DeleteTransactionsDialog');
  assert.equal(dialog.props.ids.length, 1);
  f.props.transactions = [];
  dialog.props.onDeleted();
  const tree = f.render();
  assert.ok(button(tree, 'Select'));
  assert.equal(nodes(tree).some(node => node.type === 'DeleteTransactionsDialog'), false);
  assert.equal(nodes(tree).some(node => node.props?.role === 'checkbox'), false);
});

test('cancel preserves selected rows; Done clears selection', () => {
  const f = ledgerFixture();
  button(f.render(), 'Select').props.onClick();
  nodes(f.render()).find(node => node.props?.role === 'checkbox').props.onClick();
  nodes(f.render()).find(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Delete (')).props.onClick();
  nodes(f.render()).find(node => node.type === 'DeleteTransactionsDialog').props.onClose();
  assert.equal(nodes(f.render()).find(node => node.props?.role === 'checkbox').props['aria-checked'], true);
  button(f.render(), 'Done').props.onClick();
  button(f.render(), 'Select').props.onClick();
  assert.equal(nodes(f.render()).find(node => node.props?.role === 'checkbox').props['aria-checked'], false);
});

test('Select all selects only filtered ledger entries', () => {
  const f = ledgerFixture();
  f.props.transactions.push({ ...f.props.transactions[0], id: 'outside-month', date: '2026-08-01' });
  button(f.render(), 'Select').props.onClick();
  nodes(f.render()).find(node => node.props?.role === 'checkbox').props.onClick();
  button(f.render(), 'Select all').props.onClick();
  nodes(f.render()).find(node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Delete (')).props.onClick();
  const ids = nodes(f.render()).find(node => node.type === 'DeleteTransactionsDialog').props.ids;
  assert.equal(ids.length, 1);
  assert.equal(ids[0], 'entry');
});

function deletionFixture({ user = { id: 'owner', email: 'test@example.com' }, error = null } = {}) {
  const calls = [], refreshed = [];
  const source = ts.transpileModule(readFileSync(new URL('../src/app/dashboard/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const query = {};
  for (const method of ['delete', 'eq', 'in']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.then = resolve => Promise.resolve({ error }).then(resolve);
  const modules = {
    'next/cache': { revalidatePath: path => refreshed.push(path) },
    '@/lib/auth/allowlist': { isAllowedEmail: () => true },
    '@/lib/dashboard/validation': { uuidSchema: { safeParse: id => ({ success: typeof id === 'string' && id.startsWith('id-') }) } },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: null }) },
      from: table => { calls.push(['from', table]); return query; },
      rpc: async (...args) => { calls.push(['rpc', ...args]); return { error }; },
    }) },
  };
  const exports = {};
  runInNewContext(source, { exports, console: { error() {} }, require: name => modules[name] });
  return { run: exports.deleteTransactions, calls, refreshed };
}

test('single and small batch deletion constrain ownership and refresh dependent views', async () => {
  for (const ids of [['id-1'], ['id-1', 'id-2', 'id-1']]) {
    const f = deletionFixture();
    assert.equal((await f.run(ids)).success, true);
    assert.ok(f.calls.some(([method, field, value]) => method === 'eq' && field === 'user_id' && value === 'owner'));
    assert.ok(f.calls.some(([method, field]) => method === (ids.length === 1 ? 'eq' : 'in') && field === 'id'));
    for (const path of ['/transactions', '/wallets', '/dashboard', '/commitments']) assert.ok(f.refreshed.includes(path));
  }
});

test('large deletion sends IDs as an RPC body', async () => {
  const f = deletionFixture();
  assert.equal((await f.run(Array.from({ length: 150 }, (_, i) => `id-${i}`))).success, true);
  const call = f.calls.find(([method]) => method === 'rpc');
  assert.equal(call[1], 'delete_transactions');
  assert.equal(call[2].p_ids.length, 150);
  assert.equal(f.calls.some(([method]) => method === 'in'), false);
});

test('invalid selections, expired sessions and database errors never report deletion success', async () => {
  const invalid = deletionFixture();
  assert.equal((await invalid.run([])).success, false);
  assert.equal((await invalid.run(['bad'])).success, false);
  assert.equal(invalid.calls.length, 0);
  const expired = deletionFixture({ user: null });
  assert.equal((await expired.run(['id-1'])).success, false);
  assert.equal(expired.calls.length, 0);
  const failed = deletionFixture({ error: { code: '42501', message: 'denied' } });
  assert.equal((await failed.run(['id-1'])).success, false);
  assert.equal(failed.refreshed.length, 0);
});
