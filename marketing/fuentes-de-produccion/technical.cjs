const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
const {chromium}=require('C:/Users/flere/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'outputs/FLEREMIASFLEMIN-MARKETING');
const types={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{let rel=decodeURIComponent(req.url.split('?')[0]),base=out;if(rel.startsWith('/three/')){base=path.join(__dirname,'node_modules/three');rel=rel.slice(6);}if(rel.startsWith('/models/')||rel.startsWith('/draco/'))base=path.join(root,'work/biblioteca-3d/public');const f=path.join(base,rel);if(!f.startsWith(base)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
const ids=['perillas-ac-reemplazo','muelle-carga-todo-en-uno','soporte-motor-antivibracion'];
(async()=>{await new Promise(r=>server.listen(8768,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});await page.route('http://127.0.0.1:8768/**',async route=>{let rel=decodeURIComponent(new URL(route.request().url()).pathname),base=out;if(rel.startsWith('/three/')){base=path.join(__dirname,'node_modules/three');rel=rel.slice(6);}if(rel.startsWith('/models/')||rel.startsWith('/draco/'))base=path.join(root,'work/biblioteca-3d/public');const f=path.join(base,rel);if(!f.startsWith(base)||!fs.existsSync(f)){await route.fulfill({status:404,body:''});return}await route.fulfill({status:200,contentType:types[path.extname(f)]||'application/octet-stream',body:fs.readFileSync(f)});});page.on('pageerror',e=>console.log('PAGE ERROR',String(e)));const items=JSON.parse(fs.readFileSync(path.join(out,'textos/inventario.json')));
for(const id of ids){const m=items.find(x=>x.id===id);await page.goto('http://127.0.0.1:8768/estudio.html?id='+id+'&fmt=story');await page.evaluate(()=>window.ready);
await page.evaluate(async m=>{
document.body.style.zoom='0.6666666667';
const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{three:'/three/build/three.module.js'}});document.head.appendChild(map);
const THREE=await import('/three/build/three.module.js');const {GLTFLoader}=await import('/three/examples/jsm/loaders/GLTFLoader.js');const {DRACOLoader}=await import('/three/examples/jsm/loaders/DRACOLoader.js');
const image=document.querySelector('.product');const r=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(890,850);r.setPixelRatio(1);r.setClearColor(0x000000,0);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.18;const canvas=r.domElement;canvas.className='product';image.replaceWith(canvas);
const scene=new THREE.Scene;const camera=new THREE.PerspectiveCamera(32,890/850,.1,100);camera.position.set(0,1.4,4.7);camera.lookAt(0,0,0);scene.add(new THREE.AmbientLight(0xffffff,2.1));
for(const [p,c,power] of [[[3,4,4],0xffe8dd,3.2],[[-3,2,2],0xc0d9ff,2],[[0,3,-3],0xe7b4ff,3]]){const l=new THREE.DirectionalLight(c,power);l.position.set(...p);scene.add(l)}
const {MeshoptDecoder}=await import('/three/examples/jsm/libs/meshopt_decoder.module.js');const loader=new GLTFLoader;loader.setMeshoptDecoder(MeshoptDecoder);const draco=new DRACOLoader;draco.setDecoderPath('/draco/');loader.setDRACOLoader(draco);const gltf=await loader.loadAsync('/models/'+m.archivo);const obj=gltf.scene;const box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3),center=box.getCenter(new THREE.Vector3);const k=2.2/Math.max(size.x,size.y,size.z);obj.position.copy(center).multiplyScalar(-k);obj.scale.setScalar(k);const turn=new THREE.Group;turn.add(obj);scene.add(turn);
document.querySelector('.edition').textContent='MODELO REAL DEL CATÁLOGO · VISTA 360°';
window.drawFrame=(t)=>{turn.rotation.y=.45+t*Math.PI*2;camera.position.z=4.7-.12*Math.sin(t*Math.PI);r.render(scene,camera);};window.drawFrame(0);
},m);
const data=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/webp',.98).split(',')[1]);fs.writeFileSync(path.join(out,'assets/productos',m.portada),Buffer.from(data,'base64'));console.log('TECHNICAL '+id);continue;const dir=path.join(__dirname,'frames',id);fs.mkdirSync(dir,{recursive:true});const frames=process.argv.includes('--preview')?1:144;
for(let i=0;i<frames;i++){await page.evaluate(t=>window.drawFrame(t),i/144);await page.screenshot({path:path.join(dir,String(i).padStart(4,'0')+'.png')});if(i%36===0)console.log(id+' '+i+'/'+frames);}
if(frames>1){const dest=path.join(out,'videos-3d',id+'-360.mp4');const result=cp.spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(dir,'%04d.png'),'-i',path.join(__dirname,'musica-original.wav'),'-t','6','-c:v','libx264','-preset','fast','-crf','19','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',dest],{encoding:'utf8'});if(result.status)throw Error(result.stderr);console.log('DONE '+dest);}
if(process.argv.includes('--preview'))break;
}
await browser.close();server.close();})().catch(e=>{console.error(e);process.exit(1)});





