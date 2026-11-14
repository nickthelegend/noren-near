"""python3 sheet.py take.mp4 out.jpg [step=2] [cols=6] [start=0] [end]: timestamped contact sheet."""
import sys,subprocess,tempfile,os,glob
from PIL import Image,ImageDraw
src,out=sys.argv[1],sys.argv[2];step=float(sys.argv[3]) if len(sys.argv)>3 else 2;cols=int(sys.argv[4]) if len(sys.argv)>4 else 6
start=float(sys.argv[5]) if len(sys.argv)>5 else 0;end=sys.argv[6] if len(sys.argv)>6 else None
d=tempfile.mkdtemp(dir=os.path.dirname(os.path.abspath(out)))
a=['ffmpeg','-loglevel','error','-ss',str(start),'-i',src]+(['-t',str(float(end)-start)] if end else [])+['-vf',f'fps=1/{step},scale=240:-1',f'{d}/%04d.jpg']
subprocess.run(a,check=True);fs=sorted(glob.glob(d+'/*.jpg'));W,H=Image.open(fs[0]).size;rows=(len(fs)+cols-1)//cols
S=Image.new('RGB',(W*cols,H*rows),'black')
for i,f in enumerate(fs):
    im=Image.open(f);dr=ImageDraw.Draw(im);t=start+i*step;dr.rectangle([0,0,58,16],fill='black');dr.text((3,2),f'{t:5.1f}',fill='white');S.paste(im,((i%cols)*W,(i//cols)*H));os.remove(f)
os.rmdir(d);S.save(out,quality=85);print(out,len(fs))
