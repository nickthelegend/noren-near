import {createRequire} from 'node:module';import {join} from 'node:path';
import {withChromeLock} from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
const require=createRequire('/Volumes/Extreme SSD/Projects/grokbot/projects/noren-near/package.json'),{chromium}=require('playwright-core');
const H=decodeURIComponent(new URL('.',import.meta.url).pathname);
await withChromeLock(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{const p=await (await b.newContext({viewport:{width:1920,height:1080}})).newPage();
for(const n of process.argv.slice(2)){await p.goto('file://'+join(H,n+'.html'));await p.waitForTimeout(800);await p.screenshot({path:join(H,n+'.png')});console.log(n)}}finally{await b.close()}});
