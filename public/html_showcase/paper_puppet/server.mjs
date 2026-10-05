// Local preview only. No dependencies; listens on this computer, never the LAN.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(requested==='/'?'/index.html':requested));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const stat=fs.statSync(file);if(!stat.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':stat.size,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${server.address().port}/`;console.log(`Paper Puppet: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
 const command=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
 const child=spawn(command[0],command[1],{stdio:'ignore'});child.on('error',()=>{});child.unref();
});
