import pathlib,json,subprocess,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parents[2];out=root/'outputs/FLEREMIASFLEMIN-MARKETING';music=pathlib.Path(__file__).parent/'musica-original.wav'
items=json.loads((out/'textos/inventario.json').read_text('utf8'));batches=json.loads((out/'textos/lotes.json').read_text('utf8'))
dest=out/'videos-individuales';dest.mkdir(exist_ok=True);logs=pathlib.Path(__file__).parent/'video-logs';logs.mkdir(exist_ok=True)
def run(args,log):
 p=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y']+args,capture_output=True,text=True)
 if p.returncode:(logs/(log+'.txt')).write_text(p.stderr);raise RuntimeError(log+': '+p.stderr[:300])
def individual(m):
 f=out/m['story']
 for _ in range(300):
  if f.exists(): break
  time.sleep(1)
 vf="scale=1440:-1,zoompan=z='1+0.028*on/71':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=72:s=720x1280:fps=24,fade=t=in:st=0:d=0.2,fade=t=out:st=2.8:d=0.2,format=yuv420p"
 run(['-i',str(f),'-i',str(music),'-vf',vf,'-t','3','-c:v','libx264','-preset','fast','-crf','20','-threads','2','-c:a','aac','-b:a','128k','-movflags','+faststart',str(dest/(m['id']+'.mp4'))],m['id'])
 return m['id']
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for i,name in enumerate(pool.map(individual,[m for m in items if m['id'] in ['perillas-ac-reemplazo','muelle-carga-todo-en-uno','soporte-motor-antivibracion']])):print(str(i+1)+' / 150 video '+name,flush=True)
for b in batches:
 listing=logs/(b['id']+'.txt')
 listing.write_text('\n'.join("file '"+str(dest/(id+'.mp4')).replace('\\','/')+"'" for id in b['items']),encoding='utf8')
 run(['-f','concat','-safe','0','-i',str(listing),'-stream_loop','-1','-i',str(music),'-map','0:v','-map','1:a','-t',str(3*len(b['items'])),'-c:v','copy','-c:a','aac','-b:a','160k','-movflags','+faststart',str(out/'videos-2d'/(b['id']+'.mp4'))],b['id'])
 print('Lote '+b['id'],flush=True)


