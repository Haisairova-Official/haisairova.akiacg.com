import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const origin = 'https://game.test';
const base = `${origin}/kotonoha2/`;
const baselineCommit = '907c57ac5a616d8d95f2af044f5bf34639ea9d85';
const oldRevision = 'd6ca37c52d57';
const newRevision = '7aa7ac9230b2';
const names = ['index', 'index.es', 'initRegister', 'live2dAssets', 'spineAssets'];
const buildCache = 'kotonoha-c11-build-assets-r5';
const mediaCache = 'kotonoha-c2-local-media-v12-monster-behind-cast';
const read = path => readFileSync(new URL(path, root), 'utf8');
const head = path => execFileSync('git', ['show', `${baselineCommit}:kotonoha2/${path}`], {
  cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
const modulePath = (name, revision) => `assets/${name}-${revision}.js`;
const href = path => new URL(path, base).href;
const oldIndex = head('index.html');
const oldModules = new Map(names.map(name => [modulePath(name, oldRevision), head(modulePath(name, oldRevision))]));
const newModules = new Map(names.map(name => [modulePath(name, newRevision), read(modulePath(name, newRevision))]));

// This fake implements only the browser Cache API surface the real workers use.
// Responses are cloned on both reads and writes, just like Cache Storage.
function cacheStorage() {
  const stores = new Map();
  const deleted = [];
  const key = request => typeof request === 'string' ? href(request) : request.url;
  return {
    stores, deleted,
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request, response) { entries.set(key(request), response.clone()); },
      };
    },
  };
}

function network(files = []) {
  const resources = new Map(files.map(([path, body]) => [href(path), body]));
  const requests = [];
  let offline = false;
  return {
    resources, requests,
    setOffline(value = true) { offline = value; },
    async fetch(request) {
      const url = typeof request === 'string' ? href(request) : request.url;
      requests.push(url);
      if (offline) throw new TypeError('Network is offline');
      if (!resources.has(url)) return new Response('Not found', {status: 404});
      return new Response(resources.get(url), {status: 200});
    },
  };
}

function request(path, overrides = {}) {
  return {url: href(path), method: 'GET', headers: new Headers(), mode: 'cors', destination: 'script', ...overrides};
}

function worker(path, caches, net) {
  const listeners = new Map();
  const lifecycle = {skipWaiting: 0, claim: 0};
  const self = {
    location: {origin},
    addEventListener(type, callback) { listeners.set(type, callback); },
    async skipWaiting() { lifecycle.skipWaiting++; },
    clients: {async claim() { lifecycle.claim++; }},
  };
  runInNewContext(read(path), {
    self, caches, fetch: net.fetch, URL, Response, Headers, console: {log() {}},
  }, {filename: path});
  return {
    lifecycle,
    async dispatchLifecycle(type) {
      const pending = [];
      listeners.get(type)?.({waitUntil(promise) { pending.push(promise); }});
      await Promise.all(pending);
    },
    dispatchFetch(req) {
      let response;
      let intercepted = false;
      listeners.get('fetch')({
        request: req,
        respondWith(promise) {
          assert.equal(intercepted, false, 'respondWith must be called only once');
          intercepted = true;
          response = Promise.resolve(promise);
        },
      });
      return {intercepted, response};
    },
    async fetch(req) {
      const result = this.dispatchFetch(req);
      return result.intercepted ? result.response : net.fetch(req);
    },
  };
}

async function seedOldCache(caches, name = buildCache) {
  const cache = await caches.open(name);
  for (const [path, source] of oldModules) await cache.put(href(path), new Response(source));
  // Deliberately seed navigation entries too. The real old worker never cached
  // these, but even a pre-existing stale index must not become an app-shell hit.
  await cache.put(href('./'), new Response(oldIndex));
  await cache.put(href('index.html'), new Response(oldIndex));
  return cache;
}

function dependencies(source, revision) {
  const escaped = revision.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`["']\\./([^"'\\s]+-${escaped}\\.js)["']`, 'g');
  return [...new Set([...source.matchAll(pattern)].map(match => match[1]))].sort();
}

test('release graph has one new engine, keeps five original HEAD files, and only relinks child modules', () => {
  for (const [path, source] of oldModules) {
    assert.equal(read(path), source, `${path} must remain byte-identical to HEAD`);
  }
  for (const [path, source] of newModules) {
    assert.equal(source.includes(oldRevision), false, `${path} must not import the old graph`);
    const name = names.find(value => path === modulePath(value, newRevision));
    if (name !== 'index') {
      assert.equal(source.replaceAll(newRevision, oldRevision), oldModules.get(modulePath(name, oldRevision)),
        `${name} must change only its engine reference`);
      assert.deepEqual(dependencies(source, newRevision), [`index-${newRevision}.js`]);
    } else {
      assert.deepEqual(dependencies(source, newRevision), names.slice(1).map(child => `${child}-${newRevision}.js`).sort());
      assert.ok(source.includes('prepareChapterVoice'), 'new engine includes the existing-loader voice integration');
    }
  }
  const html = read('index.html');
  const runtime = read('game/chapter1-voice-runtime.js');
  const entry = /<script\b[^>]*src=["']\.\/assets\/(index-[^"']+\.js)["']/.exec(html);
  assert.equal(entry?.[1], `index-${newRevision}.js`);
  assert.ok(runtime.includes(`from '../assets/index-${newRevision}.js'`));
  assert.equal(runtime.includes(oldRevision), false);
  assert.ok(html.includes(`./game/chapter1-voice-runtime.js?v=${newRevision}`), 'runtime URL must bypass a stale HTTP-cached import');
});

test('actual old build worker keeps old index/engine cache but fetches the entire new graph and serves it offline', async () => {
  const caches = cacheStorage();
  const oldCache = await seedOldCache(caches);
  const net = network([...newModules, ['index.html', read('index.html')]]);
  const sw = worker('webgal-serviceworker.js', caches, net);
  await sw.dispatchLifecycle('install');
  await sw.dispatchLifecycle('activate');
  assert.deepEqual(sw.lifecycle, {skipWaiting: 1, claim: 1});
  assert.deepEqual(caches.deleted, [], 'no migration purge is needed');

  // Establish the failure baseline: the unchanged old URL really is stale.
  const oldEngine = modulePath('index', oldRevision);
  assert.equal(await (await sw.fetch(request(oldEngine))).text(), oldModules.get(oldEngine));
  assert.equal(net.requests.length, 0);
  assert.equal(await (await oldCache.match(href('index.html'))).text(), oldIndex);

  // A returning visitor requests the new document without unregistering the SW
  // or clearing the deliberately warmed old document or asset entries.
  const navigation = request('index.html', {mode: 'navigate', destination: 'document'});
  assert.equal(sw.dispatchFetch(navigation).intercepted, false);
  assert.equal(await (await sw.fetch(navigation)).text(), read('index.html'));
  const beforeGraph = net.requests.length;
  for (const [path, source] of newModules) {
    const result = sw.dispatchFetch(request(path));
    assert.equal(result.intercepted, true);
    assert.equal(await (await result.response).text(), source);
  }
  assert.deepEqual(net.requests.slice(beforeGraph), [...newModules.keys()].map(href));
  const afterWarmup = net.requests.length;
  net.setOffline();
  for (const [path, source] of newModules) assert.equal(await (await sw.fetch(request(path))).text(), source);
  assert.equal(net.requests.length, afterWarmup, 'all five offline hits must avoid network');
  assert.equal(await (await oldCache.match(href(oldEngine))).text(), oldModules.get(oldEngine), 'old graph remains intact');
  assert.equal(await (await oldCache.match(href('index.html'))).text(), oldIndex, 'stale cached index remains unused');
});

test('neither actual worker intercepts navigation, index, formal runtime or unrelated requests, even with old index cached', async () => {
  for (const workerPath of ['webgal-serviceworker.js', 'chapter-cache.js']) {
    const caches = cacheStorage();
    await seedOldCache(caches);
    await seedOldCache(caches, mediaCache);
    const runtimePath = `game/chapter1-voice-runtime.js?v=${newRevision}`;
    const net = network([['./', read('index.html')], ['index.html', read('index.html')], [runtimePath, read('game/chapter1-voice-runtime.js')]]);
    const sw = worker(workerPath, caches, net);
    await sw.dispatchLifecycle('activate');
    for (const req of [
      request('./', {mode: 'navigate', destination: 'document'}),
      request('index.html', {mode: 'navigate', destination: 'document'}),
      request('index.html'),
      request(runtimePath),
      request('game/chapter1-preload.mjs'),
      request(modulePath('index', newRevision), {method: 'POST'}),
      request(`https://other.test/${modulePath('index', newRevision)}`),
    ]) assert.equal(sw.dispatchFetch(req).intercepted, false, `${workerPath} must bypass ${req.method} ${req.url}`);
    assert.equal(await (await sw.fetch(request('index.html', {mode: 'navigate', destination: 'document'}))).text(), read('index.html'));
    assert.equal(await (await sw.fetch(request(runtimePath))).text(), read('game/chapter1-voice-runtime.js'));
    net.setOffline();
    await assert.rejects(sw.fetch(request('index.html', {mode: 'navigate', destination: 'document'})), /offline/,
      'an old cached index must not turn into an offline navigation response');
    assert.deepEqual(caches.deleted, [], `${workerPath} must preserve these existing caches`);
  }
});

test('actual chapter worker leaves build graph alone and reuses warmed media, including ranges, offline', async () => {
  const caches = cacheStorage();
  const oldCache = await seedOldCache(caches);
  const mediaPath = 'game/vocal/chapter1/cache-migration-fixture.wav';
  const bytes = new Uint8Array([10, 20, 30, 40, 50, 60]);
  const net = network([...newModules, [mediaPath, bytes]]);
  const sw = worker('chapter-cache.js', caches, net);
  await sw.dispatchLifecycle('install');
  await sw.dispatchLifecycle('activate');
  assert.deepEqual(sw.lifecycle, {skipWaiting: 1, claim: 1});
  for (const [path, source] of newModules) {
    assert.equal(sw.dispatchFetch(request(path)).intercepted, false);
    assert.equal(await (await sw.fetch(request(path))).text(), source);
  }
  const media = sw.dispatchFetch(request(mediaPath));
  assert.equal(media.intercepted, true);
  assert.deepEqual(new Uint8Array(await (await media.response).arrayBuffer()), bytes);
  const afterWarmup = net.requests.length;
  net.setOffline();
  assert.deepEqual(new Uint8Array(await (await sw.fetch(request(mediaPath))).arrayBuffer()), bytes);
  const partial = await sw.fetch(request(mediaPath, {headers: new Headers({range: 'bytes=1-3'})}));
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('content-range'), 'bytes 1-3/6');
  assert.deepEqual(new Uint8Array(await partial.arrayBuffer()), bytes.slice(1, 4));
  assert.equal(net.requests.length, afterWarmup, 'offline media and range hits must avoid network');
  assert.equal(await (await oldCache.match(href('index.html'))).text(), oldIndex);
  assert.deepEqual(caches.deleted, [], 'chapter worker does not delete old build caches');
});
