"""Cut the Noren-on-NEAR film from live takes. python3 build.py edl.json out.mp4
The EDL lists segments of real takes (in/out seconds inside each take) or still cards; nothing is drawn over the app.
Voice lines sit at an offset inside their segment; a click sound plays on every click the recorder logged."""
import json, os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__))
SFX = '/Volumes/Extreme SSD/Projects/grokbot/projects/_wt/noren-film/film/assets/sfx/'
BED = '/Volumes/Extreme SSD/Projects/grokbot/projects/_wt/noren-film/film/assets/music/bed.wav'
edl = json.load(open(sys.argv[1])); out = sys.argv[2]
tmp = os.path.join(H, 'work', 'cut'); os.makedirs(tmp, exist_ok=True)
ledgers = {k: json.load(open(v)) for k, v in edl['ledgers'].items()}
vo = {l['id']: l['seconds'] for l in json.load(open(os.path.join(H, 'work', 'vo', 'lines.json')))}
def run(*a): subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)

segs, t, voice, clicks = [], 0.0, [], []
for i, s in enumerate(edl['segments']):
    dst = os.path.join(tmp, f'{i:02d}.mp4')
    if 'card' in s:
        dur = s['dur']
        run('-loop', '1', '-t', f'{dur}', '-i', os.path.join(H, s['card']), '-vf', 'fps=30,format=yuv420p,fade=t=in:st=0:d=0.5', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', dst)
    else:
        src = os.path.join(H, 'work', s['dir'], s['take'] + '.mp4'); dur = s['out'] - s['in']
        vf = 'fps=30,format=yuv420p'
        if s.get('fadein'): vf += ',fade=t=in:st=0:d=0.4'
        run('-ss', f"{s['in']:.3f}", '-i', src, '-t', f'{dur:.3f}', '-vf', vf, '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', dst)
        L = ledgers[s['ledger']]; take = next(x for x in L['takes'] if x['id'] == s['take'])
        for e in L['events']:
            if e['type'] == 'click' and e['page'] == take['page'] and take['start'] <= e['t'] <= take['end']:
                rel = e['t'] - take['start'] - s['in']
                if 0 <= rel <= dur: clicks.append(t + rel)
    for v in s.get('vo', []):
        voice.append((v['id'], t + v['at']))
        assert v['at'] + vo[v['id']] <= dur + 0.05 or s.get('vo_spill'), f"voice {v['id']} overruns segment {i}"
    segs.append(dst); s['_start'] = round(t, 2); t += dur
total = t
open(os.path.join(tmp, 'list.txt'), 'w').write(''.join(f"file '{p}'\n" for p in segs))
video = os.path.join(tmp, 'video.mp4')
run('-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'list.txt'), '-c', 'copy', video)
# voice check: no overlaps
vs = sorted(voice, key=lambda x: x[1])
for a, b in zip(vs, vs[1:]):
    assert a[1] + vo[a[0]] <= b[1] + 0.02, f'voice overlap {a[0]} -> {b[0]}'
# audio graph
inputs, parts = ['-i', video, '-stream_loop', '-1', '-i', BED], []
n = 2
for vid, at in vs:
    inputs += ['-i', os.path.join(H, 'work', 'vo', vid + '.wav')]
    parts.append(f'[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.0,adelay={int(at*1000)}|{int(at*1000)}[v{n}]'); n += 1
vn = [f'[v{k}]' for k in range(2, n)]
cl0 = n
for c in clicks:
    inputs += ['-i', SFX + 'click-soft.mp3']
    parts.append(f'[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.35,adelay={int(c*1000)}|{int(c*1000)}[c{n}]'); n += 1
cn = [f'[c{k}]' for k in range(cl0, n)]
parts.append(f"{''.join(vn)}amix=inputs={len(vn)}:normalize=0[voice]")
parts.append('[voice]asplit=2[voiceA][voiceB]')
parts.append(f'[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total:.3f},volume=0.16,afade=t=in:d=1.5,afade=t=out:st={total-3:.3f}:d=3[bed]')
parts.append('[bed][voiceB]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]')
if cn: parts.append(f"{''.join(cn)}amix=inputs={len(cn)}:normalize=0[clk]"); mix = '[voiceA][duck][clk]amix=inputs=3:normalize=0'
else: mix = '[voiceA][duck]amix=inputs=2:normalize=0'
parts.append(f'{mix},loudnorm=I=-16:TP=-1.5:LRA=11[aout]')
script = os.path.join(tmp, 'graph.txt'); open(script, 'w').write(';\n'.join(parts))
run(*inputs, '-filter_complex_script', script, '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', f'{total:.3f}', '-movflags', '+faststart', out)
json.dump({'total': round(total, 2), 'segments': [{k: v for k, v in s.items() if k != 'vo'} | {'vo': s.get('vo', [])} for s in edl['segments']], 'clicks': len(clicks)}, open(out + '.cut.json', 'w'), indent=1)
print('built', out, round(total, 1), 's', len(clicks), 'clicks')
