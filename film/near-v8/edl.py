"""Noren on NEAR film v8 edit list (Nick's Avalanche order). python3 edl.py -> edl-v8.json"""
import json
D='/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near/deployments/'
W='/Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/film-v8/work/'
ledgers={'v7':D+'near-film-2026-11-13T15-24-18-731Z.json','r1':W+'ledger-run1.json','r6':W+'ledger-run6.json','r7':W+'ledger-run7.json','r9':W+'ledger-run9.json','r10':W+'ledger-run10.json','r11':W+'ledger-run11.json','r12':W+'ledger-run12.json'}
DIR={'v7':'takes-run1','r1':'takes-r1','r6':'takes-r6','r7':'takes-r7','r9':'takes-r9','r10':'takes-r10','r11':'takes-r11','r12':'takes-r12'}
S=[]
def seg(L,take,a,b,*vo,spill=False):
    s={'dir':DIR[L],'ledger':L,'take':take,'in':a,'out':b,'vo':[{'id':i,'at':t} for i,t in vo]}
    if spill: s['vo_spill']=True
    S.append(s)
# 1. Landing: v7's opening, then the sourced comparison
seg('v7','website',0.3,13.6,('website_0',0.5),('website_1',6.3))
seg('r1','landing',9.8,29.0,('vs_0',0.4),('vs_1',10.6))
# 2. Noren Merchant: sign in, store, payout, link, API keys, connect the shop
seg('r1','merchant',0.3,34.6,('merch_0',0.3),('merch_1',8.8),('merch_2',18.5),('merch_3',28.0))
# 3. Noren app: home, test funds, lock test BTC twice, the limit grows
seg('r6','app-home',0.0,8.6,('app_0',0.4))
seg('r6','faucet',0.5,10.6,('faucet_0',0.3),spill=True)
seg('r6','faucet',18.0,23.5)
seg('r6','explorer-faucet',0.0,3.6,('exp_0',0.6))
seg('r10','deposit-1',2.6,13.4,('dep_0',0.6))
seg('r10','deposit-1',21.3,29.4,('dep_1',1.2))
seg('r10','explorer-deposit-1',0.0,4.2)
seg('r10','deposit-2',5.3,13.4)
seg('r10','deposit-2',20.5,28.7,('dep_2',0.8))
seg('r10','explorer-deposit-2',0.0,3.2)
seg('r10','credit-tab',0.0,7.0,('credit_0',1.0))
# 4. Aubelle as a buyer: Pay in 3 (the full tour of the four ways)
seg('r10','buy-in3',0.3,23.3,('in3_0',0.5),('in3_1',19.0))
seg('r10','buy-in3',23.3,37.6,('in3_2',0.8))
seg('r10','buy-in3',43.0,52.0,('in3_3',1.5))
seg('r10','buy-in3',58.7,61.8)
seg('r10','buy-in3',69.0,79.7,('in3_4',2.0))
seg('r10','buy-in3',89.5,99.2,('in3_5',6.5))
seg('r10','explorer-buy-in3',0.0,3.6,('in3_6',0.3))
seg('r10','explorer-draw-1',0.0,3.7)
# Pay later
seg('r11','buy-later',9.2,22.2,('later_0',0.5))
seg('r11','buy-later',23.8,26.2)
seg('r11','buy-later',37.4,45.6,('later_1',1.0))
seg('r11','buy-later',52.6,60.9,('later_2',1.0))
# 5. Privacy, said plainly over the public explorer page
seg('r11','explorer-buy-later',0.0,9.7,('priv_0',0.6))
# Pay with stocks: Tesla is stale (market closed), so test BTC
seg('r12','buy-btc',7.8,16.0)
seg('r12','buy-btc',19.0,21.6)
seg('r12','buy-btc',22.0,36.0,('btc_0',1.0))
seg('r12','buy-btc',43.5,52.0,('btc_1',1.0))
seg('r12','buy-btc',62.3,70.2)
seg('r12','explorer-buy-btc',0.0,4.2)
# Gasless USDC from a shopper with 0 NEAR
seg('r12','buy-gasless',9.0,22.0,('gas_0',0.5))
seg('r12','buy-gasless',25.0,41.5,('gas_n',0.3),('gas_1',10.8))
seg('r12','buy-gasless',48.0,56.0)
seg('r12','explorer-buy-gasless',0.0,8.7,('gas_2',0.5))
# 6. Repay, merchant dashboard, payouts
seg('r12','repay',0.3,12.7,('repay_0',1.0))
seg('r12','repay',19.5,25.0)
seg('r12','explorer-repay',0.0,4.0)
seg('r12','merchant-view',0.3,14.3,('mv_0',3.5))
seg('r12','merchant-view',20.0,28.6,('mv_1',0.4))
seg('r12','landing-end',0.0,6.9,('close_0',2.0))
json.dump({'ledgers':ledgers,'segments':S},open('edl-v8.json','w'),indent=1)
print(len(S),'segments',round(sum(s['out']-s['in'] for s in S),1),'s')
