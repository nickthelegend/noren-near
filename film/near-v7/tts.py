"""One WAV per line with native Kokoro af_heart. Run with film-v2/work/kokoro-env/bin/python."""
import json,os,sys
os.environ['OMP_NUM_THREADS']='2'
import onnxruntime as ort, soundfile as sf
from kokoro_onnx import Kokoro
M='/Volumes/Extreme SSD/Projects/grokbot/videos/noren-near/film-v2/work/models/'
H=os.path.dirname(os.path.abspath(__file__));out=os.path.join(H,'work','vo');os.makedirs(out,exist_ok=True)
o=ort.SessionOptions();o.intra_op_num_threads=2;o.inter_op_num_threads=1
k=Kokoro.from_session(ort.InferenceSession(M+'kokoro-v1.0.onnx',sess_options=o,providers=['CPUExecutionProvider']),M+'voices-v1.0.bin')
spec=json.load(open(os.path.join(H,'vo-script.json')));res=[]
only=set(sys.argv[1:])
for l in spec['lines']:
    p=os.path.join(out,l['id']+'.wav')
    if only and l['id'] not in only and os.path.exists(p): pass
    elif not os.path.exists(p) or l['id'] in only:
        a,sr=k.create(l['say'],voice='af_heart',speed=1.0,lang='en-us');sf.write(p,a,sr)
    res.append({'id':l['id'],'seconds':round(sf.info(p).duration,3)});print(l['id'],res[-1]['seconds'],flush=True)
json.dump(res,open(os.path.join(out,'lines.json'),'w'),indent=1);print('total',round(sum(r['seconds'] for r in res),1))
