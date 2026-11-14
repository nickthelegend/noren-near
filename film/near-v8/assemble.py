"""Turn screencast frames into one mp4 per take. python3 assemble.py <ledger.json> [outdir]"""
import json,sys,os,subprocess
L=json.load(open(sys.argv[1]));out=sys.argv[2] if len(sys.argv)>2 else os.path.join(os.path.dirname(__file__),'work','takes')
os.makedirs(out,exist_ok=True);FR=os.path.abspath(L.get('framesDir') or sys.argv[3])
idx={p:json.load(open(os.path.join(FR,p,'index.json'))) for p in os.listdir(FR) if os.path.exists(os.path.join(FR,p,'index.json'))}
for t in L['takes']:
    fr=idx[t['page']];s,e=t['start'],t['end']
    prev=[f for f in fr if f[0]<=s];inside=[f for f in fr if s<f[0]<e]
    seq=([[s,prev[-1][1]]] if prev else [])+inside
    if not seq: print('no frames',t['id']);continue
    lines=[]
    for i,(ts,f) in enumerate(seq):
        nxt=seq[i+1][0] if i+1<len(seq) else e
        lines.append(f"file '{os.path.join(FR,t['page'],f)}'\nduration {max(0.001,nxt-ts):.4f}")
    lines.append(f"file '{os.path.join(FR,t['page'],seq[-1][1])}'")
    lst=os.path.join(out,t['id']+'.txt');open(lst,'w').write('\n'.join(lines)+'\n')
    dst=os.path.join(out,t['id']+'.mp4')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',lst,'-vf','fps=30,scale=1920:1080:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','medium','-crf','16',dst],check=True)
    print(t['id'],round(e-s,1),'s',len(seq),'frames')
