// Voice-only helpers for the existing chapter loader. No fetch queue, prompt,
// storage, cache, or service worker is duplicated here.
const chapterPattern = /^1-([1-7])$/;
const taskPattern = /^KOTO-C1-[1-7]-l_\d+-s\d+$/;
const abortError = () => Object.assign(new Error('Voice preload cancelled'), {name: 'AbortError'});
const safeVoice = item => item && taskPattern.test(item.taskId) &&
  ['available_emotion_candidate', 'available_approved'].includes(item.status) &&
  /^[a-f0-9]{64}$/.test(item.sha256 || '') &&
  /^game\/vocal\/chapter1\/[A-Za-z0-9_./-]+\.(wav|mp3|opus)$/.test(item.src || '') &&
  !item.src.split('/').some(part => part === '..' || part === '.' || !part);

function selectedItems(manifest, section) {
  if (manifest?.available !== 938 || manifest?.pending !== 0 ||
      !Array.isArray(manifest?.items) || manifest.items.length !== 938) {
    throw new Error('Incomplete chapter voice manifest');
  }
  const ids = new Set(), sources = new Set();
  for (const item of manifest.items) {
    if (!safeVoice(item) || ids.has(item.taskId) || sources.has(item.src)) {
      throw new Error('Invalid chapter voice manifest entry');
    }
    ids.add(item.taskId); sources.add(item.src);
  }
  const prefix = `KOTO-C1-${section}-`;
  const selected = manifest.items.filter(item => item.taskId.startsWith(prefix));
  if (!selected.length) throw new Error('Incomplete subsection voice manifest');
  return selected;
}

function cancellableDigest(operation, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, {once: true});
    // Always observe late digest rejection; a late result cannot revive a session.
    Promise.resolve(operation).then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}

/**
 * Add files() to the existing loader's asset queue, retaining its concurrency.
 * For each job: const unregister = session.register(file, requestController);
 * read the complete body, await session.verify(file, bytes), then count success.
 * Always unregister in finally, and check isSkipped(file) before scheduling or
 * counting a voice. stats(loadedSet, assetFiles) supplies the combined progress.
 *
 * Unsupported chapters are inert. OFF works without loading a voice manifest.
 * ON requires the existing complete 938-item manifest but selects only 1-N.
 * Source paths, hashes, formats and bytes are never rewritten. Persistence stays
 * with the existing HTTP/SW force-cache route and the player's hash verification.
 */
export function createVoicePreloadSession({manifest, chapter, enabled = true,
  cryptoProvider = globalThis.crypto, onEnabledChange = () => {}} = {}) {
  const match = chapterPattern.exec(String(chapter));
  const items = match && (enabled || manifest != null) ? selectedItems(manifest, match[1]) : [];
  // Snapshot integrity metadata so later caller mutation cannot alter verification.
  const byFile = new Map(items.map(item => [item.src, {sha256: item.sha256, taskId: item.taskId}]));
  const controllers = new Set(), stop = new AbortController();
  let active = Boolean(match && enabled), disposed = false;
  const isVoice = file => byFile.has(file);
  const isSkipped = file => isVoice(file) && (!active || disposed);
  const files = () => active && !disposed ? [...byFile.keys()] : [];
  const ensureVoiceActive = () => { if (!active || disposed) throw abortError(); };

  function register(file, controller) {
    if (!isVoice(file)) return () => {};
    if (!controller || typeof controller.abort !== 'function') throw new TypeError('Voice request requires an AbortController');
    if (!active || disposed) { controller.abort(); return () => {}; }
    controllers.add(controller);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      controllers.delete(controller);
    };
  }

  async function verify(file, bytes) {
    if (!isVoice(file)) return;
    ensureVoiceActive();
    if (!cryptoProvider?.subtle?.digest) throw new Error('SHA-256 verification is unavailable');
    const digest = await cancellableDigest(cryptoProvider.subtle.digest('SHA-256', bytes), stop.signal);
    ensureVoiceActive();
    const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    const expected = byFile.get(file);
    if (actual !== expected.sha256) throw new Error(`Audio hash mismatch: ${expected.taskId}`);
  }

  function stopVoice() {
    stop.abort();
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }
  function disable() {
    if (!active || disposed) return;
    active = false;
    stopVoice();
    onEnabledChange(false);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stopVoice();
  }
  function stats(loadedSet = new Set(), assetFiles = []) {
    const loaded = loadedSet instanceof Set ? loadedSet : new Set(loadedSet);
    const voiceFiles = files();
    // A disabled voice must not sneak back into the denominator via a combined
    // list. Normal ambient vocals/BGM remain ordinary assets.
    const assets = [...new Set(assetFiles)].filter(file => !isVoice(file));
    const work = new Set([...assets, ...voiceFiles]);
    let completed = 0, voiceCompleted = 0;
    for (const file of work) if (loaded.has(file)) completed++;
    for (const file of voiceFiles) if (loaded.has(file)) voiceCompleted++;
    return {completed, total: work.size, voiceCompleted, voiceTotal: voiceFiles.length};
  }
  return {files, isVoice, isSkipped, register, verify, disable, stats, dispose};
}
