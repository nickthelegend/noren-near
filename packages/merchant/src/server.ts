/** Standalone API for an approved host; wallet keys never belong on this service. */
import {createServer} from 'node:http';
import {createMerchantService} from './service';
const port=Number(process.env.PORT??5395);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Set a valid PORT.');
const api=createMerchantService();
const server=createServer(async(req,res)=>{if(!await api.middleware(req,res)){res.statusCode=404;res.end('NEAR merchant API: use /api/');}});
server.listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`NEAR testnet merchant API listening on port ${port}.`));
for(const signal of ['SIGTERM','SIGINT'] as const)process.on(signal,()=>server.close(()=>process.exit(0)));
