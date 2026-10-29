import numpy as np,wave, pathlib
sr=44100; dur=24; t=np.arange(sr*dur)/sr; y=np.zeros_like(t)
rng=np.random.default_rng(42)
# Original ambient-electronic bed: four triads, soft arpeggio, kick and hi-hat.
chords=[[130.8128,155.5635,195.9977],[103.8262,130.8128,155.5635],[116.5409,146.8324,174.6141],[97.9989,123.4708,146.8324]]
for start in np.arange(0,dur,3):
 idx=int(start/3)%4; mask=(t>=start)&(t<start+3); u=t[mask]-start
 env=np.minimum(u/.12,1)*np.minimum((3-u)/.22,1)
 for f in chords[idx]: y[mask]+=.033*env*(np.sin(2*np.pi*f*u)+.3*np.sin(2*np.pi*f*2*u))
for k,start in enumerate(np.arange(0,dur,.25)):
 mask=(t>=start)&(t<start+.24);u=t[mask]-start;f=chords[int(start/3)%4][k%3]*4
 y[mask]+=.06*np.exp(-u*18)*np.sin(2*np.pi*f*u)
for start in np.arange(0,dur,.5):
 mask=(t>=start)&(t<start+.22);u=t[mask]-start
 y[mask]+=.12*np.exp(-u*20)*np.sin(2*np.pi*(48*u+2*(1-np.exp(-u*35))))
for start in np.arange(.25,dur,.5):
 mask=(t>=start)&(t<start+.06);u=t[mask]-start
 noise=rng.normal(0,1,len(u));y[mask]+=.018*noise*np.exp(-u*65)
y*=np.minimum(t/.2,1)*np.minimum((dur-t)/.5,1)
st=np.stack([y,y*.96],axis=1);pcm=(np.clip(st,-1,1)*32767).astype('<i2')
with wave.open(str(pathlib.Path(__file__).parent/'musica-original.wav'),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes())
print('Música original creada: 24 s')

