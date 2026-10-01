import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryKey, suggestMerchants, matchMerchants, merchantNameSchema } from '../.tmp/tests/lib/merchants/model.js';
import { transactionInputSchema, updateTransactionInputSchema } from '../.tmp/tests/lib/dashboard/validation.js';
const category='10000000-0000-4000-8000-000000000001';
const merchantId='20000000-0000-4000-8000-000000000001';
const presets=[
 {id:merchantId,name:'NTUC FairPrice',user_id:null,category_id:null,category_key:'groceries'},
 {id:'food',name:'Starbucks',user_id:null,category_id:null,category_key:'food'},
 {id:'custom',name:'Kallang Minimart',user_id:'owner',category_id:category,category_key:null},
];
test('category aliases suggest system presets plus exact personal category matches',()=>{
 assert.equal(categoryKey('Food & Groceries'),'groceries');
 assert.equal(categoryKey('Dining Out'),'food'); assert.equal(categoryKey('Transport'),'transport');
 assert.equal(categoryKey('Shopping & Electronics'),'shopping'); assert.equal(categoryKey('Bills'),null);
 assert.deepEqual(suggestMerchants(presets,category,'Groceries').map(m=>m.name),['NTUC FairPrice','Kallang Minimart']);
 assert.deepEqual(suggestMerchants(presets,null,'Groceries'),[]);
});
test('merchant search spans all categories, ignores casing and treats symbols literally',()=>{
 assert.equal(matchMerchants(presets,'  FAIRPRICE ')[0].id,merchantId);
 assert.equal(matchMerchants(presets,'star')[0].name,'Starbucks');
 assert.equal(matchMerchants(presets,'%').length,0);
});
test('custom names allow apostrophes and Unicode while rejecting empty, long and control text',()=>{
 assert.equal(merchantNameSchema.parse("  McDonald's  "),"McDonald's");
 assert.equal(merchantNameSchema.safeParse('咖啡店').success,true);
 for(const name of ['', ' ', 'a'.repeat(81),'shop\nname']) assert.equal(merchantNameSchema.safeParse(name).success,false);
});
test('record and edit payloads preserve merchant UUIDs; transfers and invalid IDs are rejected',()=>{
 const input={walletId:category,categoryId:category,merchantId,amount:'12.50',date:'2026-10-02',type:'expense'};
 assert.equal(transactionInputSchema.parse(input).merchantId,merchantId);
 assert.equal(updateTransactionInputSchema.parse({...input,id:category}).merchantId,merchantId);
 assert.equal(transactionInputSchema.safeParse({...input,merchantId:'bad'}).success,false);
 assert.equal(transactionInputSchema.safeParse({...input,type:'transfer',destinationWalletId:merchantId}).success,false);
 assert.equal(updateTransactionInputSchema.parse({...input,id:category,merchantId:undefined}).merchantId,undefined);
});
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as validation from '../.tmp/tests/lib/dashboard/validation.js';
const actionSource=ts.transpileModule(readFileSync(new URL('../src/app/dashboard/actions.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.CommonJS}}).outputText;
function actionFixture(){
 const writes=[];
 const client={auth:{getUser:async()=>({data:{user:{id:category,email:'owner@example.test'}},error:null})},from(table){
  if(table==='wallets'){const query={select:()=>query,eq:()=>query,single:async()=>({data:{id:category,currency:'SGD'},error:null})};return query;}
  assert.equal(table,'transactions');
  return {insert:async row=>{writes.push(row);return{error:null}},update:row=>{writes.push(row);const query={eq:()=>query,then:resolve=>Promise.resolve({error:null,count:1}).then(resolve)};return query;}};
 }};
 const loadedModule={exports:{}};
 const modules={'next/cache':{revalidatePath:()=>{}},'@/lib/auth/allowlist':{isAllowedEmail:()=>true},'@/lib/supabase/server':{createClient:async()=>client},'@/lib/dashboard/validation':validation};
 runInNewContext(actionSource,{exports:loadedModule.exports,module:loadedModule,console,require:name=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name]}});
 return {actions:loadedModule.exports,writes};
}
test('real record/edit actions persist merchant_id and explicitly clear removed merchants',async()=>{
 const {actions,writes}=actionFixture();
 const input={walletId:category,merchantId,amount:'12.50',date:'2026-01-01',type:'expense'};
 assert.equal((await actions.recordTransaction(input)).success,true);assert.equal(writes[0].merchant_id,merchantId);
 assert.equal((await actions.updateTransaction({...input,id:category})).success,true);assert.equal(writes[1].merchant_id,merchantId);
 assert.equal((await actions.updateTransaction({...input,id:category,merchantId:undefined})).success,true);assert.equal(writes[2].merchant_id,null);
 assert.equal(writes[0].amount_minor,1250);
});
