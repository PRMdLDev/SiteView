'use strict';

const $=id=>document.getElementById(id);
const folderInput=$('folderInput'), fileInput=$('fileInput'), drop=$('drop'), area=$('area'), progress=$('progress'), installBtn=$('installBtn');
let files=new Map(), projectName='Meu projeto', entryPage='', root='', busy=false, generation=0, deferredInstallPrompt=null;
let sourceDirectoryHandle=null, sourceType='memory';
let previewObjectUrls=[];

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const frame=()=>new Promise(r=>requestAnimationFrame(r));

function toast(t){const el=$('toast');el.textContent=t;el.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>el.style.display='none',3000)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clean(p){const a=String(p||'').replace(/\\/g,'/').split('/'),o=[];for(const x of a){if(!x||x==='.'){continue}if(x==='..'){o.pop();continue}o.push(x)}return o.join('/')}
function strip(v){return String(v||'').split(/[?#]/,1)[0]}
function external(v){return /^(?:https?:|data:|blob:|\/\/|#|mailto:|tel:|javascript:|about:|file:)/i.test(String(v||'').trim())}
function baseOf(p){const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i+1)}
function ext(p){return String(p||'').split('.').pop().toLowerCase()}
function mime(file,path){if(file?.type)return file.type;return ({css:'text/css',js:'text/javascript',mjs:'text/javascript',json:'application/json',html:'text/html',htm:'text/html',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',avif:'image/avif',ico:'image/x-icon',bmp:'image/bmp',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',eot:'application/vnd.ms-fontobject',wasm:'application/wasm'})[ext(path)]||'application/octet-stream'}
function fileFor(path){path=clean(path);if(files.has(path))return files.get(path);if(root&&path.startsWith(root)&&files.has(path.slice(root.length)))return files.get(path.slice(root.length));const l=path.toLowerCase();for(const [k,f] of files)if(k.toLowerCase()===l)return f;return null}
function pathFor(file){for(const [p,f] of files)if(f===file)return p;return file?.name||''}
function resolve(base,ref){if(!ref||external(ref))return null;try{return clean(new URL(strip(ref),'https://siteview.local/'+clean(base)).pathname)}catch{return null}}
function setProgress(pct,status,file){progress.classList.add('show');$('progressStatus').textContent=status;$('progressPct').textContent=pct+'%';$('progressFill').style.width=pct+'%';$('progressFile').textContent=file||''}
function hideProgress(){progress.classList.remove('show');$('progressFill').style.width='0%'}
async function processProgress(list,label='Processando',id=generation){
  const stages=[[8,'Lendo arquivos...'],[22,'Organizando arquivos...'],[42,'Preparando estrutura...'],[62,'Preparando recursos...'],[80,'Verificando projeto...'],[94,'Finalizando...'],[100,'Concluído']];
  const perStage=Math.max(420,Math.min(850,5000/Math.max(1,stages.length-1)));
  for(const [pct,status] of stages){
    if(id!==generation)throw new Error('cancelado');
    const idx=Math.min(Math.max(0,list.length-1),Math.floor((pct/100)*Math.max(0,list.length-1)));
    const f=pct===100?'Todos os arquivos foram processados.':(list[idx]?.webkitRelativePath||list[idx]?.name||'Processando...');
    setProgress(pct,status,f);
    await sleep(pct===100?320:perStage);
    await frame();
  }
}

async function collectDirectory(handle,out,prefix=''){for await(const e of handle.values()){const p=prefix?prefix+'/'+e.name:e.name;if(e.kind==='file'){const f=await e.getFile();try{Object.defineProperty(f,'webkitRelativePath',{value:p,configurable:true})}catch{}out.push(f)}else await collectDirectory(e,out,p)}}
async function collectEntry(entry,out,prefix=''){if(entry.isFile){await new Promise(res=>entry.file(f=>{try{Object.defineProperty(f,'webkitRelativePath',{value:prefix+f.name,configurable:true})}catch{}out.push(f);res()},res));return}if(entry.isDirectory){const r=entry.createReader();while(true){const batch=await new Promise(res=>r.readEntries(res,()=>res([])));if(!batch.length)break;for(const e of batch)await collectEntry(e,out,prefix+entry.name+'/')}}}

async function unzip(file){
  const buf=await file.arrayBuffer(), dv=new DataView(buf), bytes=new Uint8Array(buf), sig=0x06054b50;
  let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--){if(dv.getUint32(i,true)===sig){eocd=i;break}}
  if(eocd<0)throw new Error('ZIP inválido: diretório central não encontrado.');
  const count=dv.getUint16(eocd+10,true), cdSize=dv.getUint32(eocd+12,true), cdOffset=dv.getUint32(eocd+16,true);
  if(count===0)return [];
  const out=[];let pos=cdOffset;
  for(let n=0;n<count;n++){
    if(dv.getUint32(pos,true)!==0x02014b50)throw new Error('ZIP inválido: entrada não reconhecida.');
    const method=dv.getUint16(pos+10,true), csize=dv.getUint32(pos+20,true), usize=dv.getUint32(pos+24,true), nlen=dv.getUint16(pos+28,true), xlen=dv.getUint16(pos+30,true), clen=dv.getUint16(pos+32,true), loff=dv.getUint32(pos+42,true);
    const nameBytes=bytes.slice(pos+46,pos+46+nlen);const name=new TextDecoder('utf-8').decode(nameBytes).replace(/\\/g,'/');
    pos+=46+nlen+xlen+clen;if(!name||name.endsWith('/'))continue;
    if(method!==0&&method!==8)continue;
    if(usize>80*1024*1024)continue;
    const lp=loff, localNameLen=dv.getUint16(lp+26,true), localExtraLen=dv.getUint16(lp+28,true), start=lp+30+localNameLen+localExtraLen;
    const compressed=bytes.slice(start,start+csize);
    let data=compressed;
    if(method===8){
      if(typeof DecompressionStream!=='function')throw new Error('Este navegador não oferece descompactação ZIP nativa.');
      const ds=new DecompressionStream('deflate-raw');data=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(ds)).arrayBuffer());
    }
    if(usize&&data.byteLength!==usize){} // alguns ZIPs usam tamanhos incompatíveis; o conteúdo ainda pode ser válido.
    const f=new File([data],name.split('/').pop(),{type:''});try{Object.defineProperty(f,'webkitRelativePath',{value:name,configurable:true})}catch{}out.push(f);
  }
  return out;
}

async function normalizeInput(list){
  const all=[];for(const f of list){if(ext(f.name)==='zip'){const z=await unzip(f);all.push(...z)}else all.push(f)}
  return all;
}

// Cria uma cópia estável dos arquivos selecionados. Alguns navegadores invalidam
// referências de File obtidas por pastas após uma nova leitura/permissão, o que
// causava o erro "The requested file could not be read" ao atualizar.
async function snapshotFiles(list){
  const out=[];
  for(const f of list){
    if(!f||typeof f.arrayBuffer!=='function')continue;
    const path=f.webkitRelativePath||f.name;
    try{
      const copy=new File([await f.arrayBuffer()],f.name,{type:f.type||mime(f,path),lastModified:f.lastModified||Date.now()});
      try{Object.defineProperty(copy,'webkitRelativePath',{value:path,configurable:true})}catch{}
      out.push(copy);
    }catch(e){
      // Mantém a referência original apenas quando a cópia não é suportada.
      // A leitura normal ainda poderá funcionar e o erro será tratado com segurança.
      console.warn('Não foi possível criar cópia estável de',path,e);
      out.push(f);
    }
  }
  return out;
}
function unique(list){const s=new Set(),o=[];for(const f of list){if(!f||typeof f.arrayBuffer!=='function')continue;const key=(f.webkitRelativePath||f.name)+'|'+f.size+'|'+f.lastModified;if(s.has(key))continue;s.add(key);o.push(f)}return o}

async function addFiles(list,explicitName){
  const incoming=unique(list);if(!incoming.length)throw new Error('Nenhum arquivo válido foi encontrado.');
  files.clear();let raw=[];
  for(const f of incoming){const p=clean(f.webkitRelativePath||f.name);if(p){files.set(p,f);raw.push(p)}}
  if(!raw.length)throw new Error('Nenhum arquivo válido foi encontrado.');
  const first=raw[0].split('/')[0], hasRoot=raw.every(p=>p===first||p.startsWith(first+'/'));
  if(hasRoot){for(const p of [...raw]){const alias=p.slice(first.length+1);if(alias&&!files.has(alias))files.set(alias,files.get(p))}}
  root='';
  const htmls=[...files.keys()].filter(p=>/\.(?:html?|xhtml)$/i.test(p));
  entryPage=htmls.find(p=>p.toLowerCase()==='index.html')||htmls.find(p=>p.toLowerCase().endsWith('/index.html'))||htmls[0]||'';
  if(!entryPage)throw new Error('O projeto não possui uma página HTML. Para o SiteView, é necessário um arquivo HTML de entrada.');
  root=entryPage.includes('/')?entryPage.slice(0,entryPage.lastIndexOf('/')+1):'';
  projectName=explicitName||first||'Meu projeto';
  renderProject(htmls);
}

function renderProject(htmls){
  $('clearTop').disabled=false;
  area.innerHTML=`<article class="project-card"><div class="project-thumb"><div class="mini-browser"><div class="mini-bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div><div class="mini-screen"></div></div></div><div class="project-info"><h2>${esc(projectName)}</h2><div class="meta"><b>${countFiles()}</b> arquivo(s) • entrada: ${esc(entryPage)}</div><div class="entry-select"><label for="entrySelect">Página de entrada</label><select id="entrySelect">${htmls.map(p=>`<option value="${esc(p)}" ${p===entryPage?'selected':''}>${esc(p)}</option>`).join('')}</select></div><div class="file-summary"><div class="row"><span>Arquivos</span><b>${countFiles()}</b></div><div class="row"><span>HTML</span><b>${htmls.length}</b></div><div class="row"><span>Recursos</span><b>${Math.max(0,countFiles()-htmls.length)}</b></div></div><div class="project-actions"><button class="btn primary" id="view" type="button">Visualizar site</button><button class="btn secondary" id="remove" type="button">Excluir</button></div></div></article>`;
  $('entrySelect').onchange=e=>entryPage=e.target.value;
  $('view').onclick=()=>openPreview(entryPage);
  $('remove').onclick=clearProject;
}
function countFiles(){const s=new Set(files.values());return s.size}
function renderEmpty(){area.innerHTML=`<div class="empty"><div><strong>Nenhum projeto carregado</strong>Selecione uma pasta, arquivos ou ZIP para começar.</div></div>`;$('clearTop').disabled=true}
function clearProject(){generation++;files.clear();entryPage='';root='';projectName='Meu projeto';sourceDirectoryHandle=null;sourceType='memory';renderEmpty();hideProgress();toast('Projeto removido.')}
function showSystemLoading(title='Processando projeto',sub='O SiteView está preparando seus arquivos.'){const o=$('systemLoading');o.classList.add('show');o.setAttribute('aria-hidden','false');$('systemLoadingTitle').textContent=title;$('systemLoadingSub').textContent=sub;$('systemLoadingFill').style.width='4%';$('systemLoadingStage').textContent='Iniciando...'}
function updateSystemLoading(pct,stage,sub){if(!$('systemLoading').classList.contains('show'))return;$('systemLoadingFill').style.width=Math.max(0,Math.min(100,pct))+'%';$('systemLoadingStage').textContent=stage||'';if(sub)$('systemLoadingSub').textContent=sub}
async function hideSystemLoading(){const o=$('systemLoading');if(!o.classList.contains('show'))return;updateSystemLoading(100,'Concluído','Finalizando...');await sleep(220);o.classList.remove('show');o.setAttribute('aria-hidden','true')}
async function importFiles(list,name='',sourceHandle=null){
  if(busy)return;
  busy=true;generation++;const id=generation;const started=performance.now();
  try{
    showSystemLoading('Processando projeto','O SiteView está lendo e organizando seus arquivos.');
    setProgress(1,'Preparando projeto...','Analisando arquivos');
    updateSystemLoading(8,'Analisando arquivos...','Verificando a estrutura recebida');
    await frame();
    const incoming=await snapshotFiles(await normalizeInput(Array.from(list)));
    if(id!==generation)return;
    updateSystemLoading(25,'Organizando arquivos...',`${incoming.length} arquivo(s) encontrado(s)`);
    await processProgress(incoming,'Processando',id);
    if(id!==generation)return;
    updateSystemLoading(68,'Preparando recursos...','Montando a estrutura do projeto');
    await addFiles(incoming,name);
    sourceDirectoryHandle=sourceHandle||null;
    sourceType=sourceHandle?'directory':'memory';
    updateSystemLoading(88,'Verificando projeto...','Procurando a página de entrada e recursos');
    setProgress(100,'Projeto pronto','Pronto para visualizar');
    updateSystemLoading(100,'Projeto pronto','Tudo preparado para visualização');
    const minVisible=5200;
    const remaining=minVisible-(performance.now()-started);
    if(remaining>0)await sleep(remaining);
    hideProgress();await hideSystemLoading();toast('Projeto carregado com sucesso.');
  }catch(e){
    console.error(e);hideProgress();await hideSystemLoading();
    showError('Não foi possível carregar o projeto.',[{t:'Motivo',v:e.message||String(e)},{t:'Dica',v:'Confirme se o projeto contém uma página HTML e se o ZIP não está protegido por senha.'}]);
  }finally{if(id===generation)busy=false}
}
$('browse').onclick=async()=>{if(busy)return;if('showDirectoryPicker'in window){try{const h=await showDirectoryPicker({mode:'read'});const arr=[];await collectDirectory(h,arr);await importFiles(arr,h.name,h);return}catch(e){if(e.name==='AbortError')return}}folderInput.value='';folderInput.click()};
folderInput.onchange=()=>{if(folderInput.files.length)importFiles(folderInput.files)};
$('fileBrowse').onclick=()=>{if(!busy){fileInput.value='';fileInput.click()}};
fileInput.onchange=()=>{if(fileInput.files.length)importFiles(fileInput.files)};
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();if(!busy)drop.classList.add('on')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('on')}));
drop.ondrop=async e=>{if(busy)return;const items=[...(e.dataTransfer?.items||[])],arr=[];let droppedDirectoryHandle=null;try{for(const item of items){if(item.getAsFileSystemHandle){const h=await item.getAsFileSystemHandle();if(h?.kind==='directory'){if(!droppedDirectoryHandle)droppedDirectoryHandle=h;await collectDirectory(h,arr)}else if(h?.kind==='file')arr.push(await h.getFile());continue}const en=item.webkitGetAsEntry?.();if(en)await collectEntry(en,arr);else{const f=item.getAsFile?.();if(f)arr.push(f)}}if(!arr.length)arr.push(...(e.dataTransfer?.files||[]));await importFiles(arr,'',droppedDirectoryHandle)}catch(err){console.error(err);showError('Não foi possível ler os itens arrastados.',[{t:'Motivo',v:err.message||String(err)}])}};

async function dataUrl(file,path,text){
  if(text!==undefined)return 'data:'+mime(file,path)+';charset=utf-8,'+encodeURIComponent(text);
  const b=await file.arrayBuffer();let binary='';const u=new Uint8Array(b);const chunk=0x8000;for(let i=0;i<u.length;i+=chunk)binary+=String.fromCharCode(...u.subarray(i,i+chunk));return 'data:'+mime(file,path)+';base64,'+btoa(binary)
}
const textCache=new Map(), urlCache=new Map(), buildCache=new Map();
async function textOf(path){path=clean(path);if(textCache.has(path))return textCache.get(path);const f=fileFor(path);if(!f)return null;const t=await f.text();textCache.set(path,t);return t}
async function assetUrl(path){path=clean(path);if(urlCache.has(path))return urlCache.get(path);const f=fileFor(path);if(!f)return null;const p=dataUrl(f,path);urlCache.set(path,p);return p}

function rewriteCssUrls(css,base,depth=0){
  const urlRe=/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"']+))\s*\)/gi;let out='',last=0,m;
  return (async()=>{while((m=urlRe.exec(css))){out+=css.slice(last,m.index);const original=m[1]??m[2]??m[3];if(external(original)){out+=m[0];last=urlRe.lastIndex;continue}const p=resolve(base,original.trim());const u=p?await assetUrl(p):null;out+=u?`url("${u}")`:m[0];last=urlRe.lastIndex}out+=css.slice(last);return out})();
}
async function buildCss(path,seen=new Set()){
  path=clean(path);if(buildCache.has('css:'+path))return buildCache.get('css:'+path);if(seen.has(path))return '';seen.add(path);
  const src=await textOf(path);if(src==null)return '';let css=src;
  const imports=[];const re=/@import\s+(?:url\(\s*)?(["'])([^"']+\.css(?:[?#][^"']*)?)\1\s*\)?\s*;?/gi;let m;
  while((m=re.exec(src))){const p=resolve(baseOf(path),m[2]);if(p&&fileFor(p)){imports.push([m[0],await buildCss(p,new Set(seen))])}}
  for(const [a,b] of imports)css=css.split(a).join(b);
  css=await rewriteCssUrls(css,baseOf(path));const out='data:text/css;charset=utf-8,'+encodeURIComponent(css);buildCache.set('css:'+path,out);return out;
}

async function injectRuntime(){
  const map={};
  for(const [p,f] of files){
    if(!/\.(?:json|txt|csv|xml)$/i.test(p)||f.size>2*1024*1024)continue;
    try{map[clean(p)]=await assetUrl(p)}catch{}
  }
  const json=JSON.stringify(map).replace(/<\\/g,'<\\\\/');
  return `<script>(function(){try{window.__SITEVIEW_PREVIEW__=true;var A=${json};function r(v){try{v=String(v||'').trim();if(!v||/^(?:https?:|data:|blob:|#|mailto:|tel:|javascript:|about:|file:)/i.test(v)||v.indexOf('//')===0)return v;var u=new URL(v,location.href),p=u.pathname.replace(/^\\//,'');return A[p]||A[p.toLowerCase()]||v}catch(e){return v}}var of=window.fetch;if(of)window.fetch=function(i,o){if(typeof i==='string')i=r(i);else if(i&&i.url){var u=r(i.url);if(u!==i.url)i=new Request(u,i)}return of.call(this,i,o)};if(window.XMLHttpRequest){var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return oo.call(this,m,typeof u==='string'?r(u):u,...Array.prototype.slice.call(arguments,2))}}window.addEventListener('error',function(e){parent.postMessage({sv:'error',m:e.message||'Erro',s:e.filename||'',l:e.lineno||0},'*')});window.addEventListener('unhandledrejection',function(e){parent.postMessage({sv:'error',m:String(e.reason?.message||e.reason||'Promise rejeitada')},'*')});}catch(e){}})();<\/script>`;
}

async function rewriteJs(src,path,seen=new Set()){
  let out=src;
  // Static and dynamic relative module imports.
  const patterns=[
    /(\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?)(['"])([^'"]+)\2/g,
    /(\bimport\s*\(\s*)(['"])([^'"]+)\2/g
  ];
  for(const re of patterns){
    const matches=[...out.matchAll(re)];
    for(const m of matches.reverse()){const ref=m[3];if(external(ref))continue;const p=resolve(baseOf(path),ref);if(!p||!fileFor(p))continue;const f=fileFor(p);const e=ext(p);let u;if(/\.css$/i.test(e))u=await buildCss(p);else if(/\.(?:js|mjs|cjs)$/i.test(e))u=await buildJs(p,seen);else u=await assetUrl(p);if(u)out=out.slice(0,m.index+m[1].length+m[2].length)+u+out.slice(m.index+m[1].length+m[2].length+m[3].length+m[2].length)}
  }
  return out
}
async function buildJs(path,seen=new Set()){path=clean(path);if(buildCache.has('js:'+path))return buildCache.get('js:'+path);if(seen.has(path))return '';seen.add(path);const src=await textOf(path);if(src==null)return '';const out=await rewriteJs(src,path,seen);buildCache.set('js:'+path,out);return out}

async function processHtml(path,seen=new Set()){
  path=clean(path);if(seen.has(path))return '';seen.add(path);let html=await textOf(path);if(html==null)throw new Error('Página não encontrada: '+path);const b=baseOf(path);
  // CSS links become data URLs.
  const links=[...html.matchAll(/<link\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>/gi)];
  for(const m of links.reverse()){const href=m[3];if(!/\.css(?:[?#].*)?$/i.test(href)||external(href))continue;const p=resolve(b,href);if(!p||!fileFor(p))continue;const u=await buildCss(p);html=html.slice(0,m.index)+`<link rel="stylesheet" href="${u}">`+html.slice(m.index+m[0].length)}
  // Script src: inline normal scripts; module scripts use data URL.
  const scripts=[...html.matchAll(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)><\/script>/gi)];
  for(const m of scripts.reverse()){const src=m[3];if(external(src))continue;const p=resolve(b,src);if(!p||!fileFor(p))continue;const code=await buildJs(p,new Set());const isModule=/\btype\s*=\s*["']module["']/i.test(m[1]+m[4]);if(isModule){const u='data:text/javascript;charset=utf-8,'+encodeURIComponent(code);html=html.slice(0,m.index)+`<script type="module" src="${u}"><\/script>`+html.slice(m.index+m[0].length)}else html=html.slice(0,m.index)+`<script>${code}<\/script>`+html.slice(m.index+m[0].length)}
  // Local assets and internal HTML pages.
  const attrs=[...html.matchAll(/\b(src|href|poster)\s*=\s*(["'])(.*?)\2/gi)];
  for(const m of attrs.reverse()){const attr=m[1].toLowerCase(),v=m[3];if(external(v))continue;if(attr==='href'&&/^(?:javascript:|mailto:|tel:)/i.test(v))continue;if(attr==='href'&&/\.(?:html?|xhtml)(?:[?#].*)?$/i.test(v)){const p=resolve(b,v);if(p&&fileFor(p)){const page=await processHtml(p,new Set(seen));const u='data:text/html;charset=utf-8,'+encodeURIComponent(page);html=html.slice(0,m.index)+`${attr}="${u}"`+html.slice(m.index+m[0].length)}continue}const p=resolve(b,v);if(!p||!fileFor(p))continue;const u=await assetUrl(p);if(u)html=html.slice(0,m.index)+`${attr}="${u}"`+html.slice(m.index+m[0].length)}
  // srcset.
  const srcsets=[...html.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)];for(const m of srcsets.reverse()){const parts=m[2].split(',').map(x=>x.trim()).filter(Boolean);const conv=[];for(const item of parts){const bits=item.split(/\s+/),v=bits.shift();if(external(v)){conv.push(item);continue}const p=resolve(b,v),u=p?await assetUrl(p):null;conv.push(u?[u,...bits].join(' '):item)}html=html.slice(0,m.index)+`srcset="${conv.join(', ')}"`+html.slice(m.index+m[0].length)}
  const runtime=await injectRuntime();if(/<head\b[^>]*>/i.test(html))html=html.replace(/<head\b[^>]*>/i,m=>m+runtime);else html=runtime+html;
  return html
}

async function buildProject(path){
  textCache.clear();urlCache.clear();buildCache.clear();
  return await processHtml(path);
}

function showError(title,items){$('previewError').classList.remove('hide');$('previewLoading').classList.add('hide');$('errorText').textContent=title;$('diagnostic').innerHTML=(items||[]).map(x=>`<div class="diag"><b>${esc(x.t)}</b><br>${esc(x.v)}</div>`).join('')}
function openPreviewScreen(){if($('aboutModal').classList.contains('show'))$('closeAbout').click();const p=$('preview');p.classList.add('show');p.setAttribute('aria-hidden','false');$('previewLoading').classList.remove('hide');$('previewError').classList.add('hide');$('frame').srcdoc=''}
function closePreview(){const p=$('preview');p.classList.remove('show');p.setAttribute('aria-hidden','true');$('frame').srcdoc='';for(const u of previewObjectUrls)URL.revokeObjectURL(u);previewObjectUrls=[]}
async function refreshProjectSource(){
  if(!sourceDirectoryHandle)return false;
  let permission='granted';
  try{
    if(sourceDirectoryHandle.queryPermission) permission=await sourceDirectoryHandle.queryPermission({mode:'read'});
    if(permission!=='granted' && sourceDirectoryHandle.requestPermission) permission=await sourceDirectoryHandle.requestPermission({mode:'read'});
  }catch(e){ console.warn('Permissão da pasta não pôde ser consultada:',e); }
  if(permission!=='granted') throw new Error('Permissão de leitura da pasta não está disponível.');
  const arr=[];await collectDirectory(sourceDirectoryHandle,arr);if(!arr.length)throw new Error('Nenhum arquivo foi encontrado na pasta do projeto.');
  const oldEntry=entryPage, oldName=projectName;
  const incoming=unique(await snapshotFiles(arr));files.clear();let raw=[];
  for(const f of incoming){const p=clean(f.webkitRelativePath||f.name);if(p){files.set(p,f);raw.push(p)}}
  const first=raw[0]?.split('/')[0]||'';const hasRoot=first&&raw.every(p=>p===first||p.startsWith(first+'/'));
  if(hasRoot){for(const p of [...raw]){const alias=p.slice(first.length+1);if(alias&&!files.has(alias))files.set(alias,files.get(p))}}
  const htmls=[...files.keys()].filter(p=>/\.(?:html?|xhtml)$/i.test(p));
  if(!htmls.length)throw new Error('O projeto não possui uma página HTML.');
  entryPage=htmls.includes(oldEntry)?oldEntry:(htmls.find(p=>p.toLowerCase()==='index.html')||htmls.find(p=>p.toLowerCase().endsWith('/index.html'))||htmls[0]);
  root=entryPage.includes('/')?entryPage.slice(0,entryPage.lastIndexOf('/')+1):'';
  projectName=oldName||first||'Meu projeto';
  renderProject(htmls);
  return true;
}

async function refreshSourceByPicker(){
  if('showDirectoryPicker' in window){
    const h=await showDirectoryPicker({mode:'read'});
    const arr=[];await collectDirectory(h,arr);
    if(!arr.length)throw new Error('Nenhum arquivo foi encontrado na pasta do projeto.');
    const oldName=projectName;
    const incoming=unique(await snapshotFiles(arr));files.clear();let raw=[];
    for(const f of incoming){const p=clean(f.webkitRelativePath||f.name);if(p){files.set(p,f);raw.push(p)}}
    const first=raw[0]?.split('/')[0]||'';const hasRoot=first&&raw.every(p=>p===first||p.startsWith(first+'/'));
    if(hasRoot){for(const p of [...raw]){const alias=p.slice(first.length+1);if(alias&&!files.has(alias))files.set(alias,files.get(p))}}
    const htmls=[...files.keys()].filter(p=>/\.(?:html?|xhtml)$/i.test(p));
    if(!htmls.length)throw new Error('O projeto não possui uma página HTML.');
    entryPage=htmls.includes(entryPage)?entryPage:(htmls.find(p=>p.toLowerCase()==='index.html')||htmls.find(p=>p.toLowerCase().endsWith('/index.html'))||htmls[0]);
    root=entryPage.includes('/')?entryPage.slice(0,entryPage.lastIndexOf('/')+1):'';
    projectName=oldName||h.name||first||'Meu projeto';
    sourceDirectoryHandle=h;sourceType='directory';
    return true;
  }
  throw new Error('Este navegador não permite atualizar uma pasta diretamente.');
}

async function refreshPreview(){
  if(busy || !$('preview').classList.contains('show'))return;
  const button=$('refreshPreview');
  const oldEntry=entryPage;
  busy=true;
  button.disabled=true;button.classList.add('loading');button.innerHTML='<svg class="ui-icon refresh-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-4L4 9"></path><path d="M4 4v5h5"></path><path d="M4 13a8 8 0 0 0 14.7 4L20 15"></path><path d="M20 20v-5h-5"></path></svg><span class="label">Atualizando</span>';
  $('previewLoading').classList.remove('hide');$('previewError').classList.add('hide');
  $('previewLoadingSub').textContent='Atualizando a visualização...';
  try{
    const started=performance.now();
    let sourceUpdated=false;
    if(sourceDirectoryHandle){
      try{
        $('previewLoadingSub').textContent='Verificando arquivos editados...';
        await refreshProjectSource();
        sourceUpdated=true;
      }catch(sourceError){
        // Atualizar a prévia não deve falhar só porque o navegador perdeu a
        // permissão da pasta. Mantemos a última cópia válida em memória.
        console.warn('Não foi possível reler a pasta; usando a cópia carregada.',sourceError);
        $('previewLoadingSub').textContent='Usando a última cópia válida do projeto...';
      }
    }
    const path=entryPage||oldEntry;
    if(!path)throw new Error('Nenhuma página de entrada está disponível para atualizar.');
    await frame();
    const html=await buildProject(path);if(!html.trim())throw new Error('A página HTML está vazia.');
    $('previewLoadingSub').textContent='Aplicando HTML, CSS, imagens e scripts atualizados...';
    await frame();
    const fr=$('frame');fr.srcdoc='';
    await frame();
    fr.srcdoc=html;
    await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;res()};fr.addEventListener('load',finish,{once:true});setTimeout(finish,4000)});
    const elapsed=performance.now()-started;if(elapsed<850)await sleep(850-elapsed);
    $('previewLoadingSub').textContent='Visualização atualizada';await sleep(180);$('previewLoading').classList.add('hide');
    toast(sourceUpdated?'Projeto atualizado com os arquivos mais recentes.':'Visualização atualizada.');
  }catch(e){
    console.error(e);showError('Não foi possível atualizar a visualização.',[{t:'Motivo',v:e.message||String(e)},{t:'Dica',v:'O SiteView manteve a cópia carregada do projeto. Se o problema continuar, feche a visualização e carregue o projeto novamente.'}]);
  }finally{
    busy=false;button.disabled=false;button.classList.remove('loading');button.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.7-4L4 9"></path><path d="M4 4v5h5"></path><path d="M4 13a8 8 0 0 0 14.7 4L20 15"></path><path d="M20 20v-5h-5"></path></svg><span class="label">Atualizar</span>';
  }
}
async function openPreview(path){if(busy)return;busy=true;openPreviewScreen();$('previewTitle').textContent=projectName+' — '+path;const started=performance.now();try{$('previewLoadingSub').textContent='Lendo HTML e recursos...';await frame();const html=await buildProject(path);if(!html.trim())throw new Error('A página HTML está vazia.');$('previewLoadingSub').textContent='Montando CSS, imagens e scripts...';await frame();const fr=$('frame');fr.srcdoc=html;await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;res()};fr.addEventListener('load',finish,{once:true});setTimeout(finish,4000)});const elapsed=performance.now()-started;if(elapsed<900)await sleep(900-elapsed);$('previewLoadingSub').textContent='Visualização pronta';await sleep(180);$('previewLoading').classList.add('hide')}catch(e){console.error(e);showError('O SiteView não conseguiu montar esta página.',[{t:'Motivo',v:e.message||String(e)},{t:'Possíveis causas',v:'Caminho local incorreto, script incompatível, recurso externo bloqueado ou projeto que depende de servidor/backend.'}])}finally{busy=false}}
$('closePreview').onclick=closePreview;$('closeError').onclick=closePreview;$('retry').onclick=()=>openPreview(entryPage);$('refreshPreview').onclick=refreshPreview;
window.addEventListener('message',e=>{if(e.source!==$('frame').contentWindow)return;const d=e.data||{};if(d.sv==='error'){showError('O projeto abriu, mas registrou um erro de JavaScript.',[{t:'Erro',v:d.m+(d.s?` — ${d.s}${d.l?':'+d.l:''}`:'')},{t:'Observação',v:'Erros de API, backend ou serviços externos podem ser esperados em projetos que não foram feitos para execução offline.'}])}});

document.querySelectorAll('.device-btn').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.device-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const mode=btn.dataset.device,body=$('previewBody');$('frame').style.width=mode==='mobile'?'390px':mode==='tablet'?'768px':'100%';$('frame').style.maxWidth='100%';$('frame').style.margin='0 auto';body.style.background=mode==='desktop'?'#171b25':'#0a0e16'});

$('aboutBtn').onclick=()=>{$('aboutModal').classList.add('show');$('aboutModal').setAttribute('aria-hidden','false')};$('closeAbout').onclick=()=>{$('aboutModal').classList.remove('show');$('aboutModal').setAttribute('aria-hidden','true')};$('aboutModal').onclick=e=>{if(e.target.id==='aboutModal')$('closeAbout').click()};$('clearTop').onclick=clearProject;

function isStandalone(){return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true}
function openInstallModal(){if(isStandalone())return;const m=$('installModal');const status=$('installStatus');const note=$('installNote');const confirm=$('confirmInstall');if(deferredInstallPrompt){status.innerHTML='<strong>Instalação disponível</strong><span>O navegador está pronto para instalar o SiteView como aplicativo.</span>';confirm.disabled=false;confirm.textContent='Instalar SiteView';note.textContent='Ao continuar, o navegador abrirá a confirmação de instalação.'}else{status.innerHTML='<strong>Instalação pelo navegador</strong><span>O navegador ainda não disponibilizou o botão automático de instalação nesta sessão.</span>';confirm.disabled=false;confirm.textContent='Instalar SiteView';note.textContent='Se o botão automático não estiver disponível, use o menu do navegador e procure por “Instalar SiteView” ou “Adicionar à tela inicial”.'}m.classList.add('show');m.setAttribute('aria-hidden','false')}
function closeInstallModal(){const m=$('installModal');m.classList.remove('show');m.setAttribute('aria-hidden','true')}
async function installFromModal(){if(deferredInstallPrompt){const prompt=deferredInstallPrompt;deferredInstallPrompt=null;updateInstallButton();closeInstallModal();await prompt.prompt();try{const choice=await prompt.userChoice;if(choice?.outcome==='accepted')toast('SiteView instalado com sucesso.');else toast('Instalação cancelada.')}catch{toast('Não foi possível concluir a instalação.')}return}toast('Abra o menu do navegador para instalar ou adicionar o SiteView à tela inicial.');}
function updateInstallButton(){if(isStandalone()){installBtn.hidden=true;return}installBtn.hidden=false;installBtn.classList.toggle('ready',!!deferredInstallPrompt);installBtn.title=deferredInstallPrompt?'Instalar SiteView':'Conheça a instalação do SiteView'}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallButton();});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;installBtn.hidden=true;closeInstallModal();toast('SiteView instalado com sucesso.')});
installBtn.onclick=openInstallModal;
$('confirmInstall').onclick=installFromModal;$('cancelInstall').onclick=closeInstallModal;$('closeInstall').onclick=closeInstallModal;$('installModal').onclick=e=>{if(e.target.id==='installModal')closeInstallModal();};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('preview').classList.contains('show'))closePreview();else if($('installModal').classList.contains('show'))closeInstallModal();else if($('aboutModal').classList.contains('show'))$('closeAbout').click()}});

async function startSystemLoading(){
  updateInstallButton();
  showSystemLoading('Iniciando SiteView','Preparando o ambiente de visualização.');
  const stages=[[12,'Carregando interface...'],[34,'Verificando recursos...'],[57,'Preparando o visualizador...'],[79,'Configurando ambiente local...'],[100,'SiteView pronto']];
  for(const [pct,text] of stages){updateSystemLoading(pct,text,pct<100?'O sistema está preparando os componentes.':'Tudo pronto para começar.');await sleep(560);await frame()}
  await sleep(420);await hideSystemLoading();
}

if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
renderEmpty();
updateInstallButton();
window.addEventListener('load',()=>{startSystemLoading().catch(()=>{})},{once:true});
