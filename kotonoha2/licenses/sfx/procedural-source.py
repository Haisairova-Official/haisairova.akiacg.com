import numpy as np,wave,subprocess,json
from pathlib import Path
r=Path('kotonoha_work/game/vocal');rng=np.random.default_rng(20261018);sr=44100
for name,dur in [('impact',.55),('shot',.8),('glass',1.2),('magic',1.8),('fire',2.5),('water',2.2),('clock',2),('whistle',.75)]:
 t=np.arange(int(sr*dur))/sr;n=rng.normal(0,1,len(t));x=np.zeros(len(t))
 if name=='shot':x=.75*n*np.exp(-t*35)+.35*np.sin(2*np.pi*(100*t-25*t*t))*np.exp(-t*12)
 elif name=='impact':x=.4*n*np.exp(-t*45)+.6*np.sin(2*np.pi*75*t)*np.exp(-t*14)
 elif name=='glass':
  for f in [1880,2741,3553,4807,6501]:x+=np.sin(2*np.pi*f*t)*np.exp(-t*(4+f/2500))*.16
  x+=n*.18*np.exp(-t*10)
 elif name=='magic':
  x=sum(np.sin(2*np.pi*f*t)*.12 for f in [523.25,783.99,1046.5,1567.98])*np.sin(np.pi*t/dur)**2
 elif name=='clock':x=sum(np.sin(2*np.pi*f*t)*a for f,a in [(260,.3),(520,.2),(719,.1),(1079,.1)])*np.exp(-t*2.5)
 elif name=='whistle':x=np.sin(2*np.pi*(2200*t+220*t*t))*.4*np.minimum(t/.04,1)*np.minimum((dur-t)/.06,1)
 else:
  smooth=np.convolve(n,np.ones(12)/12,'same');x=smooth*(.5+.2*np.sin(2*np.pi*7*t));x*=np.minimum(t/.12,1)*np.minimum((dur-t)/.3,1)
  if name=='fire':x+=n*(rng.random(len(t))>.997)*.4
 peak=max(np.max(np.abs(x)),1e-9);x=x/peak*.5
 p=Path('/tmp')/(name+'.wav')
 with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((x*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(p),'-codec:a','libmp3lame','-b:a','128k',str(r/f'sfx11_{name}.mp3')],check=True)
print('8 deterministic procedural sound effects created, no external recordings')
