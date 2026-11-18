/* Antalya Transfer – telefondaki kayıt deposu.
 * Sayfanın kullandığı küçük veritabanı arayüzünü (collection/doc, onSnapshot, set/update/delete)
 * telefonun kendi dosya alanına (AndroidBridge.saveData) ve yedek olarak localStorage'a yazar.
 * İnternet kullanılmaz; kayıtlar yalnızca bu telefonda durur.
 */
(function () {
  'use strict';
  var NB = window.AndroidBridge || null;
  var COLS = ['kisiler', 'seferler', 'meta'];
  var KEY = function (c) { return 'antalya-transfer-2026:' + c; };

  function readRaw(c) {
    var s = '';
    try { if (NB && NB.loadData) s = NB.loadData(c) || ''; } catch (e) { s = ''; }
    if (!s) { try { s = localStorage.getItem(KEY(c)) || ''; } catch (e) { s = ''; } }
    if (!s) return {};
    try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
  }

  var store = {};
  COLS.forEach(function (c) { store[c] = readRaw(c); });

  var dirty = {}, timer = 0;
  window.__kayitHatasi = false;
  function persist() {
    timer = 0;
    Object.keys(dirty).forEach(function (c) {
      var s = JSON.stringify(store[c]), ok = false;
      try { if (NB && NB.saveData) ok = NB.saveData(c, s); } catch (e) { ok = false; }
      try { localStorage.setItem(KEY(c), s); if (!NB) ok = true; } catch (e) { /* yer yok */ }
      if (window.__kayitHatasi !== !ok) { window.__kayitHatasi = !ok; try { window.dispatchEvent(new Event('kayitdurum')); } catch (e) { /* yok say */ } }
    });
    dirty = {};
  }
  window.flushNow = function () { if (timer) { clearTimeout(timer); } persist(); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) window.flushNow(); });
  window.addEventListener('pagehide', function () { window.flushNow(); });
  function touch(c) { dirty[c] = 1; if (!timer) timer = setTimeout(persist, 150); }

  var isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v); };
  function merge(a, b) {
    var o = Object.assign({}, a || {});
    Object.keys(b).forEach(function (k) {
      var v = b[k];
      if (isObj(v) && v.__delete__) delete o[k];
      else if (isObj(v) && isObj(o[k])) o[k] = merge(o[k], v);
      else o[k] = v;
    });
    return o;
  }
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };

  var listeners = [];
  var META = { fromCache: false, hasPendingWrites: false };
  function docSnap(c, id) {
    var v = store[c] && store[c][id];
    return { id: id, exists: !!v, data: function () { return v; }, metadata: META };
  }
  function collSnap(c) {
    var docs = Object.keys(store[c] || {}).sort().map(function (id) { return docSnap(c, id); });
    return { docs: docs, size: docs.length, empty: !docs.length, metadata: META, docChanges: function () { return []; } };
  }
  function notify(c) {
    listeners.forEach(function (l) {
      if (l.c !== c) return;
      setTimeout(function () { l.cb(l.id ? docSnap(c, l.id) : collSnap(c)); }, 0);
    });
  }
  function split(path) {
    var p = String(path).split('/');
    if (p.length !== 2 || COLS.indexOf(p[0]) < 0 || !p[1]) throw new TypeError('Geçersiz kayıt yolu: ' + path);
    return p;
  }
  var err = function (code, message) { return { code: code, message: message }; };

  function docRef(path) {
    var p = split(path), c = p[0], id = p[1];
    return {
      id: id, path: path,
      get: function () { return Promise.resolve(docSnap(c, id)); },
      set: function (data) { store[c][id] = clone(data); touch(c); notify(c); return Promise.resolve(); },
      update: function (data) {
        if (!store[c][id]) return Promise.reject(err('invalid_argument', 'Kayıt bulunamadı'));
        store[c][id] = merge(store[c][id], clone(data)); touch(c); notify(c); return Promise.resolve();
      },
      delete: function () { delete store[c][id]; touch(c); notify(c); return Promise.resolve(); },
      onSnapshot: function (cb) {
        var l = { c: c, id: id, cb: cb }; listeners.push(l);
        setTimeout(function () { cb(docSnap(c, id)); }, 0);
        return function () { var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
      }
    };
  }
  var db = {
    doc: docRef,
    collection: function (c) {
      if (COLS.indexOf(c) < 0) throw new TypeError('Geçersiz koleksiyon: ' + c);
      return {
        path: c,
        doc: function (id) { return docRef(c + '/' + id); },
        onSnapshot: function (cb) {
          var l = { c: c, cb: cb }; listeners.push(l);
          setTimeout(function () { cb(collSnap(c)); }, 0);
          return function () { var i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
        }
      };
    },
    /** Yedekten geri yükleme: tüm kayıtların yerine geçer */
    replaceAll: function (data) {
      COLS.forEach(function (c) { store[c] = clone(data[c] || {}); dirty[c] = 1; });
      window.flushNow();
      COLS.forEach(notify);
    },
    counts: function () { return { kisiler: Object.keys(store.kisiler).length, seferler: Object.keys(store.seferler).length }; }
  };
  window.YEREL = db;
  window.claude = { use: function (n) { return Promise.resolve(n === 'db' ? db : null); } };
})();
