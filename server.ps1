$port = 3000
$root = $PSScriptRoot
$csp = "default-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://code.jquery.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com https://placehold.co data:;"
$code = @"
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve('$root'.replace(/\\\\/g,'/'));
const M={js:'text/javascript',css:'text/css',html:'text/html',png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml',ico:'image/x-icon',json:'application/json'};
const csp='$csp';
const orders=[];
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url=req.url.split('?')[0];
  if(url==='/api/orders'&&req.method==='POST'){
    let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{const d=JSON.parse(b);d.id=d.id||'ECO-'+Date.now();d.receivedAt=new Date().toISOString();orders.push(d);res.writeHead(201,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true,id:d.id}))}catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Invalid JSON'}))}});
    return
  }
  if(url==='/api/orders'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(orders));return}
  if(url==='/api/orders'&&req.method==='DELETE'){orders.length=0;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({success:true}));return}
  let r=req.url==='/'?'index.html':url;
  let f=path.resolve(path.join(root,r));
  if(!f.startsWith(root)){res.writeHead(403);res.end('Forbidden');return}
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('Not found')}else{res.writeHead(200,{'Content-Type':M[path.extname(f).slice(1)]||'text/plain','Access-Control-Allow-Origin':'*','Content-Security-Policy':csp});res.end(d)}})
}).listen($port,()=>console.log('Server running on http://localhost:'+$port));
"@
node -e $code
