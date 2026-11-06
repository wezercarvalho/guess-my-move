import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
process.env.MAX_CONNECTIONS='1';process.env.MAX_CONNECTIONS_PER_IP='1';process.env.OBSERVE_ENABLED='false';
const base=fileURLToPath(new URL('../../../../',import.meta.url))
const require=createRequire(base+'package.json')
const WebSocket=require('ws')
const {createServerApp}=await import(base+'apps/server/dist/app.setup.js')
const {RealtimePolicy}=await import(base+'apps/server/dist/realtime/realtime-policy.service.js')
const app=await createServerApp({logger:false,abortOnError:false});await app.listen(0,'127.0.0.1')
const sockets=[]
try {
 for(let i=0;i<8;i++){
  const ws=new WebSocket(`ws://127.0.0.1:${app.getHttpServer().address().port}/socket.io/?EIO=4&transport=websocket`,{headers:{Origin:'http://localhost:5173'}})
  sockets.push(ws)
  await new Promise((resolve,reject)=>{ws.once('message',resolve);ws.once('error',reject)})
 }
 const report={commit:'889d7650582c5562ff9807c612748e15c15ab47e',configuredMaxConnections:1,configuredMaxConnectionsPerIp:1,rawEngineConnections:sockets.filter(s=>s.readyState===1).length,admissionActiveConnections:app.get(RealtimePolicy).activeConnections,scope:'8 loopback handshakes only; no namespace CONNECT, no load or external target'}
 console.log(JSON.stringify(report,null,2))
}finally{for(const ws of sockets)ws.close();await app.close()}
