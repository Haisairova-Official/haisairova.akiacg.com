import {test, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createVoicePreloadSession} from '../game/chapter1-preload-core.mjs';

const bytes = Uint8Array.from([82, 73, 70, 70, 1, 2, 3, 4]);
const hash = createHash('sha256').update(bytes).digest('hex');
const item = (section, line) => ({
  taskId: `KOTO-C1-${section}-l_${line}-s001`, status: 'available_emotion_candidate',
  src: `game/vocal/chapter1/KOTO-C1-${section}-l_${line}-s001.${hash.slice(0, 16)}.wav`, sha256: hash,
});
function fixture() {
  const counts = [3, 2, 929, 1, 1, 1, 1];
  return {available: 938, pending: 0, items: counts.flatMap((count, index) =>
    Array.from({length: count}, (_, line) => item(index + 1, line + 1)))};
}
const live = new Set();
afterEach(() => { for (const session of live) session.dispose(); live.clear(); });
function setup(options = {}) {
  const session = createVoicePreloadSession({manifest: fixture(), chapter: '1-1', cryptoProvider: webcrypto, ...options});
  live.add(session); return session;
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject}; };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('default ON selects only the requested plain Chapter 1 subsection', () => {
  const manifest = fixture(), session = setup({manifest});
  assert.deepEqual(session.files(), manifest.items.slice(0, 3).map(item => item.src));
  const next = setup({manifest, chapter: '1-2'});
  assert.deepEqual(next.files(), manifest.items.slice(3, 5).map(item => item.src));
  const files = session.files(); files.pop();
  assert.equal(session.files().length, 3, 'caller cannot mutate the selected file list');
});

test('OFF needs no manifest and performs no network, storage, or crypto operation', () => {
  const session = setup({enabled: false, manifest: undefined,
    cryptoProvider: new Proxy({}, {get() { assert.fail('must not touch crypto'); }})});
  assert.deepEqual(session.files(), []);
  assert.deepEqual(session.stats(new Set(['game/a.png']), ['game/a.png', 'game/b.png']),
    {completed: 1, total: 2, voiceCompleted: 0, voiceTotal: 0});
  session.disable();
});

test('OFF with an already-loaded manifest recognizes and skips voice without returning queue files', () => {
  const manifest = fixture(), session = setup({manifest, enabled: false});
  const source = manifest.items[0].src;
  assert.deepEqual(session.files(), []); assert.equal(session.isVoice(source), true);
  assert.equal(session.isSkipped(source), true);
  const controller = new AbortController();
  session.register(source, controller);
  assert.equal(controller.signal.aborted, true);
  assert.equal(session.isSkipped('game/vocal/amb_rain_r16.mp3'), false);
});

test('other chapters, preview variants, and malformed keys remain inert without requiring any manifest', () => {
  for (const chapter of ['2-1', '3-6', '1-1-expressions-preview', '1-8', '1-11', 'chapter1-1', undefined]) {
    const session = setup({chapter, manifest: undefined});
    assert.deepEqual(session.files(), []);
    assert.equal(session.isVoice(item(1, 1).src), false);
    assert.deepEqual(session.stats(new Set(), ['game/background/a.png']),
      {completed: 0, total: 1, voiceCompleted: 0, voiceTotal: 0});
  }
});

test('ON requires the complete 938-item available manifest, never 937 or 939', () => {
  for (const change of [
    manifest => { manifest.available = 937; },
    manifest => { manifest.available = 939; },
    manifest => { manifest.pending = 1; },
    manifest => { manifest.items.pop(); },
    manifest => { manifest.items.push(item(1, 9000)); },
    manifest => { manifest.items = {}; },
  ]) {
    const manifest = fixture(); change(manifest);
    assert.throws(() => setup({manifest}), /Incomplete chapter voice manifest/);
  }
  assert.throws(() => setup({manifest: undefined}), /Incomplete chapter voice manifest/);
});

test('bad paths, task IDs, statuses, hashes, and duplicate identifiers or sources fail closed', () => {
  const invalid = [
    {src: 'https://other.test/audio.wav'}, {src: '/game/vocal/chapter1/a.wav'},
    {src: 'game/vocal/chapter1/../../a.wav'}, {src: 'game/vocal/chapter1/./a.wav'},
    {src: 'game/vocal/chapter1//a.wav'}, {src: 'game/vocal/chapter1/a.wav?token=anything'},
    {src: 'game/vocal/chapter1/%2e%2e/a.wav'}, {src: 'game/vocal/chapter1/a.exe'},
    {src: 'game/vocal/chapter2/a.wav'}, {taskId: 'KOTO-C1-11-l_1-s001'},
    {sha256: 'wrong'}, {sha256: hash.toUpperCase()}, {status: 'pending'},
  ];
  for (const replacement of invalid) {
    const manifest = fixture(); Object.assign(manifest.items[0], replacement);
    assert.throws(() => setup({manifest}), /Invalid chapter voice manifest entry/);
  }
  for (const field of ['taskId', 'src']) {
    const manifest = fixture(); manifest.items[1][field] = manifest.items[0][field];
    assert.throws(() => setup({manifest}), /Invalid chapter voice manifest entry/);
  }
});

test('invalid entries anywhere in the source manifest cannot be silently ignored', () => {
  const manifest = fixture(); manifest.items.at(-1).sha256 = 'invalid';
  assert.throws(() => setup({manifest, chapter: '1-1'}), /Invalid chapter voice manifest entry/);
  const empty = fixture();
  empty.items[0] = item(3, 1001); empty.items[1] = item(3, 1002); empty.items[2] = item(3, 1003);
  assert.throws(() => setup({manifest: empty}), /Incomplete subsection voice manifest/);
});

test('hash verification uses original bytes and immutable expected hash metadata', async () => {
  const manifest = fixture(), session = setup({manifest}), source = session.files()[0];
  await session.verify(source, bytes);
  manifest.items[0].sha256 = '0'.repeat(64);
  await session.verify(source, bytes);
  await assert.rejects(session.verify(source, new Uint8Array([9])), /Audio hash mismatch/);
  await session.verify('game/vocal/amb_rain_r16.mp3', new Uint8Array([9]));
});

test('assets bypass crypto entirely; voice cannot count as successful without SHA-256 support', async () => {
  const absent = setup({cryptoProvider: null});
  await absent.verify('game/figure/a.png', bytes);
  await assert.rejects(absent.verify(absent.files()[0], bytes), /SHA-256 verification is unavailable/);
});

test('combined progress deduplicates assets and voice and includes unfinished voice in its denominator', () => {
  const session = setup(), voices = session.files(), assets = ['game/figure/a.png', 'game/bgm/b.mp3'];
  assert.deepEqual(session.stats(new Set(assets), assets),
    {completed: 2, total: 5, voiceCompleted: 0, voiceTotal: 3});
  const loaded = new Set([...assets, voices[0], 'unrelated']);
  assert.deepEqual(session.stats(loaded, [...assets, assets[0], voices[0]]),
    {completed: 3, total: 5, voiceCompleted: 1, voiceTotal: 3});
  session.disable();
  assert.deepEqual(session.stats(loaded, [...assets, ...voices]),
    {completed: 2, total: 2, voiceCompleted: 0, voiceTotal: 0});
});

test('disable aborts only registered voice requests, skips queued voice, and notifies exactly once', () => {
  const changes = [], session = setup({onEnabledChange: enabled => changes.push(enabled)});
  const [first, second] = session.files(), voice = new AbortController(), asset = new AbortController();
  session.register(first, voice); session.register('game/figure/a.png', asset);
  assert.equal(session.isSkipped(first), false);
  session.disable(); session.disable();
  assert.equal(voice.signal.aborted, true); assert.equal(asset.signal.aborted, false);
  assert.equal(session.isSkipped(first), true); assert.equal(session.isSkipped(second), true);
  assert.equal(session.isSkipped('game/figure/a.png'), false);
  assert.deepEqual(session.files(), []); assert.deepEqual(changes, [false]);
  const late = new AbortController(); session.register(second, late);
  assert.equal(late.signal.aborted, true);
});

test('unregister is idempotent and leaves completed voice requests alone when disabling', () => {
  const session = setup(), first = new AbortController(), second = new AbortController();
  const source = session.files()[0];
  const unregister = session.register(source, first);
  session.register(source, second); unregister(); unregister();
  session.disable();
  assert.equal(first.signal.aborted, false); assert.equal(second.signal.aborted, true);
});

test('disable interrupts an ignored pending digest immediately and late results cannot succeed', async () => {
  const pending = deferred();
  const session = setup({cryptoProvider: {subtle: {digest: () => pending.promise}}});
  const file = session.files()[0], verification = session.verify(file, bytes);
  session.disable();
  await assert.rejects(verification, {name: 'AbortError'});
  pending.resolve(await webcrypto.subtle.digest('SHA-256', bytes)); await tick();
  await assert.rejects(session.verify(file, bytes), {name: 'AbortError'});
});

test('disposing cancels registered voice and pending verification without persisting OFF or notifying', async () => {
  const pending = deferred(), changes = [], controller = new AbortController();
  const session = setup({cryptoProvider: {subtle: {digest: () => pending.promise}},
    onEnabledChange: value => changes.push(value)});
  const file = session.files()[0];
  session.register(file, controller);
  const verification = session.verify(file, bytes);
  session.dispose(); session.dispose(); session.disable();
  await assert.rejects(verification, {name: 'AbortError'});
  assert.equal(controller.signal.aborted, true); assert.deepEqual(changes, []); assert.deepEqual(session.files(), []);
  pending.reject(Error('late failure')); await tick();
});

test('a new session remains independent of a stale cancelled session', async () => {
  const pending = deferred(), old = setup({cryptoProvider: {subtle: {digest: () => pending.promise}}});
  const first = old.verify(old.files()[0], bytes);
  old.dispose(); await assert.rejects(first, {name: 'AbortError'});
  const next = setup({chapter: '1-2'});
  await next.verify(next.files()[0], bytes);
  pending.resolve(await webcrypto.subtle.digest('SHA-256', bytes)); await tick();
  assert.equal(next.files().length, 2);
  assert.deepEqual(next.stats(new Set(), []), {completed: 0, total: 2, voiceCompleted: 0, voiceTotal: 2});
});

test('production manifest partitions the original 938 WAV references into the seven existing subsections', () => {
  const manifest = JSON.parse(readFileSync(new URL('../game/chapter1-voice-manifest.json', import.meta.url)));
  const original = JSON.stringify(manifest), all = new Set(), counts = [79, 126, 188, 147, 57, 276, 65];
  for (let section = 1; section <= 7; section++) {
    const session = setup({manifest, chapter: `1-${section}`});
    const expected = manifest.items.filter(item => item.taskId.startsWith(`KOTO-C1-${section}-`));
    assert.deepEqual(session.files(), expected.map(item => item.src));
    assert.equal(session.files().length, counts[section - 1]);
    for (const file of session.files()) { assert.ok(file.endsWith('.wav')); assert.equal(all.has(file), false); all.add(file); }
  }
  assert.equal(all.size, 938); assert.equal(JSON.stringify(manifest), original);
});
