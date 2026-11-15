/* Donör Takip – arayüz */
(function () {
  'use strict';
  var KEY = 'donorTakip.v1', PREV = 'donorTakip.onceki';
  var qs = new URLSearchParams(location.search);
  if (qs.get('today')) { var tq = DT.fromIso(qs.get('today')); if (tq) window.__TODAY = tq; }
  var NB = window.AndroidBridge || null;
  var S = DT.S, fold = DT.fold, eqi = DT.eqi;

  var state, D = [], pool = [], today, byId = {}, holMap = {};
  var ui = {
    search: '', dfilter: 'all', dsort: 'new', dlimit: 60,
    calY: null, calM: null, calSel: null, calP: '',
    progDate: null, alBase: null, alP: '', tkP: '', utYil: '', dashYil: null, dashAy: '', ekPast: false,
    weekStart: null, hwP: '', ajDate: null, rpF: 'all', rpH: '', rpY: '', rpLimit: 80,
    scroll: {}
  };

  /* ---------------- yardımcılar ---------------- */
  function h(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  var view = $('#view');
  function pct(v) { return v == null ? '–' : (Math.round(v * 1000) / 10).toLocaleString('tr-TR') + '%'; }
  function num(v) { return v == null ? '–' : (typeof v === 'number' ? v.toLocaleString('tr-TR') : v); }
  function upperTR(s) { return S(s).toLocaleUpperCase('tr-TR'); }
  function telHref(t) { var d = S(t).replace(/[^\d+]/g, ''); return d ? 'tel:' + d : ''; }
  function gunAd(s) { return DT.gun(s); }
  function dateLong(s) { return DT.fmt(s) + ' · ' + gunAd(s); }
  function isOffDay(s) { return DT.weekday(s) >= 6 || !!holMap[s]; }

  var I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.6 3.3-5.5 6.5-5.5s5.8 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/></svg>',
    track: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.4.4 0 0 0 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.7-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>'
  };

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function busy(on, msg) {
    var b = $('#busy');
    if (on) { if (!b) { b = document.createElement('div'); b.id = 'busy'; b.className = 'busy'; document.body.appendChild(b); } b.innerHTML = '<div><div class="spin"></div>' + h(msg || 'Lütfen bekleyin…') + '</div>'; }
    else if (b) b.remove();
  }
  var sheetOnClose = null;
  function openSheet(html, onClose) {
    var s = $('#sheet');
    s.innerHTML = '<div class="scrim" data-act="closeSheet"></div><div class="panel"><div class="grab"></div>' + html + '</div>';
    s.hidden = false; sheetOnClose = onClose || null;
  }
  function closeSheet() { var s = $('#sheet'); if (s.hidden) return false; s.hidden = true; s.innerHTML = ''; var f = sheetOnClose; sheetOnClose = null; if (f) f(); return true; }
  function confirmSheet(title, text, okLabel, danger, onOk) {
    openSheet('<h3>' + h(title) + '</h3><div class="sub">' + h(text) + '</div><div class="btns"><button class="btn" data-act="closeSheet">Vazgeç</button>' +
      '<button class="btn ' + (danger ? 'danger' : 'pri') + '" id="cfOk">' + h(okLabel) + '</button></div>');
    $('#cfOk').onclick = function () { closeSheet(); onOk(); };
  }

  /* ---------------- veri ---------------- */
  function load() {
    try { var s = localStorage.getItem(KEY); state = s ? migrate(JSON.parse(s)) : DT.newState(window.DT_DEFAULT_LISTS); }
    catch (e) { console.error(e); state = DT.newState(window.DT_DEFAULT_LISTS); }
  }
  function migrate(s) {
    var base = DT.newState(window.DT_DEFAULT_LISTS);
    s.donors = s.donors || []; s.overrides = s.overrides || {}; s.ekGorevler = s.ekGorevler || []; s.ekKons = s.ekKons || []; s.ajanda = s.ajanda || [];
    s.settings = Object.assign({}, base.settings, s.settings || {});
    s.lists = Object.assign({}, base.lists, s.lists || {});
    s.lists.prog = Object.assign({}, base.lists.prog, s.lists.prog || {});
    s.donors.forEach(function (d) { if (!d.id) d.id = DT.uid(); });
    return s;
  }
  var saveTimer;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Kayıt yapılamadı: depolama dolu olabilir.'); }
  }
  function recompute() {
    today = DT.today();
    D = DT.derive(state, today);
    pool = DT.buildPool(state, D);
    byId = {}; D.forEach(function (x) { byId[x.d.id] = x; });
    holMap = DT.holidayMap(state.lists);
  }
  function commit(keepScroll) { save(); recompute(); render(keepScroll !== false); }

  /* ---------------- yönlendirme ---------------- */
  function route() { return (location.hash || '#/').slice(1).split('?')[0].split('/').filter(Boolean); }
  function go(hash, replace) {
    if (replace) location.replace('#' + hash); else location.hash = hash;
  }
  var NAVY = '#1F3A5F';
  var GROUPS = {
    planlama: { ad: 'PLANLAMA', renk: '#2F6FB0', acik: '#E3EDF8', alt: 'Günlük ve haftalık iş planı', pages: [
      ['/plan/takvim', 'Takvim', 'Aylık görünüm: her günün görevleri'], ['/plan/program', 'Çalışma Programı', 'Yarının programı, WhatsApp metni'],
      ['/plan/haftalik', 'Haftalık Program', 'Haftanın görevleri: gün gün liste'], ['/plan/hplan', 'Haftalık Plan', 'Hafta defteri: görevler, personel, notlar', 1],
      ['/plan/ajanda', 'Ajanda', 'Saatli notlar, programa eklenecek işler'], ['/plan/uyarilar', 'Görev Listesi', 'Geri sayım uyarıları']] },
    takip: { ad: 'TAKİP', renk: '#1E6B3A', acik: '#E2F1E7', alt: 'Donörlerin süreç takibi', pages: [
      ['/takip/saglik', 'Sağlık Kontrolü Takip', 'Sağlık kontrolü yaklaşan donörler'], ['/takip/asi', 'Aşı Takip', 'Aşıdaki ve aşıya başlayacak donörler'],
      ['/takip/toplama', 'Toplama Takip', 'Toplaması yaklaşan donörler'], ['/takip/tasima', 'Ürün Taşıma', 'Taşınacak ürünler ve taşıyan personel'],
      ['/takip/ekkons', 'Ek Konsültasyon', 'Ek konsültasyona gidecek donörler'], ['/takip/sonizlem', 'Son İzlem Takip', 'Son izlem tarihi yaklaşan donörler'],
      ['/takip/idm', 'IDM', 'IDM tarih aralığı işaretlenen donörler']] },
    arsiv: { ad: 'DONÖR KAYIT VE ARŞİV', renk: '#8A6D0B', acik: '#F5EEDA', alt: 'Donör kayıtları, raporlar ve arşiv', pages: [
      ['/donorler', 'Donör Kayıt', 'Donör bilgileri: ana tablo'], ['/arsiv/rapor', 'Donör Raporu', 'Yöneticiye gönderilecek temiz kopya'],
      ['/arsiv/kapanis', 'Haftalık Kapanış', 'Haftayı kapatıp görevleri arşive aktarma', 1], ['/arsiv/gorev', 'Görev Kayıtları', 'Personel görev arşivi', 1],
      ['/arsiv/tasima', 'Taşıma Kayıtları', 'Ürün taşıma arşivi', 1], ['/arsiv/kilavuz', 'Kılavuz', 'Sayfaların kullanım açıklamaları'],
      ['/ayarlar/listeler', 'Listeler', 'Personel, hastane ve açılır listeler']] },
    dashboard: { ad: 'DASHBOARD', renk: '#5B3A8C', acik: '#ECE5F5', alt: 'İstatistikler ve grafikler', pages: [
      ['/dashboard', 'Dashboard', 'Donör ve görev istatistikleri, grafikler'], ['/dash/isyuku', 'İş Yükü', 'Personel iş yükü', 1],
      ['/dash/tasima', 'Taşıma İstatistiği', 'Ürün taşıma istatistikleri', 1]] }
  };
  function groupOf(path) {
    if (path === '/' || path === '') return null;
    var k = path.split('/')[1];
    if (k === 'g') return path.split('/')[2];
    if (k === 'plan') return 'planlama';
    if (k === 'takip') return 'takip';
    if (k === 'donorler' || k === 'donor' || k === 'arsiv' || path === '/ayarlar/listeler') return 'arsiv';
    if (k === 'dashboard' || k === 'dash') return 'dashboard';
    return null;
  }
  var TABS = [['home', '/', 'Ana Sayfa', I.home], ['planlama', '/g/planlama', 'Planlama', I.cal], ['takip', '/g/takip', 'Takip', I.track],
    ['arsiv', '/g/arsiv', 'Donör Kayıt', I.users], ['dashboard', '/g/dashboard', 'Dashboard', I.chart]];
  function groupSeg(key, cur) {
    return '<div class="seg">' + GROUPS[key].pages.filter(function (pg) { return !pg[3]; }).map(function (pg) {
      return '<button class="' + (pg[0] === cur ? 'on' : '') + '" data-act="goto" data-h="' + pg[0] + '" data-replace="1">' + h(pg[1]) + '</button>';
    }).join('') + '</div>';
  }

  function render(keepScroll) {
    var p = route(), out;
    var top = keepScroll ? view.scrollTop : null;
    try {
      if (p.length === 0) out = scrHome();
      else if (p[0] === 'g' && GROUPS[p[1]]) out = scrGroup(p[1]);
      else if (p[0] === 'arsiv' && p[1] === 'rapor') out = scrRapor();
      else if (p[0] === 'arsiv' && p[1] === 'kilavuz') out = scrKilavuz();
      else if (p[0] === 'donorler') out = scrDonors();
      else if (p[0] === 'donor' && p[1] === 'yeni') out = scrDonorForm(null);
      else if (p[0] === 'donor' && p[2] === 'duzenle') out = scrDonorForm(p[1]);
      else if (p[0] === 'donor') out = scrDonor(p[1]);
      else if (p[0] === 'plan') out = scrPlan(p[1] || 'takvim');
      else if (p[0] === 'takip') out = scrTakip(p[1] || 'saglik');
      else if (p[0] === 'dashboard') out = scrDash();
      else if (p[0] === 'ayarlar' && p[1] === 'listeler') out = scrLists();
      else if (p[0] === 'ayarlar') out = scrSettings();
      else out = scrHome();
    } catch (e) {
      console.error(e);
      out = { title: 'Hata', html: '<div class="page"><div class="card pad"><b>Bir hata oluştu.</b><div class="small muted">' + h(e.message) + '</div></div></div>' };
    }
    var gk = groupOf('/' + p.join('/'));
    document.documentElement.style.setProperty('--g', gk ? GROUPS[gk].renk : NAVY);
    document.documentElement.style.setProperty('--g-soft', gk ? GROUPS[gk].acik : '#E4E9F0');
    $('#title').textContent = out.title;
    $('#btnBack').hidden = !(out.back || (p.length && p[0] !== 'g'));
    $('#topActions').innerHTML = out.actions || '';
    view.innerHTML = out.html;
    var tab = gk || 'home';
    $('#tabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    view.scrollTop = top != null ? top : (ui.scroll[location.hash] || 0);
    if (out.after) out.after();
  }

  /* ---------------- ortak parçalar ---------------- */
  function persOptions(sel, emptyLabel) {
    var o = emptyLabel != null ? '<option value="">' + h(emptyLabel) + '</option>' : '';
    state.lists.personel.forEach(function (p) { o += '<option' + (eqi(p, sel) ? ' selected' : '') + '>' + h(p) + '</option>'; });
    return o;
  }
  function listOptions(list, sel, emptyLabel) {
    var found = false, o = '<option value="">' + h(emptyLabel || '— seçin —') + '</option>';
    list.forEach(function (v) { var on = eqi(v, sel); if (on) found = true; o += '<option' + (on ? ' selected' : '') + '>' + h(v) + '</option>'; });
    if (sel && !found) o += '<option selected>' + h(sel) + '</option>';
    return o;
  }
  function durumCls(s) {
    if (!s) return 'p-grey';
    if (s.indexOf('Süreç durdu') === 0) return 'p-grey';
    if (s === 'Toplama yapıldı') return 'p-top';
    if (s === 'Aşı sürecinde') return 'p-asi';
    if (s === 'Toplama planlandı') return 'p-tas';
    if (s.indexOf('Sağlık') === 0) return 'p-sk';
    return 'p-pri';
  }
  function kindName(k) { return { sk: 'Sağlık kontrolü', asi: 'Aşı', top: 'Toplama', tas: 'Ürün taşıma', yat: 'Hastane yatış' }[k]; }
  function taskTitle(x, t) {
    if (t.slot >= 2 && t.slot <= 5 && x.sabahAksam) return 'AŞI (' + t.gun + '. gün) · SABAH-AKŞAM';
    if (t.slot === 7) return 'ÜRÜN TAŞIMA · ' + t.islem;
    return t.islem;
  }
  function taskSlots(x, t) { return (t.slot >= 2 && t.slot <= 5 && x.sabahAksam) ? [t.slot, t.slot + 7] : [t.slot]; }
  function whoBtn(x, t) {
    if (t.slot === 7 && t.yd) return '<span class="who" title="Yurt dışı ürünü personel taşımaz">Yurt dışı</span>';
    var slots = taskSlots(x, t);
    var names = slots.map(function (s) { return x.pers[s] || ''; });
    var label = names[0] || '';
    if (slots.length === 2 && names[1] !== names[0]) label = (names[0] || '—') + ' / ' + (names[1] || '—');
    var ov = slots.some(function (s) { return x.persOverridden[s]; });
    var none = !names[0] && !(slots.length === 2 && names[1]);
    return '<button class="who' + (none ? ' none' : '') + (ov ? ' ov' : '') + '" data-act="pick" data-id="' + h(x.d.id) + '" data-slots="' + slots.join(',') + '">' + h(none ? 'Ata' : label) + '</button>';
  }
  function taskCard(t, showDate) {
    var x = D[t.i], d = x.d;
    var l2 = t.slot === 7 ? (S(d.hk) ? d.hk + ' · ' : '') + S(d.ad) + ' · ' + (x.sehir || '') : (S(d.hk) ? d.hk + ' · ' : '') + S(d.ad);
    var l3 = t.slot === 7 ? S(d.bolge) : S(d.hastane) + (S(d.tel) ? ' · ' + d.tel : '');
    return '<div class="task"><div class="bar k-' + t.kind + '"></div><div class="b" data-act="donor" data-id="' + h(d.id) + '">' +
      '<div class="l1">' + (showDate ? '<span class="muted">' + h(DT.fmtShort(t.date)) + ' · </span>' : '') + h(taskTitle(x, t)) + '</div>' +
      '<div class="l2">' + h(l2) + '</div><div class="l3">' + h(l3) + '</div></div>' + whoBtn(x, t) + '</div>';
  }
  function emptyBox(title, text) { return '<div class="empty"><b>' + h(title) + '</b>' + h(text || '') + '</div>'; }
  function noDataCard() {
    return '<div class="card pad"><h2>Başlamak için verilerinizi aktarın</h2><div class="small muted" style="margin-bottom:12px">Donör Takip Excel dosyanızı (.xlsx) seçin; donörler, listeler ve haftalık programda seçtiğiniz personel atamaları uygulamaya aktarılır. Veriler yalnızca bu telefonda saklanır.</div>' +
      '<div class="btns"><button class="btn pri" data-act="import">' + I.up + 'Excel dosyası seç</button><button class="btn" data-act="newDonor">' + I.plus + 'Elle ekle</button></div></div>';
  }

  /* ---------------- Ana sayfa ---------------- */
  function scrHome() {
    var t = today, todayTasks = DT.calendarTasks(pool, D, t, t + 1, ''), tomorrow = DT.calendarTasks(pool, D, t + 1, t + 2, '');
    var alerts = DT.alerts(D, t, ''), kontrol = D.filter(function (x) { return x.kontrol; }).length;
    var unassigned = tomorrow.filter(function (k) { var x = D[k.i]; return !(k.slot === 7 && k.yd) && !x.pers[k.slot]; }).length;
    var html = '<div class="banner"><img src="img/kizilay-banner.jpg" alt=""></div><div class="page home">' +
      '<div class="hometitle"><div class="ht">Donör Takip</div><div class="hs">Bugün  ' + h(DT.fmt(t)) + '  ·  ' + h(gunAd(t)) + (holMap[t] ? '  ·  <b>' + h(holMap[t]) + '</b>' : '') + '</div></div>';
    if (!state.donors.length) html += noDataCard();
    html += '<div class="tiles">' +
      '<button class="tile" data-act="calToday"><div class="n">' + todayTasks.length + '</div><div class="l">Bugün · görev</div><div class="s">Takvim’de bugünün görevleri</div></button>' +
      '<button class="tile" data-act="goto" data-h="/plan/program"><div class="n">' + tomorrow.length + '</div><div class="l">Yarın · görev' + (unassigned ? ' · <span style="color:var(--red)">' + unassigned + ' atanmamış</span>' : '') + '</div><div class="s">Çalışma Programı: yarının programı</div></button>' +
      '<button class="tile' + (alerts.length ? ' warn' : ' ok') + '" data-act="goto" data-h="/plan/uyarilar"><div class="n">' + alerts.length + '</div><div class="l">Geri sayım uyarısı</div><div class="s">Görev Listesi: kaç gün kaldı</div></button>' +
      '<button class="tile' + (kontrol ? ' warn' : ' ok') + '" data-act="kontrolList"><div class="n">' + kontrol + '</div><div class="l">Kontrol notu</div><div class="s">Donör Kayıt’ta eksik ya da uyumsuz bilgi</div></button></div>' +
      '<div class="actions"><button class="btn newdonor" data-act="newDonor">' + I.plus + 'YENİ DONÖR EKLE</button><button class="btn wa" data-act="shareTomorrow">' + I.wa + 'Yarının programı</button></div>' +
      '<div class="groups">' + Object.keys(GROUPS).map(function (k) {
        var g = GROUPS[k];
        return '<button class="gbtn" style="background:' + g.renk + '" data-act="goto" data-h="/g/' + k + '"><span class="gt">' + h(g.ad) + '</span><span class="gs">' + h(g.alt) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="hint" style="margin:2px 4px 6px">Bir gruba dokununca o grubun sayfaları açılır. Her sayfanın üstündeki düğmelerle gruptaki sayfalar arasında geçebilirsiniz.</div>' +
      '<div class="sec-title">Bugünün görevleri</div><div class="card">' +
      (todayTasks.length ? todayTasks.map(function (k) { return taskCard(k); }).join('') : emptyBox('Bugün için görev yok', '')) + '</div>';
    if (alerts.length) {
      html += '<div class="sec-title">Yaklaşan uyarılar</div><div class="card">' + alerts.slice(0, 4).map(alertRow).join('') +
        (alerts.length > 4 ? '<button class="btn ghost block" data-act="goto" data-h="/plan/uyarilar">Tümünü gör (' + alerts.length + ')</button>' : '') + '</div>';
    }
    html += '</div>';
    return { title: 'Ana Sayfa', html: html, actions: '<button class="icon" data-act="goto" data-h="/ayarlar" aria-label="Ayarlar">' + I.gear + '</button>' };
  }

  /* ---------------- Grup menüleri (Excel'deki PLANLAMA / TAKİP / DONÖR KAYIT VE ARŞİV / DASHBOARD sayfaları) ---------------- */
  function scrGroup(k) {
    var g = GROUPS[k];
    var html = '<div class="page"><div class="ghead" style="background:' + g.renk + '"><div class="gt">' + h(g.ad) + '</div><div class="gs">' + h(g.alt) + ' · açmak istediğiniz sayfaya dokunun</div></div>' +
      '<div class="gcards">' + g.pages.map(function (pg) {
        return '<button class="gcard' + (pg[3] ? ' soon' : '') + '" style="background:' + g.renk + '" ' + (pg[3] ? 'data-act="soon"' : 'data-act="goto" data-h="' + pg[0] + '"') + '>' +
          '<span class="ct">' + h(pg[1]) + '</span><span class="cs" style="color:' + g.acik + '">' + h(pg[3] ? 'Sonraki sürümde' : pg[2]) + '</span></button>';
      }).join('') + '</div></div>';
    return { title: g.ad.charAt(0) + g.ad.slice(1).toLocaleLowerCase('tr-TR'), html: html };
  }

  /* ---------------- Donör listesi ---------------- */
  var DFILTERS = [['all', 'Tümü'], ['active', 'Süreçte'], ['done', 'Toplama yapıldı'], ['stopped', 'Durdu'], ['kontrol', 'Kontrol notu']];
  function dfilterFn(k) {
    if (k === 'active') return function (x) { return !x.stopped && x.durum !== 'Toplama yapıldı'; };
    if (k === 'done') return function (x) { return x.durum === 'Toplama yapıldı'; };
    if (k === 'stopped') return function (x) { return x.stopped; };
    if (k === 'kontrol') return function (x) { return !!x.kontrol; };
    return function () { return true; };
  }
  function filteredDonors() {
    var f = dfilterFn(ui.dfilter), q = fold(ui.search.trim()), arr = D.filter(f);
    if (q) {
      var terms = q.split(/\s+/);
      arr = arr.filter(function (x) {
        var d = x.d, hay = fold([d.hk, d.dno, d.ad, d.tel, d.ikamet, d.hastane, d.bolge, d.aciklama, d.personel, d.yontem].join(' '));
        var hayDigits = S(d.tel).replace(/\D/g, '');
        return terms.every(function (t) { return hay.indexOf(t) >= 0 || (/^\d{3,}$/.test(t) && hayDigits.indexOf(t) >= 0); });
      });
    }
    if (ui.dsort === 'new') arr = arr.slice().reverse();
    else if (ui.dsort === 'top') arr = arr.slice().sort(function (a, b) { return (b.d.top || -1) - (a.d.top || -1) || b.i - a.i; });
    else if (ui.dsort === 'sk') arr = arr.slice().sort(function (a, b) { return (b.d.sk || -1) - (a.d.sk || -1) || b.i - a.i; });
    else if (ui.dsort === 'ad') arr = arr.slice().sort(function (a, b) { return S(a.d.ad).localeCompare(S(b.d.ad), 'tr'); });
    return arr;
  }
  function donorItem(x) {
    var d = x.d, chips = [];
    if (d.sk != null) chips.push('<span class="pillx p-sk">SK ' + DT.fmtShort(d.sk) + '</span>');
    if (x.asi != null) chips.push('<span class="pillx p-asi">Aşı ' + DT.fmtShort(x.asi) + '</span>');
    if (d.top != null) chips.push('<span class="pillx p-top">Top. ' + DT.fmtShort(d.top) + '</span>');
    if (S(d.personel)) chips.push('<span class="pillx p-grey">' + h(d.personel) + '</span>');
    var t2 = [d.hk, d.hastane, d.yontem].filter(Boolean).join(' · ');
    return '<a class="item' + (x.stopped ? ' stopped' : '') + '" data-act="donor" data-id="' + h(d.id) + '"><div class="t1"><span class="name">' + h(d.ad || d.hk || '(adsız)') + '</span>' +
      (x.kontrol ? '<span class="warnicon" title="' + h(x.kontrol) + '">' + I.warn + '</span>' : '') +
      '<span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span></div><div class="t2 ellipsis">' + h(t2) + '</div>' +
      (chips.length ? '<div class="t3">' + chips.join('') + '</div>' : '') + '</a>';
  }
  function donorListHtml() {
    var arr = filteredDonors();
    if (!arr.length) return '<div class="card">' + emptyBox(state.donors.length ? 'Eşleşen kayıt yok' : 'Henüz donör yok', state.donors.length ? 'Aramayı ya da filtreyi değiştirin.' : '') + '</div>';
    var shown = arr.slice(0, ui.dlimit);
    return '<div class="summary">' + arr.length + ' kayıt</div><div class="card list">' + shown.map(donorItem).join('') + '</div>' +
      (arr.length > shown.length ? '<button class="btn block" data-act="more">Daha fazla göster (' + (arr.length - shown.length) + ')</button>' : '');
  }
  function scrDonors() {
    var counts = {}; DFILTERS.forEach(function (f) { counts[f[0]] = D.filter(dfilterFn(f[0])).length; });
    var html = '<div class="page flush">' + groupSeg('arsiv', '/donorler') + '<div class="seg sub">' + DFILTERS.map(function (f) {
      return '<button class="' + (ui.dfilter === f[0] ? 'on' : '') + '" data-act="dfilter" data-v="' + f[0] + '">' + f[1] + '<span class="c">' + counts[f[0]] + '</span></button>';
    }).join('') + '</div>' +
      '<div class="toolbar"><div class="search grow">' + I.search + '<input class="inp" type="search" placeholder="Ad, hasta kodu, telefon, hastane…" value="' + h(ui.search) + '" data-ui="search"></div>' +
      '<select class="inp" data-ui="dsort" style="flex:none;width:auto">' +
      [['new', 'Son eklenen'], ['top', 'Toplama'], ['sk', 'Sağlık k.'], ['ad', 'Ad']].map(function (o) { return '<option value="' + o[0] + '"' + (ui.dsort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></div><div id="dlist">' + donorListHtml() + '</div></div>' +
      '<button class="fab" data-act="newDonor" aria-label="Yeni donör">' + I.plus + '</button>';
    return { title: 'Donör Kayıt', html: html };
  }

  /* ---------------- Donör ayrıntısı ---------------- */
  function scrDonor(id) {
    var x = byId[id];
    if (!x) return { title: 'Donör', back: true, html: '<div class="page">' + emptyBox('Kayıt bulunamadı', 'Silinmiş olabilir.') + '</div>' };
    var d = x.d, L = state.lists;
    var html = '<div class="page"><div class="card dhead"><div class="row"><div class="grow"><div class="n">' + h(d.ad || '(adsız)') + '</div><div class="c">' + h([d.hk, d.dno].filter(Boolean).join(' · ')) + '</div></div></div>' +
      '<div style="margin-top:8px"><span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span>' + (x.stopped ? ' <span class="pillx p-grey">Plan ve listelerden çıkarıldı</span>' : '') + '</div>' +
      '<div class="btns" style="margin-top:12px"><button class="btn pri" data-act="editDonor" data-id="' + h(id) + '">' + I.edit + 'Düzenle</button>' +
      (telHref(d.tel) ? '<a class="btn" href="' + h(telHref(d.tel)) + '">' + I.phone + 'Ara</a>' : '') +
      '<button class="btn" data-act="copyDonor" data-id="' + h(id) + '">' + I.copy + 'Kopyala</button></div></div>';
    if (x.issues.length) html += '<div class="issues"><b>Kontrol</b>' + x.issues.map(h).join('<br>') + '</div>';
    if (x.dupAd) html += '<div class="issues"><b>Aynı ad soyad</b>Bu ad soyad başka bir kayıtta da var.</div>';
    // Süreç
    var tl = [];
    if (d.sk != null) tl.push([d.sk, 'Sağlık kontrolü', 'sk']);
    if (x.asiYok) tl.push([null, 'Aşı yok', 'asi']);
    else if (x.asi != null) tl.push([x.asi, 'Aşı başlangıcı (1.–4. gün: ' + DT.fmtShort(x.asi) + ' – ' + DT.fmtShort(x.asi + 3) + ')' + (d.asiManual != null ? ' · elle' : ''), 'asi']);
    if (d.top != null && x.kem && eqi(d.hastane, 'BİLKENT PEDİATRİ')) tl.push([d.top - 1, 'Hastane yatış', 'yat']);
    if (d.top != null) tl.push([d.top, 'Toplama' + (S(d.bolge) ? ' → ' + (x.yd === 1 ? 'yurt dışı' : x.baslik) : ''), 'top']);
    if (x.sonIzlem != null) tl.push([x.sonIzlem, 'Son izlem' + (d.sonIzlemManual != null ? ' · elle' : ''), 'sk']);
    if (d.idmBas != null || d.idmBit != null) tl.push([d.idmBas, 'IDM ' + DT.fmt(d.idmBas) + (d.idmBit != null ? ' – ' + DT.fmt(d.idmBit) : ''), 'yat']);
    if (tl.length) {
      html += '<div class="sec-title">Süreç</div><div class="card timeline">' + tl.map(function (e) {
        return '<div class="tl' + (e[0] != null && e[0] < today ? ' past' : '') + '"><span class="pillx p-' + e[2] + '">' + (e[0] != null ? DT.fmt(e[0]) : '—') + '</span><div class="ds">' + h(e[1]) +
          (e[0] != null ? '<div class="tiny muted">' + gunAd(e[0]) + (holMap[e[0]] ? ' · ' + h(holMap[e[0]]) : '') + (e[0] >= today ? ' · ' + (e[0] === today ? 'bugün' : (e[0] - today) + ' gün sonra') : '') + '</div>' : '') + '</div></div>';
      }).join('') + '</div>';
    }
    // Görevler
    var mine = pool.filter(function (t) { return t.i === x.i && t.slot < 9; });
    if (mine.length) {
      html += '<div class="sec-title">Görevler ve personel</div><div class="card">' + mine.map(function (t) { return taskCard(t, true); }).join('') + '</div>' +
        '<div class="note" style="margin:-4px 6px 8px">Personel düğmesine dokunarak göreve kişi atayın. Atama Takvim, Çalışma Programı ve takip listelerine yansır.</div>';
    }
    var rows = [['Hasta kodu', d.hk], ['Donör numarası', d.dno], ['Ad soyad', d.ad], ['Telefon', d.tel], ['İkameti', d.ikamet + (x.ankara === 1 ? ' (Ankara içi)' : x.ankara === 0 ? ' (Ankara dışı)' : '')],
      ['Yöntemi', d.yontem], ['Hastane', d.hastane], ['Açıklama', d.aciklama], ['Nakil merkezi', S(d.bolge) + (x.sehir ? ' · ' + x.sehir : '')],
      ['İlgilenen personel', d.personel], ['Taşıyan personel', d.tasiyan], ['Ulaşım', d.ulasim], ['Konaklama', d.konaklama], ['IDM', d.idm ? '✓' : '']];
    html += '<div class="sec-title">Bilgiler</div><div class="card dl">' + rows.map(function (r) { return '<div>' + h(r[0]) + '</div><div>' + (r[1] ? h(r[1]) : '<span class="muted">—</span>') + '</div>'; }).join('') + '</div>' +
      '<button class="btn danger block" data-act="delDonor" data-id="' + h(id) + '" style="margin-top:8px">Kaydı sil</button></div>';
    return { title: d.ad || 'Donör', back: true, html: html, tab: 'donorler' };
  }

  /* ---------------- Donör formu ---------------- */
  var formDraft = null;
  function scrDonorForm(id) {
    var x = id ? byId[id] : null;
    if (id && !x) return { title: 'Donör', back: true, html: '<div class="page">' + emptyBox('Kayıt bulunamadı') + '</div>' };
    var d = x ? x.d : DT.emptyDonor(), L = state.lists;
    var asiMode = d.asiManual === 'YOK' ? 'yok' : d.asiManual != null ? 'manual' : 'auto';
    var sonMode = d.sonIzlemManual != null ? 'manual' : 'auto';
    var f = function (name, label, val, type, extra) {
      return '<div class="field"><label>' + label + '</label><input class="inp" name="' + name + '" type="' + (type || 'text') + '" value="' + h(val) + '"' + (extra || '') + '></div>';
    };
    var dt = function (name, label, val) { return f(name, label, DT.iso(val), 'date'); };
    var sel = function (name, label, opts) { return '<div class="field"><label>' + label + '</label><select class="inp" name="' + name + '">' + opts + '</select></div>'; };
    var bolgeList = {}; state.donors.forEach(function (o) { if (S(o.bolge)) bolgeList[o.bolge] = 1; });
    var radios = function (name, cur, items) {
      return '<div class="radios">' + items.map(function (it) { return '<label class="' + (cur === it[0] ? 'on' : '') + '"><input type="radio" name="' + name + '" value="' + it[0] + '"' + (cur === it[0] ? ' checked' : '') + '>' + it[1] + '</label>'; }).join('') + '</div>';
    };
    var html = '<div class="page"><form id="dform" autocomplete="off" data-id="' + h(id || '') + '"><div class="card pad">' +
      '<div class="formsec">Kimlik</div>' +
      '<div class="grid2">' + f('hk', 'Hasta kodu', d.hk, 'text', ' autocapitalize="characters"') + f('dno', 'Donör numarası', d.dno, 'text', ' autocapitalize="characters"') + '</div>' +
      f('ad', 'Ad soyad', d.ad, 'text', ' autocapitalize="characters"') +
      '<div class="grid2">' + f('tel', 'Telefon no', d.tel, 'tel') + f('ikamet', 'İkameti', d.ikamet, 'text', ' placeholder="İLÇE/İL" autocapitalize="characters"') + '</div>' +
      '<div class="formsec">Süreç</div>' +
      '<div class="grid2">' + dt('sk', 'Sağlık kontrolü tarihi', d.sk) + sel('yontem', 'Yöntemi', listOptions(L.yontem, d.yontem)) + '</div>' +
      sel('hastane', 'Hastane', listOptions(L.hastane.map(function (e) { return e.ad; }), d.hastane)) +
      '<div class="field"><label>Açıklama</label><textarea class="inp" name="aciklama" rows="3">' + h(d.aciklama) + '</textarea>' +
      '<div class="hint">“iptal”, “ertelendi”, “red”, “vazgeçti”, “hasta ex” yazılan donörün süreci durur. ONKOLOJİ’de “18 kg” gibi 20 kg ve altı kilo yazılırsa aşı 3 gün önce başlar.</div></div>' +
      dt('top', 'Kök hücre toplama tarihi', d.top) +
      '<div class="field"><label>Aşı başlama tarihi</label>' + radios('asiMode', asiMode, [['auto', 'Otomatik'], ['manual', 'Elle tarih'], ['yok', 'Aşı yok']]) +
      '<input class="inp" name="asiManual" type="date" value="' + h(typeof d.asiManual === 'number' ? DT.iso(d.asiManual) : '') + '"' + (asiMode === 'manual' ? '' : ' hidden') + '>' +
      '<div class="calc" id="asiCalc"></div></div>' +
      '<div class="field"><label>Nakil merkezi bölge</label><input class="inp" name="bolge" list="bolgeler" value="' + h(d.bolge) + '" autocapitalize="characters" placeholder="ör. KOÇ ÜNİVERSİTESİ HASTANESİ İST. · YURT DIŞI (ALMANYA - ZKRD)">' +
      '<datalist id="bolgeler">' + Object.keys(bolgeList).sort().map(function (b) { return '<option value="' + h(b) + '">'; }).join('') + '</datalist><div class="calc" id="bolgeCalc" style="margin-top:6px"></div></div>' +
      '<div class="field"><label>Son izlem tarihi</label>' + radios('sonMode', sonMode, [['auto', 'Otomatik (toplama + 20 gün)'], ['manual', 'Elle tarih']]) +
      '<input class="inp" name="sonIzlemManual" type="date" value="' + h(DT.iso(d.sonIzlemManual)) + '"' + (sonMode === 'manual' ? '' : ' hidden') + '><div class="calc" id="sonCalc"></div></div>' +
      '<div class="formsec">Personel ve lojistik</div>' +
      '<div class="grid2">' + sel('personel', 'İlgilenen personel', persOptions(d.personel, '— yok —') + (S(d.personel) && !DT.inPersonel(L, d.personel) ? '<option selected>' + h(d.personel) + '</option>' : '')) +
      sel('tasiyan', 'Taşıyan personel', persOptions(d.tasiyan, '— ilgilenen —') + (S(d.tasiyan) && !DT.inPersonel(L, d.tasiyan) ? '<option selected>' + h(d.tasiyan) + '</option>' : '')) + '</div>' +
      '<div class="grid2">' + sel('ulasim', 'Ulaşım türü', listOptions(L.ulasim, d.ulasim, '—')) + sel('konaklama', 'Konaklama', listOptions(L.konaklama, d.konaklama, '—')) + '</div>' +
      '<div class="formsec">IDM</div>' +
      '<label class="check"><input type="checkbox" name="idm"' + (d.idm ? ' checked' : '') + '> IDM ✓ (IDM sayfasında listelensin)</label>' +
      '<div class="grid2">' + dt('idmBas', 'IDM başlangıç', d.idmBas) + dt('idmBit', 'IDM bitiş', d.idmBit) + '</div>' +
      '</div><div class="btns" style="margin-top:4px"><button type="button" class="btn" data-act="back">Vazgeç</button><button type="submit" class="btn pri">Kaydet</button></div></form></div>';
    return {
      title: id ? 'Donörü düzenle' : 'Yeni donör', back: true, html: html, tab: 'donorler',
      after: function () {
        var form = $('#dform');
        form.addEventListener('input', function () { formPreview(form); });
        form.addEventListener('change', function (e) {
          if (e.target.name === 'asiMode') form.asiManual.hidden = e.target.value !== 'manual';
          if (e.target.name === 'sonMode') form.sonIzlemManual.hidden = e.target.value !== 'manual';
          form.querySelectorAll('.radios label').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); });
          formPreview(form);
        });
        form.addEventListener('submit', function (e) { e.preventDefault(); saveDonorForm(form); });
        formPreview(form);
      }
    };
  }
  function readForm(form, base) {
    var d = Object.assign({}, base);
    var v = function (n) { return S(form[n].value).trim(); };
    d.hk = upperTR(v('hk')); d.dno = upperTR(v('dno')); d.ad = upperTR(v('ad')); d.tel = v('tel'); d.ikamet = upperTR(v('ikamet'));
    d.sk = DT.fromIso(v('sk')); d.yontem = v('yontem'); d.hastane = v('hastane'); d.aciklama = S(form.aciklama.value).trim();
    d.top = DT.fromIso(v('top')); d.bolge = upperTR(v('bolge')); d.personel = v('personel'); d.tasiyan = v('tasiyan');
    d.ulasim = v('ulasim'); d.konaklama = v('konaklama'); d.idm = form.idm.checked; d.idmBas = DT.fromIso(v('idmBas')); d.idmBit = DT.fromIso(v('idmBit'));
    var am = form.querySelector('[name=asiMode]:checked').value;
    d.asiManual = am === 'yok' ? 'YOK' : am === 'manual' ? DT.fromIso(v('asiManual')) : null;
    var sm = form.querySelector('[name=sonMode]:checked').value;
    d.sonIzlemManual = sm === 'manual' ? DT.fromIso(v('sonIzlemManual')) : null;
    return d;
  }
  function formPreview(form) {
    var id = form.dataset.id, base = id && byId[id] ? byId[id].d : DT.emptyDonor();
    var d = readForm(form, base);
    var x = DT.derive({ lists: state.lists, donors: [d] }, today)[0];
    var a = $('#asiCalc'), s = $('#sonCalc'), b = $('#bolgeCalc');
    if (a) a.textContent = x.asiYok ? 'Aşı yapılmaz' : x.asi != null ? 'Aşı: ' + DT.fmt(x.asi) + ' – ' + DT.fmt(x.asi + 3) + ' (' + (d.top != null && d.asiManual == null ? (d.top - x.asi) + ' gün önce' : 'elle') + ')' : 'Toplama tarihi girilince hesaplanır';
    if (s) s.textContent = x.sonIzlem != null ? 'Son izlem: ' + DT.fmt(x.sonIzlem) : 'Toplama tarihi girilince hesaplanır';
    if (b) b.textContent = !S(d.bolge) ? 'Programda ürün taşıma satırı için gerekli' : x.yd === 1 ? 'Yurt dışı · ürünü personel taşımaz' : 'Şehir: ' + x.sehir + ' · Programda: ' + S(d.hastane || 'HASTANE') + '-' + x.baslik;
  }
  function saveDonorForm(form) {
    var id = form.dataset.id;
    var base = id && byId[id] ? byId[id].d : DT.emptyDonor();
    var d = readForm(form, base);
    if (!d.hk && !d.ad) { toast('Hasta kodu ya da ad soyad girin.'); return; }
    if (form.querySelector('[name=asiMode]:checked').value === 'manual' && d.asiManual == null) { toast('Aşı tarihini seçin ya da Otomatik’i işaretleyin.'); return; }
    if (id) { var k = state.donors.indexOf(base); state.donors[k] = d; }
    else state.donors.push(d);
    save(); recompute();
    toast(id ? 'Kaydedildi' : 'Donör eklendi');
    if (id) history.back(); else go('/donor/' + d.id, true);
  }

  /* ---------------- Personel atama ---------------- */
  function pickPersonnel(id, slots) {
    var x = byId[id]; if (!x) return;
    var d = x.d, ov = state.overrides, L = state.lists;
    var t = pool.find(function (k) { return k.i === x.i && k.slot === slots[0]; });
    var title = t ? taskTitle(x, t) : 'Görev';
    var defFor = function (s) {
      if (s >= 9) return 'sabah personeli';
      if (s === 7) return S(d.tasiyan) ? 'taşıyan: ' + d.tasiyan : (S(d.personel) ? 'ilgilenen: ' + d.personel : 'boş');
      return S(d.personel) ? 'ilgilenen: ' + d.personel : 'boş';
    };
    var group = function (s, label) {
      var key = d.id + '|' + s, has = Object.prototype.hasOwnProperty.call(ov, key), cur = has ? S(ov[key]) : null;
      var opt = function (val, text, sub, on, wide) {
        return '<label class="popt' + (on ? ' on' : '') + (wide ? ' wide' : '') + '"><input type="radio" name="s' + s + '" value="' + h(val) + '"' + (on ? ' checked' : '') + '>' + h(text) + (sub ? ' <span class="s">' + h(sub) + '</span>' : '') + '</label>';
      };
      return (label ? '<div class="lbl" style="margin-top:12px">' + h(label) + '</div>' : '') + '<div class="popts">' +
        L.personel.map(function (p) { return opt(p, p, '', has && eqi(cur, p)); }).join('') +
        opt('\u0000', 'Atanmamış', '', has && cur === '') +
        opt('\u0001', 'Varsayılan', defFor(s), !has, true) + '</div>';
    };
    var two = slots.length === 2;
    openSheet('<h3>Personel ata</h3><div class="sub">' + h(title) + '\n' + h((d.hk ? d.hk + ' · ' : '') + d.ad) + (t ? '\n' + h(dateLong(t.date)) : '') + '</div>' +
      '<form id="pform">' + (two ? group(slots[0], 'Sabah') + group(slots[1], 'Akşam') : group(slots[0])) +
      (two ? '<div class="btns" style="margin-top:12px"><button type="button" class="btn" data-act="closeSheet">Vazgeç</button><button class="btn pri">Kaydet</button></div>' : '') + '</form>');
    var form = $('#pform');
    form.addEventListener('change', function () { form.querySelectorAll('.popt').forEach(function (l) { l.classList.toggle('on', l.querySelector('input').checked); }); });
    var apply = function () {
      slots.forEach(function (s) {
        var r = form.querySelector('[name=s' + s + ']:checked'); if (!r) return;
        var key = d.id + '|' + s;
        if (r.value === '\u0001') delete ov[key]; else if (r.value === '\u0000') ov[key] = ''; else ov[key] = r.value;
      });
      closeSheet(); commit(); toast('Personel kaydedildi');
    };
    if (two) form.addEventListener('submit', function (e) { e.preventDefault(); apply(); });
    else form.addEventListener('change', apply);
  }

  /* ---------------- Planlama ---------------- */
  var PLAN_TITLES = { takvim: 'Takvim', program: 'Çalışma Programı', haftalik: 'Haftalık Program', ajanda: 'Ajanda', uyarilar: 'Görev Listesi', ek: 'Ek görevler' };
  function scrPlan(tab) {
    var body = tab === 'program' ? planProgram() : tab === 'uyarilar' ? planAlerts() : tab === 'ek' ? planEk() : tab === 'haftalik' ? planWeek() : tab === 'ajanda' ? planAjanda() : planCalendar();
    return { title: PLAN_TITLES[tab] || 'Planlama', html: '<div class="page flush">' + groupSeg('planlama', '/plan/' + (tab === 'ek' ? 'program' : tab)) + body + '</div>' };
  }
  function planCalendar() {
    if (ui.calY == null) { var p0 = DT.parts(today); ui.calY = p0.y; ui.calM = p0.m; }
    if (ui.calSel == null) ui.calSel = today;
    var first = DT.serial(ui.calY, ui.calM, 1), start = DT.weekStart(first), next = DT.serial(ui.calY, ui.calM + 1, 1);
    var tasks = DT.calendarTasks(pool, D, start, start + 42, ui.calP);
    var byDay = {}; tasks.forEach(function (t) { (byDay[t.date] = byDay[t.date] || []).push(t); });
    var mt = tasks.filter(function (t) { return t.date >= first && t.date < next; });
    var c = function (fn) { return mt.filter(fn).length; };
    var html = '<div class="calhead"><button class="icon" data-act="calMove" data-v="-1" aria-label="Önceki ay">' + I.left + '</button><div class="m">' + DT.AYLAR[ui.calM - 1] + ' ' + ui.calY + '</div>' +
      '<button class="icon" data-act="calMove" data-v="1" aria-label="Sonraki ay">' + I.right + '</button></div>' +
      '<div class="toolbar"><select class="inp" data-ui="calP">' + persOptions(ui.calP, 'Herkes') + '</select><button class="btn sm" data-act="calToday">Bugün</button></div>' +
      '<div class="summary">Bu ay · ' + c(function (t) { return t.slot === 1; }) + ' sağlık kontrolü · ' + c(function (t) { return t.kind === 'asi'; }) + ' aşı · ' +
      c(function (t) { return t.slot === 8; }) + ' yatış · ' + c(function (t) { return t.slot === 6; }) + ' toplama</div>' +
      '<div class="cal">' + ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(function (g) { return '<div class="wd">' + g + '</div>'; }).join('');
    for (var k = 0; k < 42; k++) {
      var s = start + k, list = byDay[s] || [], p = DT.parts(s);
      var cls = 'day' + (p.m !== ui.calM ? ' out' : '') + (holMap[s] ? ' hol' : '') + (s === today ? ' today' : '') + (s === ui.calSel ? ' sel' : '');
      html += '<button class="' + cls + '" data-act="calDay" data-v="' + s + '"><span class="num">' + p.d + '</span><span class="dots">' +
        list.slice(0, 6).map(function (t) { return '<i class="dot k-' + t.kind + '"></i>'; }).join('') + '</span>' +
        (list.length ? '<span class="more">' + list.length + ' görev</span>' : '') + '</button>';
    }
    html += '</div><div class="legend"><span><i class="k-sk"></i>Sağlık kontrolü</span><span><i class="k-asi"></i>Aşı</span><span><i class="k-top"></i>Toplama</span><span><i class="k-tas"></i>Ürün taşıma</span><span><i class="k-yat"></i>Hastane yatış</span><span><i style="background:#f3c9c9"></i>Resmi tatil</span></div>';
    var sel = ui.calSel, selList = byDay[sel] || DT.calendarTasks(pool, D, sel, sel + 1, ui.calP);
    html += '<div class="sec-title">' + h(dateLong(sel)) + (holMap[sel] ? ' · <span style="color:var(--red)">' + h(holMap[sel]) + '</span>' : '') + '</div><div class="card">' +
      (selList.length ? selList.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için görev yok', ui.calP ? ui.calP + ' için' : '')) + '</div>' +
      '<button class="btn block" data-act="progFor" data-v="' + sel + '">' + I.wa + 'Bu günün çalışma programı</button>';
    return html;
  }
  function planProgram() {
    if (ui.progDate == null) ui.progDate = today + 1;
    var s = ui.progDate, prog = DT.program(state, D, pool, s);
    var dayTasks = DT.calendarTasks(pool, D, s, s + 1, '');
    var ek = state.ekGorevler.filter(function (e) { return e.tarih === s; });
    var unassigned = dayTasks.filter(function (t) { return !(t.slot === 7 && t.yd) && !D[t.i].pers[t.slot]; }).length;
    var html = '<div class="datebar"><button class="icon" data-act="progMove" data-v="-1">' + I.left + '</button><input class="inp" type="date" value="' + DT.iso(s) + '" data-ui="progDate" data-type="date">' +
      '<button class="icon" data-act="progMove" data-v="1">' + I.right + '</button></div>' +
      '<div class="row wrap" style="margin-bottom:10px;gap:6px"><button class="chip' + (s === today ? ' on' : '') + '" data-act="progSet" data-v="' + today + '">Bugün</button><button class="chip' + (s === today + 1 ? ' on' : '') + '" data-act="progSet" data-v="' + (today + 1) + '">Yarın</button>' +
      '<span class="small muted grow right">' + h(gunAd(s)) + (holMap[s] ? ' · ' + h(holMap[s]) : '') + '</span></div>' +
      (unassigned ? '<div class="issues"><b>' + unassigned + ' görevde personel atanmamış</b>Aşağıdaki listeden atayabilirsiniz.</div>' : '') +
      '<div class="card pad"><div class="prog">' + h(prog.text) + '</div><div class="btns" style="margin-top:12px"><button class="btn" data-act="copyProg">' + I.copy + 'Kopyala</button><button class="btn wa" data-act="shareProg" data-wa="1">' + I.wa + 'WhatsApp</button><button class="btn" data-act="shareProg">' + I.share + 'Paylaş</button></div></div>' +
      '<div class="sec-title">Görev atamaları (' + dayTasks.length + ')</div><div class="card">' + (dayTasks.length ? dayTasks.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için takvim görevi yok')) + '</div>' +
      '<div class="sec-title">Ek görevler (' + ek.length + ')</div><div class="card">' + (ek.length ? ek.map(ekRow).join('') : emptyBox('Ek görev yok', 'Takvimde olmayan işler (ek konsültasyon vb.) için ekleyin.')) + '</div>' +
      '<div class="btns"><button class="btn" data-act="ekNew" data-v="' + s + '">' + I.plus + 'Ek görev ekle</button><button class="btn" data-act="goto" data-h="/plan/ek">Tüm ek görevler</button></div>' +
      '<div class="note" style="margin:8px 4px">Ek konsültasyonlar Takip › Ek Konsültasyon’dan, saatli notlar Ajanda’dan (DURUM: PROGRAMA EKLE) programa yazılır.</div>';
    return html;
  }
  function alertRow(a) {
    var x = a.x, d = x.d;
    return '<div class="trow" data-act="donor" data-id="' + h(d.id) + '"><div class="h"><span class="name">' + h(d.ad) + '</span><span class="pillx ' + (a.onem === 1 ? 'p-red' : 'p-or') + '">' + (a.onem === 1 ? 'YÜKSEK' : 'ORTA') + '</span></div>' +
      '<div class="small" style="margin-top:3px">' + h(a.text) + '</div>' +
      '<dl class="kv"><dt>Tarih</dt><dd>' + h(dateLong(a.date)) + '</dd><dt>Hasta kodu</dt><dd>' + h([d.hk, d.dno].filter(Boolean).join(' · ')) + '</dd>' +
      '<dt>Hastane</dt><dd>' + h(d.hastane) + '</dd><dt>İkamet</dt><dd>' + h(d.ikamet) + '</dd>' + (d.tel ? '<dt>Telefon</dt><dd>' + h(d.tel) + '</dd>' : '') +
      '<dt>Personel</dt><dd>' + h(a.pers || '—') + '</dd></dl></div>';
  }
  function planAlerts() {
    var base = ui.alBase == null ? today : ui.alBase;
    var al = DT.alerts(D, base, ui.alP);
    var groups = [[1, 'Aşı başlangıcı'], [2, 'Sağlık kontrolü'], [3, 'Toplama ve ürün taşıma']];
    var html = '<div class="toolbar"><input class="inp" type="date" value="' + DT.iso(base) + '" data-ui="alBase" data-type="date" style="flex:1"><select class="inp" data-ui="alP">' + persOptions(ui.alP, 'Herkes') + '</select></div>' +
      '<div class="summary">Geri sayım uyarıları · ' + al.length + ' uyarı · ' + (base === today ? 'bugün' : DT.fmt(base)) + ' itibarıyla. Ankara dışı donörde 10 gün, Ankara içinde 5 gün önceden.</div>';
    if (!al.length) return html + '<div class="card">' + emptyBox('Şu an uyarı yok') + '</div>';
    groups.forEach(function (g) {
      var list = al.filter(function (a) { return g[0] === 3 ? a.grp >= 3 : a.grp === g[0]; });
      if (!list.length) return;
      html += '<div class="sec-title">' + g[1] + ' (' + list.length + ')</div><div class="card">' + list.map(alertRow).join('') + '</div>';
    });
    return html;
  }
  function ekRow(e) {
    var x = null;
    D.some(function (y) { if (S(e.hastaKodu) && eqi(y.d.hk, e.hastaKodu)) { x = y; return true; } return false; });
    return '<div class="trow" data-act="ekEdit" data-id="' + h(e.id) + '"><div class="h"><span class="name">' + h(e.islem || '(işlem yok)') + '</span><span class="pillx p-pri">' + h(e.tarih != null ? DT.fmt(e.tarih) : 'tarih yok') + '</span></div>' +
      '<div class="small muted">' + h([e.hastaKodu, x ? x.d.ad : '', e.personel || 'Personel atanmamış'].filter(Boolean).join(' · ')) + '</div></div>';
  }
  function planEk() {
    var list = state.ekGorevler.slice().filter(function (e) { return ui.ekPast || e.tarih == null || e.tarih >= today; })
      .sort(function (a, b) { return (a.tarih || 0) - (b.tarih || 0); });
    return '<div class="summary">Takvimde olmayan işler (ek konsültasyon vb.). Seçilen günün Çalışma Programı’nda personelin altında yazılır.</div>' +
      '<label class="check small"><input type="checkbox" data-ui="ekPast"' + (ui.ekPast ? ' checked' : '') + '> Geçmiş tarihlileri de göster</label>' +
      '<div class="card">' + (list.length ? list.map(ekRow).join('') : emptyBox('Ek görev yok')) + '</div>' +
      '<button class="fab" data-act="ekNew" aria-label="Ek görev ekle">' + I.plus + '</button>';
  }
  function ekForm(e) {
    var isNew = !e;
    e = e || { id: DT.uid(), tarih: ui.progDate || today + 1, personel: '', hastaKodu: '', islem: '' };
    var codes = state.donors.filter(function (d) { return S(d.hk) && (d.top == null || d.top >= today - 30); }).slice(-300).reverse();
    openSheet('<h3>' + (isNew ? 'Ek görev ekle' : 'Ek görevi düzenle') + '</h3><form id="ekform">' +
      '<div class="field"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + DT.iso(e.tarih) + '" required></div>' +
      '<div class="field"><label>Personel</label><select class="inp" name="personel">' + persOptions(e.personel, '— atanmamış —') + '</select></div>' +
      '<div class="field"><label>Hasta kodu</label><input class="inp" name="hastaKodu" list="hkodlar" value="' + h(e.hastaKodu) + '" autocapitalize="characters" placeholder="ör. KK37754P"><datalist id="hkodlar">' +
      codes.map(function (d) { return '<option value="' + h(d.hk) + '">' + h(d.ad) + '</option>'; }).join('') + '</datalist><div class="hint">Donör kaydında varsa ad, telefon ve hastane programa kendiliğinden yazılır.</div></div>' +
      '<div class="field"><label>İşlem</label><input class="inp" name="islem" value="' + h(e.islem) + '" placeholder="ör. ' + h(state.lists.prog.EkKons || 'EK KONSÜLTASYON') + '" autocapitalize="characters"></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="ekDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#ekform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: e.id, tarih: DT.fromIso(f.tarih.value), personel: f.personel.value, hastaKodu: upperTR(f.hastaKodu.value.trim()), islem: upperTR(f.islem.value.trim()) };
      if (o.tarih == null) { toast('Tarih seçin'); return; }
      if (!o.hastaKodu && !o.islem) { toast('Hasta kodu ya da işlem girin'); return; }
      var k = state.ekGorevler.findIndex(function (z) { return z.id === e.id; });
      if (k >= 0) state.ekGorevler[k] = o; else state.ekGorevler.push(o);
      closeSheet(); commit(); toast('Kaydedildi');
    });
    var del = $('#ekDel');
    if (del) del.onclick = function () { state.ekGorevler = state.ekGorevler.filter(function (z) { return z.id !== e.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Takip ---------------- */
  var TKTABS = [['saglik', 'Sağlık kontrolü'], ['asi', 'Aşı'], ['toplama', 'Toplama'], ['tasima', 'Ürün taşıma'], ['sonizlem', 'Son izlem'], ['idm', 'IDM']];
  function scrTakip(tab) {
    var seg = groupSeg('takip', '/takip/' + tab);
    if (tab === 'ekkons') return { title: 'Ek Konsültasyon', html: '<div class="page flush">' + seg + takipKons() + '</div>' };
    var TT = { saglik: 'Sağlık Kontrolü Takip', asi: 'Aşı Takip', toplama: 'Toplama Takip', tasima: 'Ürün Taşıma', sonizlem: 'Son İzlem Takip', idm: 'IDM' };
    var pLabel = tab === 'idm' ? 'Tüm ilgilenenler' : tab === 'tasima' ? 'Tüm taşıyanlar' : tab === 'sonizlem' ? 'Tüm takip edenler' : 'Herkes';
    var html = '<div class="page flush">' + seg + '<div class="toolbar"><select class="inp" data-ui="tkP">' + persOptions(ui.tkP, pLabel) + '</select></div>';
    var f = ui.tkP, t = today, head = 'Bugün: ' + DT.fmt(t) + ' (' + gunAd(t) + ')';
    var rows, body = '';
    var name = function (x) { return '<div class="h"><span class="name">' + h(x.d.ad) + '</span>'; };
    var tail = function (x) { return '<dt>Hasta kodu</dt><dd>' + h([x.d.hk, x.d.dno].filter(Boolean).join(' · ')) + '</dd>'; };
    var tel = function (x) { return x.d.tel ? '<dt>Telefon</dt><dd>' + h(x.d.tel) + '</dd>' : ''; };
    if (tab === 'saglik') {
      rows = DT.listSaglik(D, t, f, state.lists);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x, diff = r.date - t, ank = x.ankara === 1;
        var cls = r.durum === 2 ? 'p-sk' : (!ank && x.ankara === 0 && diff <= 10) ? 'p-red' : (ank && diff <= 5) ? 'p-or' : 'p-grey';
        var txt = r.durum === 2 ? 'BUGÜN SAĞLIK KONTROLÜ' : diff === 1 ? 'Yarın' : diff + ' gün sonra';
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + cls + '">' + txt + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd' + (isOffDay(r.date) ? ' style="color:var(--orange);font-weight:600"' : '') + '>' + h(dateLong(r.date)) + (holMap[r.date] ? ' · ' + h(holMap[r.date]) : '') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>İkamet</dt><dd>' + h(x.d.ikamet) + (x.ankara === 1 ? ' · Ankara içi' : x.ankara === 0 ? ' · Ankara dışı' : '') + '</dd>' + tel(x) +
          ((x.d.ulasim || x.d.konaklama) ? '<dt>Ulaşım</dt><dd>' + h([x.d.ulasim, x.d.konaklama].filter(Boolean).join(' · ')) + '</dd>' : '') +
          (r.kargo ? '<dt>Kargo</dt><dd>' + h(r.kargo) + '</dd>' : '') + '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında sağlık kontrolü olan donör yok.');
    } else if (tab === 'asi') {
      rows = DT.listAsi(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' aşıda · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' başlayacak · ' + rows.filter(function (r) { return r.durum === 3; }).length + ' toplama bekliyor';
      body = rows.map(function (r) {
        var x = r.x, days = '';
        for (var k = 0; k < 4; k++) { var s = r.bas + k; days += '<span class="' + (s < t ? 'done' : s === t ? 'now' : '') + '">' + (k + 1) + '. ' + DT.fmtShort(s) + '</span>'; }
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-asi' : r.durum === 3 ? 'p-top' : 'p-grey') + '">' + h(r.text) + '</span></div>' +
          '<div class="days4">' + days + '</div><dl class="kv">' + tail(x) + '<dt>Hastane</dt><dd>' + h(x.d.hastane) + (x.sabahAksam ? ' · sabah-akşam' : '') + '</dd>' +
          '<dt>Toplama</dt><dd>' + (x.d.top != null ? h(dateLong(x.d.top)) : '—') + '</dd>' + tel(x) + '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Aşı takibi yapılacak donör yok.');
    } else if (tab === 'toplama') {
      rows = DT.listToplama(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' toplama bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-top' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd' + (isOffDay(r.date) ? ' style="color:var(--orange);font-weight:600"' : '') + '>' + h(dateLong(r.date)) + (holMap[r.date] ? ' · ' + h(holMap[r.date]) : '') + '</dd>' + tail(x) +
          '<dt>Yöntem</dt><dd>' + h(x.d.yontem) + '</dd><dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>Nakil merkezi</dt><dd>' + h(x.d.bolge || '—') + '</dd>' + tel(x) +
          '<dt>Personel</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında toplaması olan donör yok.');
    } else if (tab === 'tasima') {
      rows = DT.listTasima(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' taşıma bugün · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' yaklaşan taşıma';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-tas' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Tarih</dt><dd>' + h(dateLong(r.date)) + '</dd>' + tail(x) + '<dt>Eşleştirme</dt><dd>' + h(r.eslesme) + '</dd><dt>Şehir</dt><dd>' + h(x.sehir || '—') + '</dd>' +
          '<dt>Taşıyan</dt><dd>' + h(r.pers || '—') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında taşıması olan ürün yok.');
      var years = yearsInData();
      var mx = DT.tasimaMatrix(state, D, ui.utYil ? +ui.utYil : null);
      body = '<div class="card">' + body + '</div><div class="sec-title">Hastane → nakil merkezi bölgesi</div><div class="card pad"><div class="toolbar"><select class="inp" data-ui="utYil"><option value="">Tüm yıllar</option>' +
        years.map(function (y) { return '<option' + (String(y) === String(ui.utYil) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
        (mx.cols.length ? '<div class="tscroll"><table class="t"><tr><th>Hastane</th>' + mx.cols.map(function (c) { return '<th style="white-space:normal;min-width:84px">' + h(c) + '</th>'; }).join('') + '<th>Toplam</th></tr>' +
          mx.rows.map(function (r) { return '<tr><td>' + h(r.hastane) + '</td>' + r.cells.map(function (v) { return '<td>' + (v || '') + '</td>'; }).join('') + '<td><b>' + r.toplam + '</b></td></tr>'; }).join('') + '</table></div>' : emptyBox('Veri yok')) +
        '<div class="note">En çok ürün giden 8 nakil merkezi gösterilir. Yurt dışı ve süreci durmuş kayıtlar hariç.</div></div>';
      return { title: TT[tab], html: html + '<div class="summary">' + h(head) + '</div>' + body + '</div>' };
    } else if (tab === 'sonizlem') {
      rows = DT.listSonIzlem(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' son izlem bugün · ' + rows.filter(function (r) { return r.date > t && r.date <= t + 7; }).length + ' önümüzdeki 7 günde';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 2 ? 'p-sk' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>Son izlem</dt><dd>' + h(dateLong(r.date)) + (r.gun ? ' · toplamadan ' + h(r.gun) : '') + '</dd><dt>Toplama</dt><dd>' + (x.d.top != null ? h(DT.fmt(x.d.top)) : '—') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd>' + tel(x) + '<dt>Takip eden</dt><dd>' + h(r.pers || 'Atanmamış') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('Bugün ya da sonrasında son izlemi olan donör yok.');
    } else {
      rows = DT.listIdm(D, t, f);
      head += ' · ' + rows.filter(function (r) { return r.durum === 1; }).length + ' donörde IDM sürüyor · ' + rows.filter(function (r) { return r.durum === 2; }).length + ' başlayacak';
      body = rows.map(function (r) {
        var x = r.x;
        return '<div class="trow" data-act="donor" data-id="' + h(x.d.id) + '">' + name(x) + '<span class="pillx ' + (r.durum === 1 ? 'p-yat' : r.durum === 3 ? 'p-or' : 'p-grey') + '">' + h(r.text) + '</span></div><dl class="kv">' +
          '<dt>IDM</dt><dd>' + h(DT.fmt(x.d.idmBas) || '—') + ' – ' + h(DT.fmt(x.d.idmBit) || '—') + (r.sure ? ' · ' + h(r.sure) : '') + '</dd><dt>Toplama</dt><dd>' + (x.d.top != null ? h(DT.fmt(x.d.top)) : '—') + '</dd>' + tail(x) +
          '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd><dt>İlgilenen</dt><dd>' + h(r.pers || 'Atanmamış') + '</dd></dl></div>';
      }).join('');
      if (!rows.length) body = emptyBox('IDM işaretli donör yok.', 'Donör kaydında IDM ✓ işaretleyip tarih aralığını girin.');
    }
    return { title: TT[tab], html: html + '<div class="summary">' + h(head) + '</div><div class="card">' + body + '</div></div>' };
  }
  function yearsInData() {
    var ys = {};
    state.donors.forEach(function (d) { if (d.top != null) ys[DT.year(d.top)] = 1; if (d.sk != null) ys[DT.year(d.sk)] = 1; });
    ys[DT.year(today)] = 1;
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; });
  }

  /* ---------------- Dashboard ---------------- */
  function tbl(head, rows, totRow) {
    return '<div class="tscroll"><table class="t"><tr>' + head.map(function (x) { return '<th>' + h(x) + '</th>'; }).join('') + '</tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (v, i) { return '<td>' + (i === 0 ? h(v) : h(num(v))) + '</td>'; }).join('') + '</tr>'; }).join('') +
      (totRow ? '<tr class="tot">' + totRow.map(function (v, i) { return '<td>' + (i === 0 ? h(v) : h(num(v))) + '</td>'; }).join('') + '</tr>' : '') + '</table></div>';
  }
  function barChart(labels, series, colors, names) {
    var W = 340, H = 150, pad = 22, n = labels.length, max = 1;
    series.forEach(function (s) { s.forEach(function (v) { if (v > max) max = v; }); });
    var gw = (W - pad) / n, bw = Math.max(3, (gw - 6) / series.length);
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 30) + '" role="img">';
    [0, .5, 1].forEach(function (f) { var y = H - f * (H - 12); svg += '<line x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#e3e7eb"/><text x="' + (pad - 4) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end" fill="#7b8794">' + Math.round(max * f) + '</text>'; });
    labels.forEach(function (l, i) {
      series.forEach(function (s, k) {
        var v = s[i] || 0, bh = v / max * (H - 12), x = pad + i * gw + 3 + k * bw;
        svg += '<rect x="' + x.toFixed(1) + '" y="' + (H - bh).toFixed(1) + '" width="' + (bw - 1).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1.5" fill="' + colors[k] + '"><title>' + h(l + ' · ' + names[k] + ': ' + v) + '</title></rect>';
      });
      svg += '<text x="' + (pad + i * gw + gw / 2).toFixed(1) + '" y="' + (H + 12) + '" font-size="9" text-anchor="middle" fill="#4a5764">' + h(l.slice(0, 3)) + '</text>';
    });
    svg += names.map(function (nm, k) { return '<rect x="' + (pad + k * 110) + '" y="' + (H + 20) + '" width="9" height="9" rx="2" fill="' + colors[k] + '"/><text x="' + (pad + 13 + k * 110) + '" y="' + (H + 28) + '" font-size="10" fill="#4a5764">' + h(nm) + '</text>'; }).join('');
    return svg + '</svg>';
  }
  function scrDash() {
    if (ui.dashYil == null) ui.dashYil = DT.year(today);
    var Y = ui.dashYil ? +ui.dashYil : '', R = DT.dashboard(state, D, pool, { today: today, year: Y, esik: state.settings.esik, month: ui.dashAy ? +ui.dashAy : null });
    var years = yearsInData();
    var card = function (title, inner, note) { return '<div class="card pad"><h2>' + h(title) + '</h2>' + inner + (note ? '<div class="note">' + h(note) + '</div>' : '') + '</div>'; };
    var kpi = function (n, l) { return '<div class="kpi"><div class="n">' + h(n) + '</div><div class="l">' + h(l) + '</div></div>'; };
    var html = '<div class="page flush">' + groupSeg('dashboard', '/dashboard') + '<div class="toolbar"><select class="inp" data-ui="dashYil"><option value="">Tüm yıllar</option>' + years.map(function (y) { return '<option' + (String(y) === String(ui.dashYil) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">Dönem: ' + (Y || 'tüm yıllar') + ' · Toplama sayılarına süreci durmuş (iptal, erteleme, red, vazgeç, hasta ex) kayıtlar dahil değildir.</div>' +
      '<div class="kpis">' + kpi(num(R.kayitli), 'Kayıtlı donör') + kpi(num(R.skYap), 'Sağlık kontrolü yapılan') + kpi(num(R.topGer), 'Toplama gerçekleşen') +
      kpi(num(R.topPlan), 'Planlanan toplama') + kpi(num(R.durdu), 'Süreç durdu') + kpi(pct(R.oran), 'Gerçekleşme oranı') + '</div>';
    html += card('Şehir içi / şehir dışı', tbl(['', 'Sağlık kontrolü', 'Toplama'], [['Ankara içi', R.skAnk, R.topAnk], ['Ankara dışı', R.skDis, R.topDis]]), 'İKAMETİ’nde “Ankara” geçen donör şehir içi sayılır.');
    html += card('Toplama gerçekleşme', tbl(['Durum', 'Donör'], [['Gerçekleşen', R.topGer], ['Planlanan', R.topPlan], ['İptal · hasta ex', R.iptal], ['Erteleme', R.ertele], ['Red', R.red], ['Vazgeçme', R.vazgec], ['Gerçekleşme oranı', pct(R.oran)]]), 'Bir açıklamada birden fazla kelime varsa her biri ayrı sayılır.');
    html += card('Aylık toplama · ' + R.gy, barChart(DT.AYLAR, [R.aylik.map(function (m) { return m.ger; }), R.aylik.map(function (m) { return m.plan; })], ['#15803d', '#86c79c'], ['Gerçekleşen', 'Planlanan']) +
      tbl(['Ay', 'Gerçekleşen', 'Planlanan'], R.aylik.map(function (m) { return [m.ad, m.ger, m.plan]; })));
    var il = R.iller.slice(0, 15);
    html += card('Sağlık kontrolü · il bazlı', il.length ? tbl(['İl', 'Yapılan', 'Planlanan', 'Toplam'], il.map(function (r) { return [r.il, r.yap, r.plan, r.yap + r.plan]; })) : emptyBox('Sağlık kontrolü kaydı yok.'), R.iller.length > 15 ? '+' + (R.iller.length - 15) + ' il daha' : '');
    html += card('Hastane bazlı', tbl(['Hastane', 'Sağlık k. yapılan', 'Toplama gerç.'], R.hastane.map(function (r) { return [r.ad, r.sk, r.top]; })));
    html += card('Yöntem · ulaşım · konaklama', tbl(['Yöntem', 'Donör'], R.yontem.map(function (r) { return [r.ad, r.n]; })) + '<div class="hr"></div>' +
      tbl(['Ulaşım türü', 'Donör'], R.ulasim.map(function (r) { return [r.ad, r.n]; })) + '<div class="hr"></div>' + tbl(['Konaklama', 'Donör'], R.konaklama.map(function (r) { return [r.ad, r.n]; })),
      'Donörün toplama yılına (yoksa sağlık kontrolü yılına) göre sayılır.');
    var nk = R.nakil;
    html += card('Nakil merkezi · yurt içi / yurt dışı', tbl(['', 'Gerçekleşen', 'Planlanan'], [['Yurt içi', nk.yiGer, nk.yiPlan], ['Yurt dışı', nk.ydGer, nk.ydPlan], ['Girilmemiş', nk.yokGer, nk.yokPlan],
      ['Yurt dışı oranı', pct(nk.ydGer + nk.yiGer + nk.yokGer ? nk.ydGer / (nk.ydGer + nk.yiGer + nk.yokGer) : null), pct(nk.ydPlan + nk.yiPlan + nk.yokPlan ? nk.ydPlan / (nk.ydPlan + nk.yiPlan + nk.yokPlan) : null)]]) +
      (R.ulkeler.length ? '<div class="hr"></div>' + tbl(['Ülke', 'Toplama'], R.ulkeler.map(function (u) { return [u.ad, u.n]; })) : ''), 'Ülke, NAKİL MERKEZİ’ndeki parantezden okunur: YURT DIŞI (ALMANYA - ZKRD).');
    var kt = R.kargo.reduce(function (a, k) { return [a[0] + k.tk, a[1] + k.ase]; }, [0, 0]);
    html += card('Kargo · ' + R.gy, tbl(['Ay', 'Turkish', 'ASE', 'Toplam'], R.kargo.map(function (k) { return [k.ad, k.tk, k.ase, k.tk + k.ase]; }), ['Toplam', kt[0], kt[1], kt[0] + kt[1]]),
      'Yurt dışı nakil merkezli donörün hafta içi sağlık kontrolü günü (gün başına bir kargo): Pzt, Çar, Cuma Turkish · Salı, Perş. ASE.');
    html += card('Süreç süresi · sağlık kontrolünden toplamaya', tbl(['Hastane', 'Toplama', 'Ort. gün', 'En kısa', 'En uzun'], R.sureHastane.map(function (s) { return [s.ad, s.n, s.ort, s.min, s.max]; }), ['Tümü', R.sureTum.n, R.sureTum.ort, R.sureTum.min, R.sureTum.max]) +
      '<div class="row" style="margin-top:10px"><span class="small grow">Uzun süreç eşiği (gün)</span><input class="inp" type="number" min="1" style="width:90px" value="' + h(R.esik) + '" data-act-change="esik"></div>' +
      '<div class="small" style="margin-top:6px"><b>' + R.esikAsan + '</b> süreç bu eşiği aştı.</div><div class="hr"></div>' +
      tbl(['Ay (' + R.gy + ')', 'Ort. gün', 'Toplama'], R.sureAylik.map(function (s) { return [s.ad, s.ort == null ? '' : s.ort, s.n]; })));
    var nt = R.nedenler.reduce(function (a, n) { return a + n.n; }, 0);
    html += card('Süreç durma nedenleri', tbl(['Neden', 'Donör', 'Pay'], R.nedenler.map(function (n) { return [n.ad, n.n, pct(nt ? n.n / nt : null)]; }), ['Toplam', nt, '']) + '<div class="hr"></div>' +
      tbl(['Ay (' + R.gy + ')', 'Durdu', 'Gerçekleşen', 'Durma oranı'], R.durmaAylik.map(function (m) { return [m.ad, m.durdu, m.ger, pct(m.oran)]; })),
      'Hasta: “hasta kaynaklı”, “hastası”, hasta ex · Nakil merkezi: “merkez” · Bağışçı sağlık: “red”, “muayene” · Vazgeçme: “bağışçı”, “vazgeç”.');
    var yk = R.yilKars;
    html += card('Yıl karşılaştırması · gerçekleşen toplama', barChart(DT.AYLAR, [yk.map(function (m) { return m.once; }), yk.map(function (m) { return m.bu || 0; })], ['#9fb3c8', '#0f4c5c'], [String(R.gy - 1), String(R.gy)]) +
      tbl(['Ay', String(R.gy - 1), String(R.gy), 'Fark'], yk.map(function (m) { return [m.ad, m.once, m.bu == null ? '' : m.bu, m.bu == null ? '' : m.bu - m.once]; })),
      'Yılbaşından ' + DT.parts(today).d + ' ' + DT.AYLAR[DT.parts(today).m - 1] + '’e: ' + (R.gy - 1) + ' → ' + R.ytd.once + ' · ' + R.gy + ' → ' + R.ytd.bu);
    html += card('Önümüzdeki 4 hafta · iş yükü', tbl(['Hafta', 'Sağlık k.', 'Aşı baş.', 'Toplama', 'Taşıma', 'Yatış', 'Toplam'], R.dortHafta.map(function (w, i) { return [DT.fmtShort(w.bas) + (i === 0 ? ' •' : ''), w.sk, w.asi, w.top, w.tas, w.yat, w.toplam]; })),
      '• bu hafta. Hafta başlangıcı (pazartesi) yazılıdır. Süreci durmuş donörler sayılmaz. Aşı başlangıcı = aşının 1. günü. Yurt dışı ürünleri sayılmaz.');
    html += card('Haftanın günlerine göre', tbl(['Gün', 'Sağlık kontrolü', 'Toplama'], R.gunler.map(function (g) { return [g.ad, g.sk, g.top]; })));
    var ikT = R.ikamet.reduce(function (a, r) { return a + r.donor; }, 0);
    html += card('İkamet · Ankara içi / dışı', tbl(['İkamet', 'Donör', 'Sağlık k.', 'Toplama', 'Pay'], R.ikamet.map(function (r) { return [r.ad, r.donor, r.sk, r.top, pct(ikT ? r.donor / ikT : null)]; })));
    var pa = R.persAy;
    var ayOpts = '<option value="">Bu ay</option>' + DT.AYLAR.map(function (a, i) { return '<option value="' + (i + 1) + '"' + (String(ui.dashAy) === String(i + 1) ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    html += card('Personel iş yükü · ' + DT.AYLAR[pa.m - 1] + ' ' + pa.y, '<div class="toolbar"><select class="inp" data-ui="dashAy">' + ayOpts + '</select></div>' +
      tbl(['Personel', 'Sağlık k.', 'Aşı', 'Toplama', 'Taşıma', 'Toplam'], pa.rows.map(function (r) { return [r.ad, r.sk, r.asi, r.top, r.tas, r.sk + r.asi + r.top + r.tas]; })),
      'Görev günleri sayılır (aşı günü = 4 günün her biri; sabah-akşam ayrı). Ürün taşıma taşıyan personele yazılır.');
    var py = R.persYil;
    html += card('Personel iş yükü · ' + py.y, tbl(['Personel', 'SK', 'Aşı', 'Top.', 'Yatış', 'Taşıma', 'Ek kons.', 'Toplam', 'Yapılan', 'Plan.', 'Pay'], py.rows.map(function (r) { return [r.ad, r.sk, r.asi, r.top, r.yat, r.tas, r.ek, r.toplam, r.yapilan, r.plan, pct(r.pay)]; })) +
      '<div class="hr"></div>' + tbl(['Özet', 'Değer'], [['Toplam görev', py.toplam], ['Personele atanan', py.atanan], ['Atanma oranı', pct(py.oran)], ['Görev alan personel', py.aktif], ['Personel başına ortalama', py.ort == null ? '–' : py.ort], ['En çok görev alan', py.enCok], ['En az görev alan', py.enAz]]));
    html += card('Önümüzdeki 4 hafta · personel planı', tbl(['Personel'].concat(R.dortHafta.map(function (w) { return DT.fmtShort(w.bas); })).concat(['Toplam']), R.persHafta.map(function (r) { return [r.ad].concat(r.weeks).concat([r.toplam]); })));
    var dl = R.dli;
    html += card('DLİ', tbl(['', 'Donör', 'Pay'], [['DLİ kaydı', dl.kayit, pct(dl.kayitPay)], ['Toplama gerçekleşen', dl.ger, pct(dl.gerPay)], ['Planlanan toplama', dl.plan, pct(dl.planPay)], ['Süreç durdu', dl.durdu, pct(dl.durduPay)]]) +
      '<div class="hr"></div>' + tbl(['Hastane', 'DLİ kaydı', 'Toplama gerç.'], dl.hastane.map(function (r) { return [r.ad, r.kayit, r.ger]; })), 'AÇIKLAMA’da ayrı kelime olarak DLİ geçen kayıtlar.');
    html += '</div>';
    return { title: 'Dashboard', html: html };
  }

  /* ---------------- Haftalık Program ---------------- */
  function planWeek() {
    if (ui.weekStart == null) ui.weekStart = DT.weekStart(today);
    var ws = ui.weekStart, a = DT.parts(ws), b = DT.parts(ws + 6);
    var html = '<div class="datebar"><button class="icon" data-act="weekMove" data-v="-7">' + I.left + '</button><div class="inp center">' +
      a.d + ' ' + DT.AYLAR[a.m - 1] + ' – ' + b.d + ' ' + DT.AYLAR[b.m - 1] + ' ' + b.y + '</div><button class="icon" data-act="weekMove" data-v="7">' + I.right + '</button></div>' +
      '<div class="toolbar"><select class="inp" data-ui="hwP">' + persOptions(ui.hwP, 'Herkes') + '</select><button class="btn sm" data-act="weekNow">Bu hafta</button></div>';
    var total = 0, body = '';
    for (var k = 0; k < 7; k++) {
      var s = ws + k, p = DT.parts(s);
      var list = DT.calendarTasks(pool, D, s, s + 1, ui.hwP || '').filter(function (t) { return !(t.slot === 7 && t.yd); });
      total += list.length;
      body += '<div class="dayhead' + (s === today ? ' today' : '') + (holMap[s] ? ' hol' : '') + '"><span>' + pad2(p.d) + '.' + pad2(p.m) + '.' + p.y + ' (' + DT.GUNLER_B[k] + ') ÇALIŞMA PROGRAMIMIZ</span>' +
        (holMap[s] ? '<span class="tiny">' + h(holMap[s]) + '</span>' : '') + '<button class="btn sm ghost" data-act="progFor" data-v="' + s + '">Program</button></div>' +
        '<div class="card">' + (list.length ? list.map(function (t) { return taskCard(t); }).join('') : emptyBox('Bu gün için görev yok.')) + '</div>';
    }
    return html + '<div class="summary">' + total + ' görev' + (ui.hwP ? ' · ' + h(ui.hwP) : '') + ' · Personel düğmesinden göreve kişi atayın; seçim programa ve tüm sayfalara geçer. Yurt dışı ürün taşıma bu sayfada yer almaz.</div>' + body;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------- Ajanda ---------------- */
  function planAjanda() {
    if (ui.ajDate == null) ui.ajDate = today;
    var s = ui.ajDate, p = DT.parts(s), cnt = pool.filter(function (t) { return t.date === s; }).length;
    var notes = state.ajanda.filter(function (a) { return a.tarih === s; });
    var html = '<div class="datebar"><button class="icon" data-act="ajMove" data-v="-1">' + I.left + '</button><input class="inp" type="date" value="' + DT.iso(s) + '" data-ui="ajDate" data-type="date">' +
      '<button class="icon" data-act="ajMove" data-v="1">' + I.right + '</button></div>' +
      '<div class="dayhead' + (s === today ? ' today' : '') + (holMap[s] ? ' hol' : '') + '"><span>' + p.d + ' ' + DT.AYLAR_B[p.m - 1] + ' ' + p.y + '  ·  ' + DT.GUNLER_B[DT.weekday(s) - 1] +
      (holMap[s] ? '  ·  ' + h(holMap[s]) : '') + (cnt ? '  ·  ' + cnt + ' görev' : '') + (s === today ? '  ·  BUGÜN' : '') + '</span>' + (s !== today ? '<button class="btn sm ghost" data-act="ajSet" data-v="' + today + '">Bugüne git</button>' : '') + '</div><div class="card agenda">';
    var row = function (saat, list) {
      return '<div class="arow"><div class="atime">' + (saat || 'Serbest') + '</div><div class="anotes">' + list.map(function (a) {
        var cls = a.durum === 'PROGRAMA EKLE' || a.durum === 'EVET' ? 'p-pri' : a.durum === 'YAPILDI' ? 'p-top' : a.durum === 'İPTAL' ? 'p-grey' : '';
        return '<button class="anote' + (a.durum === 'İPTAL' ? ' cancel' : '') + '" data-act="ajEdit" data-id="' + h(a.id) + '"><span class="at">' + h(a.not) + '</span><span class="am">' +
          (a.personel ? '<span class="pillx p-grey">' + h(a.personel) + '</span>' : '') + (a.durum ? '<span class="pillx ' + cls + '">' + h(a.durum) + '</span>' : '') +
          (a.tur ? '<span class="pillx p-or">' + h(a.tur) + '</span>' : '') + '</span></button>';
      }).join('') + '<button class="aadd" data-act="ajNew" data-saat="' + (saat || '') + '">' + I.plus + '</button></div></div>';
    };
    DT.AJANDA_SAATLER.forEach(function (h0) { html += row(h0, notes.filter(function (a) { return a.saat === h0; })); });
    html += row('', notes.filter(function (a) { return DT.AJANDA_SAATLER.indexOf(a.saat) < 0; }));
    html += '</div><div class="note" style="margin:8px 4px">Programa girmesini istediğiniz notta DURUM: PROGRAMA EKLE seçin (personel seçerseniz onun altına, seçmezseniz NOTLAR başlığı altına yazılır). Biten işi YAPILDI, vazgeçileni İPTAL yapın.</div>';
    var up = state.ajanda.filter(function (a) { return a.tarih > s && a.durum !== 'YAPILDI' && a.durum !== 'İPTAL'; }).sort(function (a, b) { return a.tarih - b.tarih || S(a.saat).localeCompare(S(b.saat)); }).slice(0, 8);
    if (up.length) html += '<div class="sec-title">Sonraki notlar</div><div class="card">' + up.map(function (a) {
      return '<div class="trow" data-act="ajEdit" data-id="' + h(a.id) + '"><div class="h"><span class="name">' + h(a.not) + '</span><span class="pillx p-pri">' + DT.fmtShort(a.tarih) + (a.saat ? ' ' + a.saat : '') + '</span></div>' +
        '<div class="small muted">' + h([a.personel, a.durum, a.tur].filter(Boolean).join(' · ') || '—') + '</div></div>';
    }).join('') + '</div>';
    return html;
  }
  function ajForm(a, saat) {
    var isNew = !a;
    a = a || { id: DT.uid(), tarih: ui.ajDate || today, saat: saat || '', not: '', personel: '', durum: 'PROGRAMA EKLE', tur: '' };
    var durs = ['', 'PROGRAMA EKLE', 'YAPILDI', 'İPTAL'];
    openSheet('<h3>' + (isNew ? 'Not ekle' : 'Notu düzenle') + '</h3><form id="ajform"><div class="grid2">' +
      '<div class="field"><label>Tarih</label><input class="inp" type="date" name="tarih" value="' + DT.iso(a.tarih) + '" required></div>' +
      '<div class="field"><label>Saat</label><select class="inp" name="saat"><option value="">Serbest</option>' + DT.AJANDA_SAATLER.map(function (x) { return '<option' + (x === a.saat ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label>Not</label><textarea class="inp" name="not" rows="2" autocapitalize="characters">' + h(a.not) + '</textarea></div>' +
      '<div class="grid2"><div class="field"><label>Personel</label><select class="inp" name="personel">' + persOptions(a.personel, '— (NOTLAR) —') + '</select></div>' +
      '<div class="field"><label>Durum</label><select class="inp" name="durum">' + durs.map(function (x) { return '<option value="' + x + '"' + (x === a.durum ? ' selected' : '') + '>' + (x || '—') + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label>Tür</label><select class="inp" name="tur">' + listOptions(state.lists.isTuru || [], a.tur, '—') + '</select></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="ajDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#ajform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: a.id, tarih: DT.fromIso(f.tarih.value), saat: f.saat.value, not: f.not.value.trim(), personel: f.personel.value, durum: f.durum.value, tur: f.tur.value };
      if (o.tarih == null || !o.not) { toast('Tarih ve not girin'); return; }
      var k = state.ajanda.findIndex(function (z) { return z.id === a.id; });
      if (k >= 0) state.ajanda[k] = o; else state.ajanda.push(o);
      closeSheet(); commit(); toast('Kaydedildi');
    });
    var del = $('#ajDel');
    if (del) del.onclick = function () { state.ajanda = state.ajanda.filter(function (z) { return z.id !== a.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Ek Konsültasyon ---------------- */
  function takipKons() {
    var t = today, list = state.ekKons.slice();
    var up = list.filter(function (e) { return e.tarih == null || e.tarih >= t; }).sort(function (a, b) { return (a.tarih || 9e9) - (b.tarih || 9e9); });
    var past = list.filter(function (e) { return e.tarih != null && e.tarih < t; }).sort(function (a, b) { return b.tarih - a.tarih; });
    var row = function (e) {
      var x = DT.konsDonor(D, e.hastaKodu), dur = DT.konsDurum(D, e, t), who = DT.konsPersonel(D, e);
      var cls = dur === 'BUGÜN' ? 'p-top' : dur.indexOf('Yapıldı') === 0 ? 'p-grey' : (dur.indexOf('yok') >= 0 || dur.indexOf('Tarih') === 0) ? 'p-red' : 'p-sk';
      return '<div class="trow" data-act="konsEdit" data-id="' + h(e.id) + '"><div class="h"><span class="name">' + h(x ? x.d.ad : e.hastaKodu || '—') + '</span><span class="pillx ' + cls + '">' + h(dur) + '</span></div><dl class="kv">' +
        '<dt>Tarih</dt><dd>' + (e.tarih != null ? h(dateLong(e.tarih)) : '—') + '</dd><dt>Hasta kodu</dt><dd>' + h([e.hastaKodu, x ? x.d.dno : ''].filter(Boolean).join(' · ')) + '</dd>' +
        (e.bolum ? '<dt>Bölüm</dt><dd>' + h(e.bolum) + '</dd>' : '') + (x ? '<dt>Hastane</dt><dd>' + h(x.d.hastane) + '</dd>' + (x.d.tel ? '<dt>Telefon</dt><dd>' + h(x.d.tel) + '</dd>' : '') + '<dt>Sağlık k.</dt><dd>' + h(DT.fmt(x.d.sk) || '—') + '</dd>' : '') +
        '<dt>Programda</dt><dd>' + h(who || 'PERSONEL ATANMAMIŞ') + (e.personel ? ' (değiştirildi)' : '') + '</dd></dl></div>';
    };
    var today0 = list.filter(function (e) { return e.tarih === t; }).length;
    return '<div class="summary">' + up.filter(function (e) { return e.tarih != null; }).length + ' yaklaşan konsültasyon · ' + today0 + ' bugün. Konsültasyon günü Çalışma Programı’nda sağlık kontrolüne bakan personelin altına “' + h(state.lists.prog.EkKons || 'EK KONSÜLTASYON') + '” olarak yazılır.</div>' +
      '<div class="card">' + (up.length ? up.map(row).join('') : emptyBox('Yaklaşan ek konsültasyon yok')) + '</div>' +
      (past.length ? '<div class="sec-title">Yapılanlar</div><div class="card">' + past.slice(0, 30).map(row).join('') + '</div>' : '') +
      '<button class="fab" data-act="konsNew" aria-label="Ek konsültasyon ekle">' + I.plus + '</button>';
  }
  function konsForm(e) {
    var isNew = !e;
    e = e || { id: DT.uid(), hastaKodu: '', tarih: today + 1, bolum: '', personel: '' };
    var codes = state.donors.filter(function (d) { return S(d.hk) && !(byId[d.id] && byId[d.id].stopped); }).slice(-300).reverse();
    var x = DT.konsDonor(D, e.hastaKodu);
    openSheet('<h3>' + (isNew ? 'Ek konsültasyon ekle' : 'Ek konsültasyon') + '</h3><form id="kform">' +
      '<div class="field"><label>Hasta kodu</label><input class="inp" name="hastaKodu" list="khk" value="' + h(e.hastaKodu) + '" autocapitalize="characters" required><datalist id="khk">' +
      codes.map(function (d) { return '<option value="' + h(d.hk) + '">' + h(d.ad) + '</option>'; }).join('') + '</datalist></div>' +
      '<div class="field"><label>Konsültasyon tarihi</label><input class="inp" type="date" name="tarih" value="' + DT.iso(e.tarih) + '" required></div>' +
      '<div class="field"><label>Bölüm / açıklama</label><input class="inp" name="bolum" value="' + h(e.bolum) + '" autocapitalize="characters"></div>' +
      '<div class="field"><label>Personel (değiştir)</label><select class="inp" name="personel">' + persOptions(e.personel, 'Sağlık kontrolüne bakan' + (x && x.pers[1] ? ' (' + x.pers[1] + ')' : '')) + '</select></div>' +
      '<div class="btns">' + (isNew ? '<button type="button" class="btn" data-act="closeSheet">Vazgeç</button>' : '<button type="button" class="btn danger" id="kDel">Sil</button>') + '<button class="btn pri">Kaydet</button></div></form>');
    var f = $('#kform');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var o = { id: e.id, hastaKodu: upperTR(f.hastaKodu.value.trim()), tarih: DT.fromIso(f.tarih.value), bolum: upperTR(f.bolum.value.trim()), personel: f.personel.value };
      if (!o.hastaKodu || o.tarih == null) { toast('Hasta kodu ve tarih girin'); return; }
      if (!DT.konsDonor(D, o.hastaKodu)) toast('Uyarı: hasta kodu Donör Kayıt’ta yok');
      var k = state.ekKons.findIndex(function (z) { return z.id === e.id; });
      if (k >= 0) state.ekKons[k] = o; else state.ekKons.push(o);
      closeSheet(); commit();
    });
    var del = $('#kDel');
    if (del) del.onclick = function () { state.ekKons = state.ekKons.filter(function (z) { return z.id !== e.id; }); closeSheet(); commit(); toast('Silindi'); };
  }

  /* ---------------- Donör Raporu ---------------- */
  function raporRows() {
    return D.filter(function (x) {
      if (!x.durum) return false;
      if (ui.rpF === 'devam' && (x.stopped || x.durum === 'Toplama yapıldı')) return false;
      if (ui.rpF === 'yapildi' && x.durum !== 'Toplama yapıldı') return false;
      if (ui.rpF === 'durdu' && !x.stopped) return false;
      if (ui.rpH && !eqi(x.d.hastane, ui.rpH)) return false;
      if (ui.rpY && !((x.d.top != null ? DT.year(x.d.top) : x.d.sk != null ? DT.year(x.d.sk) : null) === +ui.rpY)) return false;
      return true;
    });
  }
  function scrRapor() {
    ui.rpF = ui.rpF || 'all';
    var rows = raporRows(), yap = rows.filter(function (x) { return x.durum === 'Toplama yapıldı'; }).length, dur = rows.filter(function (x) { return x.stopped; }).length;
    var html = '<div class="page flush">' + groupSeg('arsiv', '/arsiv/rapor') + '<div class="seg sub">' +
      [['all', 'Tümü'], ['devam', 'Devam eden'], ['yapildi', 'Toplama yapıldı'], ['durdu', 'Süreç durdu']].map(function (f) { return '<button class="' + (ui.rpF === f[0] ? 'on' : '') + '" data-act="rpF" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<div class="toolbar"><select class="inp" data-ui="rpH"><option value="">Tüm hastaneler</option>' + state.lists.hastane.map(function (e) { return '<option' + (eqi(e.ad, ui.rpH) ? ' selected' : '') + '>' + h(e.ad) + '</option>'; }).join('') + '</select>' +
      '<select class="inp" data-ui="rpY"><option value="">Tüm yıllar</option>' + yearsInData().map(function (y) { return '<option' + (String(y) === String(ui.rpY) ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></div>' +
      '<div class="summary">Rapor tarihi: ' + DT.fmt(today) + ' · ' + rows.length + ' donör · Toplama yapıldı: ' + yap + ' · Devam eden: ' + (rows.length - yap - dur) + ' · Süreç durdu: ' + dur + '</div>' +
      '<button class="btn pri block" data-act="exportRapor" style="margin-bottom:10px">' + I.down + 'Excel’e aktar (Donör Raporu)</button>' +
      '<div class="card list">' + rows.slice().reverse().slice(0, ui.rpLimit || 80).map(function (x) {
        var d = x.d;
        return '<a class="item" data-act="donor" data-id="' + h(d.id) + '"><div class="t1"><span class="name">' + h(d.ad) + '</span><span class="pillx ' + durumCls(x.durum) + '">' + h(x.durum) + '</span></div>' +
          '<div class="t2">' + h([d.hk, d.hastane, d.yontem].filter(Boolean).join(' · ')) + '</div><div class="t2 muted">' +
          h(['SK ' + (DT.fmt(d.sk) || '—'), 'Toplama ' + (DT.fmt(d.top) || '—'), d.bolge].filter(Boolean).join(' · ')) + '</div></a>';
      }).join('') + '</div>' + (rows.length > (ui.rpLimit || 80) ? '<button class="btn block" data-act="rpMore">Daha fazla göster</button>' : '') + '</div>';
    return { title: 'Donör Raporu', html: html };
  }

  /* ---------------- Kılavuz ---------------- */
  var KILAVUZ = [
    ['Ana Sayfa', 'Uygulama açılınca gelen ilk sayfa. Dört grup düğmesi vardır: PLANLAMA, TAKİP, DONÖR KAYIT VE ARŞİV, DASHBOARD. Gruba dokununca o grubun sayfaları açılır; her sayfanın üstündeki düğmelerle gruptaki sayfalar arasında geçilir. Alttaki sekmeler de gruplara gider. Üstteki kutucuklar bugünkü ve yarınki görev sayısını, geri sayım uyarılarını ve kontrol notlarını gösterir.'],
    ['Yeni donör eklemek', 'Ana Sayfa’daki YENİ DONÖR EKLE ya da Donör Kayıt’taki + düğmesine dokunun. Toplama tarihini yazınca aşı başlama tarihi 4 gün öncesi olur; ONKOLOJİ’de AÇIKLAMA’ya 20 kg ya da altı bir kilo yazılırsa (ör. “18 kg”) 3 gün öncesi olur. Farklı tarih gerekirse “Elle tarih” seçin. KEMİK İLİĞİ’nde aşı yoktur. Son izlem toplamadan 20 gün sonradır.'],
    ['Otomatik görevler', 'Sağlık kontrolü tarihinde SAĞLIK KONTROLÜ; aşı başlama tarihinde ve sonraki 3 günde AŞI (1.–4. gün; sabah-akşam hastanelerinde sabah ve akşam ayrı); toplama tarihinde TOPLAMA ve ürünün gideceği yer HASTANE-BAŞLIK biçiminde (ör. ONKOLOJİ-AVRUPA). KEMİK İLİĞİ ve BİLKENT PEDİATRİ olan donörde toplamadan bir gün önce HASTANE YATIŞ oluşur.'],
    ['Personel atama', 'Her görevin yanındaki personel düğmesine dokunup kişi seçin. Seçim Takvim, Haftalık Program, Çalışma Programı, takip listeleri ve Dashboard’a yansır. “Varsayılan” seçilirse Donör Kayıt’taki İLGİLENEN PERSONEL (ürün taşımada TAŞIYAN PERSONEL) kullanılır.'],
    ['Takvim', 'Ay ay görünüm. Renkler: mavi sağlık kontrolü, turuncu aşı, yeşil toplama, koyu yeşil ürün taşıma, mor hastane yatış; kırmızı zemin resmi tatil. Bir güne dokununca o günün görevleri altta listelenir.'],
    ['Çalışma Programı', 'Seçilen günün (varsayılan yarın) programını WhatsApp metni olarak hazırlar: başlık, her personelin adı ve altında görevleri, NOTLAR, ürün taşıma satırları, kargo satırı (yurt dışı nakil merkezli donörün sağlık kontrolü varsa), hafta içi sabit satırlar ve İYİ ÇALIŞMALAR. WhatsApp düğmesi metni doğrudan paylaşır.'],
    ['Haftalık Program', 'Haftanın 7 günü alt alta, her günün görevleri ve atanmış personel. Görevlere buradan da kişi atanabilir.'],
    ['Ajanda', 'Her gün 08:00–18:00 saatleri ve serbest satır. Programa girmesini istediğiniz notta DURUM: PROGRAMA EKLE seçin; personel seçerseniz onun altına, seçmezseniz NOTLAR başlığı altına yazılır.'],
    ['Görev Listesi', 'Geri sayım uyarıları: aşı başlangıcı, sağlık kontrolü, toplama ve ürün taşıma. İKAMETİ’nde “Ankara” yazmayanlarda 10 gün (YÜKSEK), yazanlarda 5 gün (ORTA) önceden; ürün taşımada şehir dışı 10, Ankara içi 5 gün önceden.'],
    ['Takip sayfaları', 'Sağlık Kontrolü, Aşı, Toplama, Ürün Taşıma, Son İzlem ve IDM sayfaları bugün ya da sonrasındaki kayıtları en yakın tarih üstte olacak şekilde listeler. Hafta sonu ya da resmi tatile denk gelen tarih turuncu görünür.'],
    ['Ek Konsültasyon', 'HASTA KODU ve KONSÜLTASYON TARİHİ girin; donör bilgileri ve sağlık kontrolüne bakan personel kendiliğinden gelir. Başka biri gidecekse PERSONEL (DEĞİŞTİR) seçin. Konsültasyon günü programa yazılır.'],
    ['İptal / erteleme / red / vazgeçme / hasta ex', 'AÇIKLAMA’ya iptal, erteleme, red, vazgeç ya da hasta ex yazılan donör takvimden, programlardan, uyarılardan ve takip listelerinden çıkar; Dashboard’da “süreç durdu” sayılır. Kelime silinince donör planlara geri döner.'],
    ['KONTROL', 'Donör kaydındaki eksik ya da uyumsuz bilgiler (yöntem, hastane, nakil merkezi yok; personel listede yok; sağlık kontrolü aşıdan ya da toplamadan sonra; aşı toplamadan sonra; son izlem toplamadan önce) kaydın üstünde turuncu kutuda yazar.'],
    ['Donör Raporu', 'Yöneticiye göndermek için temiz kopya: DURUM sütunuyla birlikte. Süzüp “Excel’e aktar” ile .xlsx olarak kaydedebilirsiniz.'],
    ['Listeler', 'Personel, hastane (ve programdaki adı), yöntem, ulaşım, konaklama, sabah-akşam aşı hastaneleri, resmi tatiller, nakil merkezi anahtar kelimeleri ve programdaki yazılışlar buradan değiştirilir.'],
    ['Veriler ve yedek', 'Veriler yalnızca bu telefonda saklanır. Ayarlar’dan düzenli yedek alın; Excel’den içe aktarma mevcut verinin yerine geçer, önceki veri saklanır ve geri yüklenebilir.']
  ];
  function scrKilavuz() {
    return { title: 'Kılavuz', html: '<div class="page flush">' + groupSeg('arsiv', '/arsiv/kilavuz') + '<div class="card">' + KILAVUZ.map(function (k) {
      return '<details class="kl"><summary>' + h(k[0]) + '</summary><div>' + h(k[1]) + '</div></details>';
    }).join('') + '</div></div>' };
  }

  /* ---------------- Ayarlar ---------------- */
  function scrSettings() {
    var prev = null; try { prev = localStorage.getItem(PREV); } catch (e) { /* yok */ }
    var size = 0; try { size = (localStorage.getItem(KEY) || '').length; } catch (e) { /* yok */ }
    var html = '<div class="page"><div class="sec-title">Veri</div><div class="card pad">' +
      '<div class="small muted" style="margin-bottom:12px">' + state.donors.length + ' donör · ' + Object.keys(state.overrides).length + ' personel ataması · ' + state.ekGorevler.length + ' ek görev · ' + state.ekKons.length + ' ek konsültasyon · ' + state.ajanda.length + ' ajanda notu · ' + Math.round(size / 1024) + ' KB. Veriler yalnızca bu telefonda saklanır; düzenli yedek alın.</div>' +
      '<button class="btn pri block" data-act="import" style="margin-bottom:8px">' + I.up + 'Excel’den içe aktar (.xlsx)</button>' +
      '<button class="btn block" data-act="exportXlsx" style="margin-bottom:8px">' + I.down + 'Excel’e aktar (Donör Kayıt)</button>' +
      '<div class="btns" style="margin-bottom:8px"><button class="btn" data-act="backup">' + I.down + 'Yedek al</button><button class="btn" data-act="importJson">' + I.up + 'Yedekten yükle</button></div>' +
      (prev ? '<button class="btn ghost block" data-act="restorePrev">İçe aktarmadan önceki veriye dön</button>' : '') +
      '</div><div class="sec-title">Listeler</div><div class="card pad"><div class="small muted" style="margin-bottom:10px">Personel, hastaneler, resmi tatiller, nakil merkezi anahtar kelimeleri ve programdaki yazılışlar.</div>' +
      '<button class="btn block" data-act="goto" data-h="/ayarlar/listeler">Listeleri düzenle</button></div>' +
      '<div class="sec-title">Nasıl çalışır?</div><div class="card pad small" style="line-height:1.55">' +
      'Toplama tarihi girilince aşı 4 gün önce (ONKOLOJİ’de 20 kg ve altı için 3 gün önce) başlar; kemik iliğinde aşı yoktur. Son izlem toplamadan 20 gün sonradır. ' +
      'Sağlık kontrolü, aşı (1.–4. gün; sabah-akşam hastanelerinde iki ayrı görev), toplama, ürün taşıma ve BİLKENT PEDİATRİ kemik iliği için hastane yatış görevleri kendiliğinden oluşur. ' +
      'Açıklamaya iptal, erteleme, red, vazgeç ya da hasta ex yazılan donör tüm plan ve listelerden çıkar. Görevlere kişi atamak için görevin yanındaki personel düğmesine dokunun.</div>' +
      '<div class="sec-title">Tehlikeli bölge</div><div class="card pad"><button class="btn danger block" data-act="wipe">Tüm verileri sil</button></div>' +
      '<div class="note right" style="margin:8px 6px">Donör Takip ' + h(NB && NB.appVersion ? NB.appVersion() : 'web') + '</div></div>';
    return { title: 'Ayarlar', back: true, html: html, tab: 'home' };
  }
  function scrLists() {
    var L = state.lists;
    var ta = function (name, label, lines, hint) {
      return '<div class="field"><label>' + label + '</label><textarea class="inp" name="' + name + '" rows="' + Math.min(10, Math.max(3, lines.length + 1)) + '">' + h(lines.join('\n')) + '</textarea>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
    };
    var html = '<div class="page flush">' + groupSeg('arsiv', '/ayarlar/listeler') + '<form id="lform"><div class="card pad">' +
      ta('personel', 'Personel', L.personel, 'Her satıra bir kişi. Çalışma Programı’ndaki sıra bu sıradır.') +
      ta('hastane', 'Hastane | Programdaki adı', L.hastane.map(function (e) { return e.ad + (e.prog ? ' | ' + e.prog : ''); }), 'ör. ONKOLOJİ | ONKOLOJİ HASTANESİ') +
      ta('yontem', 'Yöntem', L.yontem) + ta('ulasim', 'Ulaşım türü', L.ulasim) + ta('konaklama', 'Konaklama', L.konaklama) +
      ta('asiCift', 'Sabah-akşam aşı hastaneleri', L.asiCift, 'Bu hastanelerde aşı sabah ve akşam iki ayrı görev olur.') +
      ta('tatiller', 'Resmi tatiller (GG.AA.YYYY | Ad)', L.tatiller.slice().sort(function (a, b) { return a.tarih - b.tarih; }).map(function (t) { return DT.fmt(t.tarih) + ' | ' + t.ad; }), 'Adında “arife” geçen günler yarım gün sayılır (sabit satırlar yazılır).') +
      ta('tasAnahtar', 'Nakil merkezi anahtar kelimesi | Şehir', L.tasAnahtar.map(function (e) { return e.kelime + ' | ' + e.sehir; }), 'Ürün taşıma uyarısı için şehir. Listede en altta eşleşen kelime geçerlidir.') +
      ta('basAnahtar', 'Başlık anahtar kelimesi | Başlık', L.basAnahtar.map(function (e) { return e.kelime + ' | ' + e.baslik; }), 'Takvim ve programdaki “HASTANE-BAŞLIK” satırı için (ör. AVRUPA, ANKARA).') +
      '<div class="formsec">Programdaki yazılışlar</div>' +
      DT.PROG_KEYS.map(function (k) { return '<div class="field"><label>' + h(k[1]) + '</label><input class="inp" name="prog_' + k[0] + '" value="' + h(L.prog[k[0]] || '') + '"></div>'; }).join('') +
      '</div><button class="btn pri block">Kaydet</button></form></div>';
    return {
      title: 'Listeler', back: true, html: html, tab: 'home', after: function () {
        $('#lform').addEventListener('submit', function (e) { e.preventDefault(); saveLists(e.target); });
      }
    };
  }
  function saveLists(f) {
    var lines = function (n) { return f[n].value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); };
    var pairs = function (n) { return lines(n).map(function (l) { var k = l.indexOf('|'); return k < 0 ? [l.trim(), ''] : [l.slice(0, k).trim(), l.slice(k + 1).trim()]; }); };
    var L = state.lists, bad = [];
    L.personel = lines('personel');
    L.hastane = pairs('hastane').map(function (p) { return { ad: p[0], prog: p[1] }; });
    L.yontem = lines('yontem'); L.ulasim = lines('ulasim'); L.konaklama = lines('konaklama'); L.asiCift = lines('asiCift');
    L.tatiller = pairs('tatiller').map(function (p) { var t = DT.parseDateText(p[0]); if (t == null) bad.push(p[0]); return { tarih: t, ad: p[1] }; }).filter(function (t) { return t.tarih != null; });
    L.tasAnahtar = pairs('tasAnahtar').map(function (p) { return { kelime: p[0], sehir: p[1] }; });
    L.basAnahtar = pairs('basAnahtar').map(function (p) { return { kelime: p[0], baslik: p[1] }; });
    DT.PROG_KEYS.forEach(function (k) { L.prog[k[0]] = f['prog_' + k[0]].value.trim(); });
    commit(false);
    toast(bad.length ? 'Kaydedildi · okunamayan tarih: ' + bad.slice(0, 3).join(', ') : 'Listeler kaydedildi');
  }

  /* ---------------- dosya, paylaşım ---------------- */
  function b64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function saveFile(bytes, name, mime) {
    if (NB && NB.saveFile) { window.onNativeFileSaved = function (ok) { toast(ok ? 'Dosya kaydedildi' : 'Dosya kaydedilmedi'); }; NB.saveFile(b64(bytes), name, mime); return; }
    var url = URL.createObjectURL(new Blob([bytes], { type: mime })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function copyText(text) {
    if (NB && NB.copyText) { NB.copyText(text); toast('Panoya kopyalandı'); return; }
    var done = function () { toast('Panoya kopyalandı'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('Kopyalanamadı'); } t.remove(); }
  }
  function shareText(text, wa) {
    if (NB) { if (wa && NB.shareWhatsApp) NB.shareWhatsApp(text); else NB.shareText(text); return; }
    if (wa) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); return; }
    if (navigator.share) navigator.share({ text: text }).catch(function () { /* iptal */ }); else copyText(text);
  }
  var fileMode = 'xlsx';
  function pickFile(mode) {
    fileMode = mode;
    var inp = $('#fileInput'); inp.value = '';
    inp.setAttribute('accept', mode === 'json' ? '.json,application/json' : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    inp.click();
  }
  function onFile(file) {
    if (!file) return;
    var reader = new FileReader();
    busy(true, 'Dosya okunuyor…');
    reader.onload = function () {
      var buf = reader.result, isJson = /\.json$/i.test(file.name) || fileMode === 'json' && !/\.xlsx$/i.test(file.name);
      if (isJson) {
        busy(false);
        try {
          var s = migrate(JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buf))));
          if (!Array.isArray(s.donors)) throw new Error('Yedek dosyası tanınmadı');
          confirmSheet('Yedekten yükle', s.donors.length + ' donör ve ' + Object.keys(s.overrides).length + ' personel ataması yüklenecek. Telefondaki mevcut veriler (' + state.donors.length + ' donör) bunlarla değiştirilecek.', 'Yükle', false, function () { replaceState(s, 'Yedek yüklendi'); });
        } catch (e) { toast('Yedek okunamadı: ' + e.message); }
        return;
      }
      setTimeout(function () {
        XLSXIO.importWorkbook(buf, window.DT_DEFAULT_LISTS).then(function (res) {
          busy(false);
          var r = res.report;
          confirmSheet('Excel’den içe aktar', file.name + '\n\n' + r.donors + ' donör · ' + r.overrides + ' personel ataması · ' + r.ekGorevler + ' ek görev · ' + (r.ekKons || 0) + ' ek konsültasyon · ' + (r.ajanda || 0) + ' ajanda notu' + (r.lists ? ' · listeler' : '') +
            '\n\nTelefondaki mevcut veriler (' + state.donors.length + ' donör) bunlarla değiştirilecek. Önceki veri saklanır; Ayarlar’dan geri dönebilirsiniz.', 'İçe aktar', false, function () { replaceState(res.state, r.donors + ' donör aktarıldı'); });
        }).catch(function (e) { busy(false); console.error(e); toast('İçe aktarılamadı: ' + e.message); });
      }, 30);
    };
    reader.onerror = function () { busy(false); toast('Dosya okunamadı'); };
    reader.readAsArrayBuffer(file);
  }
  function replaceState(s, msg) {
    try { if (state.donors.length) localStorage.setItem(PREV, JSON.stringify(state)); } catch (e) { /* yer yoksa geç */ }
    state = s; save(); recompute(); ui.calY = null; ui.calSel = null; ui.progDate = null;
    go('/', true); render(); toast(msg);
  }
  function stamp() { return DT.iso(today); }

  /* ---------------- olaylar ---------------- */
  var ACT = {
    goto: function (el) { go(el.dataset.h, !!el.dataset.replace); },
    back: function () { history.back(); },
    closeSheet: function () { closeSheet(); },
    donor: function (el) { go('/donor/' + el.dataset.id); },
    newDonor: function () { go('/donor/yeni'); },
    editDonor: function (el) { go('/donor/' + el.dataset.id + '/duzenle'); },
    delDonor: function (el) {
      var x = byId[el.dataset.id]; if (!x) return;
      confirmSheet('Kaydı sil', (x.d.ad || x.d.hk) + ' kaydı ve görev atamaları silinecek.', 'Sil', true, function () {
        state.donors = state.donors.filter(function (d) { return d.id !== x.d.id; });
        Object.keys(state.overrides).forEach(function (k) { if (k.indexOf(x.d.id + '|') === 0) delete state.overrides[k]; });
        save(); recompute(); toast('Kayıt silindi'); history.back();
      });
    },
    copyDonor: function (el) { var x = byId[el.dataset.id]; if (x) copyText(DT.donorLine(state.lists, x)); },
    pick: function (el) { pickPersonnel(el.dataset.id, el.dataset.slots.split(',').map(Number)); },
    dfilter: function (el) { ui.dfilter = el.dataset.v; ui.dlimit = 60; render(true); },
    more: function () { ui.dlimit += 100; render(true); },
    kontrolList: function () { ui.dfilter = 'kontrol'; ui.search = ''; go('/donorler'); },
    calMove: function (el) { var m = ui.calM + (+el.dataset.v), y = ui.calY; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } ui.calM = m; ui.calY = y; render(true); },
    calDay: function (el) { ui.calSel = +el.dataset.v; var p = DT.parts(ui.calSel); if (p.m !== ui.calM) { ui.calM = p.m; ui.calY = p.y; } render(true); },
    calToday: function () { var p = DT.parts(today); ui.calY = p.y; ui.calM = p.m; ui.calSel = today; if (route()[1] === 'takvim') render(true); else go('/plan/takvim'); },
    progFor: function (el) { ui.progDate = +el.dataset.v; go('/plan/program', true); },
    progMove: function (el) { ui.progDate = (ui.progDate || today + 1) + (+el.dataset.v); render(true); },
    progSet: function (el) { ui.progDate = +el.dataset.v; render(true); },
    copyProg: function () { copyText(DT.program(state, D, pool, ui.progDate).text); },
    shareProg: function (el) { shareText(DT.program(state, D, pool, ui.progDate).text, !!el.dataset.wa); },
    shareTomorrow: function () { shareText(DT.program(state, D, pool, today + 1).text, true); },
    ekNew: function (el) { if (el.dataset.v) ui.progDate = +el.dataset.v; ekForm(null); },
    ekEdit: function (el) { var e = state.ekGorevler.find(function (z) { return z.id === el.dataset.id; }); if (e) ekForm(e); },
    soon: function () { toast('Bu sayfa sonraki sürümde eklenecek'); },
    weekMove: function (el) { ui.weekStart = (ui.weekStart || DT.weekStart(today)) + (+el.dataset.v); render(true); },
    weekNow: function () { ui.weekStart = DT.weekStart(today); render(true); },
    ajMove: function (el) { ui.ajDate = (ui.ajDate || today) + (+el.dataset.v); render(true); },
    ajSet: function (el) { ui.ajDate = +el.dataset.v; render(true); },
    ajNew: function (el) { ajForm(null, el.dataset.saat); },
    ajEdit: function (el) { var a = state.ajanda.find(function (z) { return z.id === el.dataset.id; }); if (a) ajForm(a); },
    konsNew: function () { konsForm(null); },
    konsEdit: function (el) { var e = state.ekKons.find(function (z) { return z.id === el.dataset.id; }); if (e) konsForm(e); },
    rpF: function (el) { ui.rpF = el.dataset.v; ui.rpLimit = 80; render(true); },
    rpMore: function () { ui.rpLimit = (ui.rpLimit || 80) + 200; render(true); },
    exportRapor: function () {
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () { try { saveFile(XLSXIO.exportReport(state, D, today, raporRows()), 'Donor_Raporu_' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { toast('Hata: ' + e.message); } busy(false); }, 30);
    },
    import: function () { pickFile('xlsx'); },
    importJson: function () { pickFile('json'); },
    exportXlsx: function () {
      busy(true, 'Excel hazırlanıyor…');
      setTimeout(function () { try { saveFile(XLSXIO.exportDonors(state, D, today), 'Donor_Kayit_' + stamp() + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { toast('Hata: ' + e.message); } busy(false); }, 30);
    },
    backup: function () { saveFile(new TextEncoder().encode(JSON.stringify(state)), 'DonorTakip_yedek_' + stamp() + '.json', 'application/json'); },
    restorePrev: function () {
      var p; try { p = JSON.parse(localStorage.getItem(PREV)); } catch (e) { p = null; }
      if (!p) { toast('Önceki veri yok'); return; }
      confirmSheet('Önceki veriye dön', 'Son içe aktarmadan önceki ' + (p.donors || []).length + ' donörlük veri geri yüklenecek.', 'Geri yükle', false, function () {
        var cur = state; state = migrate(p); try { localStorage.setItem(PREV, JSON.stringify(cur)); } catch (e) { /* geç */ } save(); recompute(); go('/', true); render(); toast('Önceki veri yüklendi');
      });
    },
    wipe: function () {
      confirmSheet('Tüm verileri sil', 'Bu telefondaki tüm donör kayıtları, atamalar ve listeler silinecek. Önce yedek almanızı öneririz.', 'Hepsini sil', true, function () {
        try { localStorage.setItem(PREV, JSON.stringify(state)); } catch (e) { /* geç */ }
        state = DT.newState(window.DT_DEFAULT_LISTS); save(); recompute(); go('/', true); render(); toast('Veriler silindi');
      });
    }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var a = el.dataset.act;
    if (ACT[a]) { e.preventDefault(); e.stopPropagation(); ACT[a](el, e); }
  });
  var searchTimer;
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.ui === 'search') {
      ui.search = el.value; ui.dlimit = 60;
      clearTimeout(searchTimer); searchTimer = setTimeout(function () { var l = $('#dlist'); if (l) l.innerHTML = donorListHtml(); }, 120);
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.ui && el.dataset.ui !== 'search') {
      var v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.type === 'date') { v = DT.fromIso(el.value); if (v == null) return; }
      ui[el.dataset.ui] = v; render(true);
    } else if (el.dataset && el.dataset.actChange === 'esik') {
      var n = parseInt(el.value, 10); if (n > 0) { state.settings.esik = n; commit(); }
    }
  });
  $('#fileInput').addEventListener('change', function (e) { onFile(e.target.files[0]); });
  $('#btnBack').addEventListener('click', function () { history.back(); });
  $('#btnBack').innerHTML = I.back;
  $('#tabs').innerHTML = '<div class="in">' + TABS.map(function (t) {
    return '<button data-tab="' + t[0] + '" data-h="' + t[1] + '"><span class="pill">' + t[3] + '</span>' + t[2] + '</button>';
  }).join('') + '</div>';
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var cur = route()[0] || 'home';
    go(b.dataset.h, cur !== 'home');
  });
  window.addEventListener('hashchange', function (e) {
    var old = (e.oldURL || '').split('#')[1];
    if (old != null) ui.scroll['#' + old] = view.scrollTop;
    closeSheet(); render();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && DT.today() !== today) { recompute(); render(true); } });
  setInterval(function () { if (DT.today() !== today) { recompute(); render(true); } }, 60000);

  /* ---------------- Android köprüsü ---------------- */
  window.setInsets = function (top, bottom) {
    document.documentElement.style.setProperty('--sat', (top || 0) + 'px');
    document.documentElement.style.setProperty('--sab', (bottom || 0) + 'px');
  };
  window.handleBack = function () { return closeSheet(); };
  window.DTApp = { state: function () { return state; }, recompute: recompute, render: render, ui: ui };

  load(); recompute(); render();
})();
