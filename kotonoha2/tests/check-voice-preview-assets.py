"""Verify portable candidate assets without promoting technical QA to listening approval."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import wave

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--require-all-candidates', action='store_true')
parser.add_argument('--formal', action='store_true', help='Verify the formal release manifest without preview files')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / ('game/chapter1-voice-manifest.json' if args.formal else 'game/chapter1-voice-preview-manifest.json')).read_text())
items = {x['taskId']: x for x in manifest['items']}
assert len(items) == len(manifest['items']) == manifest['expectedSpokenTasks'] == 938
assert manifest['finalApproved'] == 0 and manifest['complete'] is False
assert manifest['audioLanguage'] == 'ja' and set(manifest['textLanguages']) == {'ja', 'zh'}
allowed = {'taskId', 'paragraphId', 'section', 'segmentIndex', 'spokenJaSHA256', 'status',
           'src', 'sha256', 'finalApproved', 'emotionMatchedVerified', 'cacheKey', 'durationSeconds'}
available = []
for task, item in items.items():
    assert set(item) <= allowed, f'Unexpected public/private metadata: {task}'
    assert re.fullmatch(r'KOTO-C1-[1-7]-l_\d+-s\d+', task)
    assert item['finalApproved'] is False and not item.get('emotionMatchedVerified')
    assert item['status'] in ('pending', 'available_emotion_candidate')
    if item['status'] == 'pending':
        assert item['src'] is None and item['sha256'] is None
        continue
    expected = f"game/vocal/chapter1/{task}.{item['sha256'][:16]}.wav"
    assert item['src'] == expected, f'Nonportable or mismatched asset: {task}'
    path = (root / item['src']).resolve()
    assert path.is_relative_to(root / 'game/vocal/chapter1')
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == item['sha256'], f'Changed bytes: {task}'
    with wave.open(str(path)) as audio:
        assert (audio.getnchannels(), audio.getframerate(), audio.getsampwidth()) == (1, 24000, 2)
        assert audio.getnframes() > 0 and audio.getcomptype() == 'NONE'
        assert len(audio.readframes(audio.getnframes())) == audio.getnframes() * 2
        assert abs(audio.getnframes() / 24000 - item['durationSeconds']) < 1e-6
    available.append(task)
assert len(available) == manifest['available']
assert manifest['pending'] == 938 - len(available)
if args.require_all_candidates:
    assert len(available) == 938 and manifest['pending'] == 0

seen = []
silent_narration = 0
if args.formal:
    language_tasks = {'ja': [], 'zh': []}
    for name, scene in manifest['scenes'].items():
        raw = (root / 'game/scene' / name).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == scene['sourceSHA256']
        lines = raw.decode().splitlines()
        for index, cue in scene['lines'].items():
            if lines[int(index)].startswith(':'):
                assert not cue['taskIds']
                silent_narration += 1
            language_tasks[scene['language']].extend(cue['taskIds'])
    for tasks in language_tasks.values():
        assert len(tasks) == len(set(tasks)) == 938 and set(tasks) == set(items)
    assert not any(token in json.dumps(manifest) for token in ('/workspace/', '/home/', 'productionActorID'))
    print(f'PASS: {len(available)}/938 formal portable PCM16 candidates; 14 original scenes; no private identity leakage.')
    raise SystemExit(0)
for section in range(1, 8):
    cue = None
    for line in (root / f'game/scene/chapter1-{section}-ja-voice-preview.txt').read_text().splitlines():
        if line.startswith('setVar:koto_voice_task='):
            cue = line.split('=', 1)[1].rstrip(';')
        if re.match(r'^(?:[^\x00-\x7f][^:]*|):', line):
            assert cue is not None, 'Every dialogue/narration line needs an explicit voice marker'
            if line.startswith(':'):
                assert cue == 'none', 'Narration must not receive speech'
                silent_narration += 1
            elif cue != 'none':
                assert cue in items and items[cue]['section'] == section
                seen.append(cue)
            cue = None
assert len(seen) == len(set(seen)) == 938 and set(seen) == set(items)
paragraph_tasks = [task for tasks in manifest['paragraphCues'].values() for task in tasks]
assert len(paragraph_tasks) == len(set(paragraph_tasks)) == 938 and set(paragraph_tasks) == set(items)
assert not any(token in json.dumps(manifest) for token in ('/workspace/', '/home/', 'productionActorID'))
print(f'PASS: {len(available)}/938 verified portable PCM16 candidates; 938 unique cues; '
      f'{silent_narration} silent narration lines; no approval or private identity leakage.')
