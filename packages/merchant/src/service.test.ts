import { describe,it,expect } from 'vitest';
import { createMerchantService,USDC,DEMO_SHOP } from './service';
const invoice=async(s:ReturnType<typeof createMerchantService>,token:string,merchant:string)=>s.handle(`/merchants/${merchant}/invoices`,'POST',{amount:'1000000',description:'Test order'},token,'localhost:5395');
const signedTx=(id:string,payout:string)=>({final_execution_status:'FINAL',status:{SuccessValue:''},transaction:{signer_id:'alice.testnet',receiver_id:USDC,actions:[{FunctionCall:{method_name:'ft_transfer',args:Buffer.from(JSON.stringify({receiver_id:payout,amount:'1000000',memo:`noren:${id}`})).toString('base64')}}]},receipts_outcome:[]});
describe('NEAR merchant service trust boundaries',()=>{
 it('rejects unsigned sessions, unsupported privacy routes and missing invoices',async()=>{
  const s=createMerchantService({file:null});
  await expect(s.handle('/stores','GET',{},'','localhost:5395')).rejects.toThrow('Session required');
  await expect(s.handle('/invoices/missing','GET',{},'','localhost:5395')).rejects.toThrow('not found');
  const c=await s.handle('/config','GET',{},'','localhost:5395');expect(c.privacy).toBe(false);expect(c.network).toBe('testnet');
 });
 it('consumes nonces once and rejects non-testnet sign-in',async()=>{
  const s=createMerchantService({file:null,verify:async()=>{throw Error('forged')}});
  const c=await s.handle('/auth/nonce','GET',{},'','localhost:5395');
  await expect(s.handle('/auth/near','POST',{challengeId:c.challengeId,accountId:'bad.near'},'','localhost:5395')).rejects.toThrow('not testnet');
  await expect(s.handle('/auth/near','POST',{challengeId:c.challengeId,accountId:'alice.testnet'},'','localhost:5395')).rejects.toThrow('expired');
 });
});

import { Account,KeyPair,KeyPairSigner,JsonRpcProvider } from 'near-api-js';
import { signMessage,verifyMessage } from 'near-api-js/nep413';
async function authenticated(tx?:any, view?:any) {
 const signer=new Account('alice.testnet',new JsonRpcProvider({url:'https://test.rpc.fastnear.com'}),new KeyPairSigner(KeyPair.fromRandom('ed25519')));
 const s=createMerchantService({file:null,view,account:async()=>({}),tx:async()=>tx.value,verify:async(args)=>verifyMessage({...args,provider:{viewAccessKey:async()=>({permission:'FullAccess'})} as any})});
 const c=await s.handle('/auth/nonce','GET',{},'','localhost:5395');
 const sig=await signMessage({signerAccount:signer,payload:{message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64')}});
 const auth=await s.handle('/auth/near','POST',{challengeId:c.challengeId,accountId:sig.accountId,publicKey:sig.publicKey.toString(),signature:Buffer.from(sig.signature).toString('base64')},'','localhost:5395');
 const r=await s.handle('/stores','POST',{name:'Aubelle',payout:'shop.testnet'},auth.session,'localhost:5395');
 return{s,auth,r};
}
it('verifies a real NEP-413 signature, scopes API keys and exposes no key hash',async()=>{
 const{s,auth,r}=await authenticated();
 expect(r.store.keys[0].hash).toBeUndefined();expect(r.secretKey.startsWith('sk_test_')).toBe(true);
 const i=await invoice(s,r.secretKey,r.store.merchant);expect(i.status).toBe('open');
 await expect(s.handle(`/merchants/${r.store.merchant}/invoices`,'POST',{amount:'1'},'bad','localhost:5395')).rejects.toThrow('Session required');
 await s.handle(`/stores/${r.store.id}/keys/${r.store.keys[0].id}`,'DELETE',{},auth.session,'localhost:5395');
 await expect(invoice(s,r.secretKey,r.store.merchant)).rejects.toThrow('Session required');
});
it('claims only the invoice-bound final transfer, once, and rejects wrong recipient or binding',async()=>{
 const tx={value:null as any};const{s,r}=await authenticated(tx);
 const a=await invoice(s,r.secretKey,r.store.merchant),b=await invoice(s,r.secretKey,r.store.merchant);
 tx.value=signedTx(a.invoice.invoiceId,'wrong.testnet');
 await expect(s.handle(`/invoices/${a.invoice.invoiceId}/complete`,'POST',{hash:'1'.repeat(44),accountId:'alice.testnet'},'','localhost:5395')).rejects.toThrow('recipient');
 tx.value=signedTx(a.invoice.invoiceId,'shop.testnet');
 await expect(s.handle(`/invoices/${b.invoice.invoiceId}/complete`,'POST',{hash:'1'.repeat(44),accountId:'alice.testnet'},'','localhost:5395')).rejects.toThrow('binding');
 const done=await s.handle(`/invoices/${a.invoice.invoiceId}/complete`,'POST',{hash:'1'.repeat(44),accountId:'alice.testnet'},'','localhost:5395');expect(done.status).toBe('paid');expect(done.paidAmount).toBe('1000000');
 await s.handle(`/invoices/${a.invoice.invoiceId}/complete`,'POST',{hash:'1'.repeat(44),accountId:'alice.testnet'},'','localhost:5395');expect(done.payments).toHaveLength(1);
 await expect(s.handle(`/invoices/${b.invoice.invoiceId}/complete`,'POST',{hash:'1'.repeat(44),accountId:'alice.testnet'},'','localhost:5395')).rejects.toThrow('another payment');
});
it('does not mark pending or failed transfers paid',async()=>{
 const tx={value:null as any};const{s,r}=await authenticated(tx);const i=await invoice(s,r.secretKey,r.store.merchant);
 tx.value={...signedTx(i.invoice.invoiceId,'shop.testnet'),final_execution_status:'INCLUDED'};
 await expect(s.handle(`/invoices/${i.invoice.invoiceId}/complete`,'POST',{hash:'2'.repeat(44),accountId:'alice.testnet'},'','localhost:5395')).rejects.toThrow('FINAL');
 expect((await s.handle(`/invoices/${i.invoice.invoiceId}`,'GET',{},'','localhost:5395')).status).toBe('open');
});

it('reprices Aubelle orders from the server catalogue and binds the return receipt',async()=>{
 const {s,auth,r}=await authenticated();
 await expect(s.handle('/shop/connect','POST',{merchant:r.store.merchant},'','localhost:5395')).rejects.toThrow('Session required');
 await s.handle('/shop/connect','POST',{merchant:r.store.merchant},auth.session,'localhost:5395');
 await expect(s.handle('/shop/checkout','POST',{lines:[{slug:'missing',size:'S',qty:1}]},'','localhost:5395')).rejects.toThrow('product');
 const order=await s.handle('/shop/checkout','POST',{lines:[{slug:'amelie-gingham',size:'S',qty:1,price:1}],totalCents:1},'','localhost:5395');
 const row=await s.handle('/shop/orders/'+order.orderId,'GET',{},'','localhost:5395');
 expect(row.totalCents).toBe(14800);expect(row.status).toBe('awaiting_payment');
 const id=order.checkoutUrl.split('/pay/')[1],i=await s.handle('/invoices/'+id,'GET',{},'','localhost:5395');
 expect(i.invoice.amount).toBe('148000000');expect(i.invoice.merchant).toBe(r.store.merchant);expect(i.successUrl).toContain('/shop/#/order/');
});
it('keeps a scheduled invoice unpaid and verifies each partial draw separately',async()=>{
 const tx={value:null as any};const {s,r}=await authenticated(tx,async()=>['alice.testnet','shop.testnet','333333',0,true]);
 const i=await invoice(s,r.secretKey,r.store.merchant),id=i.invoice.invoiceId;
 const call=(method:string,args:any,result:any)=>({final_execution_status:'FINAL',status:{SuccessValue:Buffer.from(JSON.stringify(result)).toString('base64')},transaction:{signer_id:'alice.testnet',receiver_id:'credit.noren-near-mw9h22el.testnet',actions:[{FunctionCall:{method_name:method,args:Buffer.from(JSON.stringify(args)).toString('base64')}}]},receipts_outcome:[]});
 tx.value=call('schedule_pay_in_3',{recipient:'shop.testnet',total:'1000000',invoice_id:id},[1,2,3]);
 const scheduled=await s.handle('/invoices/'+id+'/schedule','POST',{accountId:'alice.testnet',hash:'3'.repeat(44)},'','localhost:5395');
 expect(scheduled.paidAmount).toBe('0');expect(scheduled.status).toBe('open');
 tx.value=call('pay_installment',{id:1,invoice_id:id},true);
 const paid=await s.handle('/invoices/'+id+'/complete','POST',{accountId:'alice.testnet',hash:'4'.repeat(44)},'','localhost:5395');
 expect(paid.status).toBe('partially_paid');expect(paid.paidAmount).toBe('333333');
 tx.value=call('pay_installment',{id:2,invoice_id:id},false);
 await expect(s.handle('/invoices/'+id+'/complete','POST',{accountId:'alice.testnet',hash:'5'.repeat(44)},'','localhost:5395')).rejects.toThrow('not completed');
});
