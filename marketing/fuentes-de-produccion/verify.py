from pathlib import Path
import json,subprocess,concurrent.futures
from PIL import Image
root=Path(__file__).resolve().parents[2];out=root/'outputs/FLEREMIASFLEMIN-MARKETING'
items=json.loads((out/'textos/inventario.json').read_text())
errors=[]
for m in items:
 for key,size in [('post',(1080,1350)),('story',(1080,1920))]:
  p=out/m[key]
  with Image.open(p) as im:
   if im.size!=size:errors.append(str(p))
def check(p):
 r=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate:format=duration','-of','json',str(p)],capture_output=True,text=True)
 if r.returncode:return {'file':str(p.relative_to(out)),'error':r.stderr}
 data=json.loads(r.stdout);v=next(x for x in data['streams'] if x['codec_type']=='video')
 return {'file':str(p.relative_to(out)),'width':v['width'],'height':v['height'],'fps':v['r_frame_rate'],'duration':float(data['format']['duration']),'audio':any(x['codec_type']=='audio' for x in data['streams'])}
videos=list(out.glob('videos-*/*.mp4'))
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(check,videos))
bad=[r for r in results if r.get('width')!=720 or r.get('height')!=1280 or not r.get('audio') or r.get('duration',0)<2.9]
status=subprocess.run(['git','-C',str(root/'work/biblioteca-3d'),'status','--porcelain'],capture_output=True,text=True).stdout
summary={'articulos':len(items),'imagenes_individuales':len(items)*2,'portadas_coleccion':len(list((out/'colecciones').glob('*.png'))),'videos':len(videos),'errores_imagen':errors,'errores_video':bad,'biblioteca_sin_cambios':not status.strip(),'videos_detalle':results}
(out/'textos/VERIFICACION.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in summary.items() if k!='videos_detalle'},ensure_ascii=False))

