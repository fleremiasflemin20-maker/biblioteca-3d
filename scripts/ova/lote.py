import json,subprocess,sys,os
from concurrent.futures import ThreadPoolExecutor
w,h,dest=int(sys.argv[1]),int(sys.argv[2]),sys.argv[3]; solo=sys.argv[4:] 
os.makedirs(dest,exist_ok=True); os.makedirs('cfg',exist_ok=True)
V=json.load(open('vinetas.json'))
def uno(i_v):
  i,v=i_v
  if solo and v['id'] not in solo: return
  c={k:v[k] for k in v if k not in ('narra','globos','cap','id')}; c['seed']=100+i
  json.dump(c,open(f"cfg/{v['id']}.json",'w'))
  r=subprocess.run(['node','render.cjs',f"cfg/{v['id']}.json",f"{dest}/{v['id']}.png",str(w),str(h)],capture_output=True,text=True)
  print(v['id'],[l for l in r.stdout.splitlines() if 'Driver' not in l and 'PERFIL' not in l],r.stderr[-200:])
with ThreadPoolExecutor(4) as ex: list(ex.map(uno,enumerate(V)))
