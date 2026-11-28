'use strict';
/* Berber Randevu — tek dükkan için randevu, müşteri ve kasa takibi.
   Veriler telefonda saklanır (Android: uygulama dosyası + localStorage). */

// ---------------- Yardımcılar ----------------
const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const RENKLER = ['#b8894a', '#2f6fb0', '#2f8a57', '#a2456e', '#6a55b4', '#c2572f', '#1f8a8a', '#5d5a55'];
const DURUM = {
  bekliyor: { ad: 'Bekliyor', sinif: 'd-bek' },
  tamam: { ad: 'Tamamlandı', sinif: 'd-tam' },
  gelmedi: { ad: 'Gelmedi', sinif: 'd-gel' },
  iptal: { ad: 'İptal', sinif: 'd-ipt' }
};
const ODEME = { nakit: 'Nakit', kart: 'Kart', havale: 'Havale/IBAN' };
const VARSAYILAN_SABLON = 'Merhaba {ad}, {gun} ({tarih}) saat {saat} için {dukkan} randevunuzu hatırlatırız. Görüşmek üzere ✂️';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iki = n => String(n).padStart(2, '0');
const tarihStr = d => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const tarihObj = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const bugunStr = () => tarihStr(new Date());
const gunEkle = (s, n) => { const d = tarihObj(s); d.setDate(d.getDate() + n); return tarihStr(d); };
const gunNo = s => (tarihObj(s).getDay() + 6) % 7;
const dk = s => { if (!s) return null; const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
const saat = n => `${iki(Math.floor(n / 60) % 24)}:${iki(n % 60)}`;
const simdiDk = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const uzunTarih = s => { const d = tarihObj(s); return `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[gunNo(s)]}`; };
const kisaTarih = s => { const d = tarihObj(s); return `${d.getDate()} ${AYLAR[d.getMonth()]}`; };
const tarihTR = s => { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };
const para = n => '₺' + Math.round(+n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const trKucuk = s => String(s || '').toLocaleLowerCase('tr-TR');
const telTemiz = s => String(s || '').replace(/\D/g, '');
const telGoster = s => {
  const t = telTemiz(s);
  if (t.length === 11 && t[0] === '0') return `${t.slice(0, 4)} ${t.slice(4, 7)} ${t.slice(7, 9)} ${t.slice(9)}`;
  if (t.length === 10 && t[0] === '5') return `0${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6, 8)} ${t.slice(8)}`;
  return s || '';
};
const waNo = s => {
  let t = telTemiz(s);
  if (!t) return '';
  if (t.startsWith('00')) t = t.slice(2);
  if (t.length === 11 && t[0] === '0') t = '9' + t;
  else if (t.length === 10 && t[0] === '5') t = '90' + t;
  return t;
};
const basHarf = ad => String(ad || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toLocaleUpperCase('tr-TR') || '?';
const sayiId = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (Math.abs(h) % 2000000000) + 1; };
const android = () => typeof window.AndroidBridge !== 'undefined';

const IK = {
  tel: '<svg viewBox="0 0 24 24"><path d="M5 3.5h3.2l1.8 4.8-2.4 1.5a11.5 11.5 0 0 0 6.6 6.6l1.5-2.4 4.8 1.8V19a2 2 0 0 1-2 2A17.5 17.5 0 0 1 3 5.5a2 2 0 0 1 2-2z"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5l1.4-4.2a8.6 8.6 0 1 1 3.1 3z"/><path d="M9.2 8.6c-.2 2.9 3 6.2 6.2 6.2l.8-1.6-1.9-.9-.9.8a5.2 5.2 0 0 1-2.7-2.7l.8-.9-.9-1.9z"/></svg>',
  kisi: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.2 3.8-6.5 8-6.5s7.3 2.3 8 6.5"/></svg>',
  ara: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  takvim: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  makas: '<svg viewBox="0 0 108 108"><rect width="108" height="108" rx="24" fill="#1d1c1a"/><g fill="none" stroke="#c9a064" stroke-width="5.5" stroke-linecap="round"><circle cx="40" cy="70" r="9"/><circle cx="68" cy="70" r="9"/><path d="M45.5 62.5L71 28M62.5 62.5L37 28"/></g><circle cx="54" cy="50.4" r="3.2" fill="#1d1c1a"/></svg>'
};

// ---------------- Veri ----------------
function varsayilanSaatler() {
  return GUNLER.map((_, i) => ({ acik: i !== 6, bas: '09:00', bit: '21:00', araBas: '', araBit: '' }));
}
function varsayilanVeri() {
  return {
    surum: 1, kurulum: false,
    ayar: { dukkan: 'Berber Salonu', aralik: 15, hatirlatDk: 15, waSablon: VARSAYILAN_SABLON, saatler: varsayilanSaatler() },
    berberler: [{ id: 'b1', ad: 'Usta', renk: RENKLER[0] }],
    hizmetler: [
      { id: 'h1', ad: 'Saç kesimi', dk: 30, fiyat: 300 },
      { id: 'h2', ad: 'Sakal', dk: 15, fiyat: 150 },
      { id: 'h3', ad: 'Saç + Sakal', dk: 45, fiyat: 400 },
      { id: 'h4', ad: 'Çocuk saç kesimi', dk: 20, fiyat: 200 },
      { id: 'h5', ad: 'Yıkama + Fön', dk: 15, fiyat: 100 },
      { id: 'h6', ad: 'Cilt bakımı', dk: 30, fiyat: 350 }
    ],
    musteriler: [], randevular: []
  };
}
function duzenle(v) {
  const t = varsayilanVeri();
  if (!v || typeof v !== 'object') return t;
  v.ayar = Object.assign({}, t.ayar, v.ayar || {});
  if (!Array.isArray(v.ayar.saatler) || v.ayar.saatler.length !== 7) v.ayar.saatler = varsayilanSaatler();
  v.ayar.saatler = v.ayar.saatler.map(g => Object.assign({ acik: true, bas: '09:00', bit: '21:00', araBas: '', araBit: '' }, g));
  for (const k of ['berberler', 'hizmetler', 'musteriler', 'randevular']) if (!Array.isArray(v[k])) v[k] = [];
  if (!v.berberler.length) v.berberler = t.berberler;
  v.randevular.forEach(r => {
    if (!DURUM[r.durum]) r.durum = 'bekliyor';
    if (!Array.isArray(r.hizmetler)) r.hizmetler = [];
    r.dk = +r.dk || 30;
    r.tutar = +r.tutar || 0;
  });
  return v;
}
function veriYukle() {
  let s = '';
  try { if (android()) s = AndroidBridge.loadData() || ''; } catch (e) { s = ''; }
  if (!s) try { s = localStorage.getItem('berber_veri') || ''; } catch (e) { s = ''; }
  try { return duzenle(s ? JSON.parse(s) : null); } catch (e) { return varsayilanVeri(); }
}
let db = veriYukle();
let planZaman = null;
function kaydetVeri() {
  db.guncelleme = Date.now();
  const s = JSON.stringify(db);
  try { localStorage.setItem('berber_veri', s); } catch (e) { /* yer yoksa uygulama dosyası yeter */ }
  let ok = true;
  try { if (android()) ok = AndroidBridge.saveData(s) !== false; } catch (e) { ok = false; }
  if (!ok) tost('Kaydedilemedi! Telefonda yer olmayabilir.');
  clearTimeout(planZaman);
  planZaman = setTimeout(hatirlaticiPlanla, 400);
}

const musteri = id => db.musteriler.find(m => m.id === id);
const berber = id => db.berberler.find(b => b.id === id);
const hizmet = id => db.hizmetler.find(h => h.id === id);
const randevu = id => db.randevular.find(r => r.id === id);
const musteriAdi = r => musteri(r.mid)?.ad || r.mad || 'Müşteri';
const berberAdi = r => berber(r.bid)?.ad || r.bad || '—';
const berberRenk = r => berber(r.bid)?.renk || '#9a948c';
const hizmetAdlari = r => (r.hizmetler || []).map(h => h.ad).join(', ');
const cokluBerber = () => db.berberler.length > 1;
const gunSaati = t => db.ayar.saatler[gunNo(t)];
const bitis = r => dk(r.saat) + r.dk;
const saatSirala = (a, b) => dk(a.saat) - dk(b.saat) || (a.olusturma || 0) - (b.olusturma || 0);
const hizmetSure = ids => ids.map(hizmet).filter(Boolean).reduce((s, h) => s + (+h.dk || 0), 0);
const hizmetTutar = ids => ids.map(hizmet).filter(Boolean).reduce((s, h) => s + (+h.fiyat || 0), 0);
function varsayilanBerber() {
  if (ui.berber !== 'hepsi' && berber(ui.berber)) return ui.berber;
  return db.berberler[0]?.id;
}
function musteriRandevulari(mid) { return db.randevular.filter(r => r.mid === mid); }
function sonZiyaret(mid) {
  return musteriRandevulari(mid).filter(r => r.durum === 'tamam').sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat))[0];
}

function cakismalar(tarih, bid, bas, sure, haricId) {
  return db.randevular.filter(r => r.tarih === tarih && r.bid === bid && r.durum !== 'iptal' && r.id !== haricId &&
    bas < bitis(r) && bas + sure > dk(r.saat));
}
function slotlar(tarih, bid, sure, haricId) {
  const g = gunSaati(tarih), ar = +db.ayar.aralik || 15;
  if (!g.acik) return [];
  const bas = dk(g.bas), son = dk(g.bit);
  const araB = dk(g.araBas), araS = dk(g.araBit);
  const dolu = db.randevular.filter(r => r.tarih === tarih && r.bid === bid && r.durum !== 'iptal' && r.id !== haricId)
    .map(r => [dk(r.saat), bitis(r)]);
  const bugun = bugunStr(), simdi = simdiDk();
  const sonuc = [];
  for (let t = bas; t < son; t += ar) {
    let durum = 'bos';
    if (dolu.some(([a, b]) => t < b && t + sure > a)) durum = 'dolu';
    else if (araB != null && araS != null && araS > araB && t < araS && t + sure > araB) durum = 'ara';
    else if (t + sure > son) durum = 'tasma';
    else if (tarih < bugun || (tarih === bugun && t < simdi)) durum = 'gecmis';
    sonuc.push({ t, durum });
  }
  return sonuc;
}
function bosluklar(tarih, bid) {
  const g = gunSaati(tarih), ar = +db.ayar.aralik || 15, bugun = bugunStr();
  if (!g.acik || tarih < bugun) return [];
  const bloklar = db.randevular.filter(r => r.tarih === tarih && r.bid === bid && r.durum !== 'iptal').map(r => [dk(r.saat), bitis(r)]);
  if (g.araBas && g.araBit && dk(g.araBit) > dk(g.araBas)) bloklar.push([dk(g.araBas), dk(g.araBit)]);
  bloklar.sort((a, b) => a[0] - b[0]);
  let imlec = dk(g.bas);
  const son = dk(g.bit);
  if (tarih === bugun) imlec = Math.max(imlec, Math.ceil(simdiDk() / ar) * ar);
  const sonuc = [];
  for (const [a, b] of bloklar) {
    if (a > imlec) sonuc.push([imlec, Math.min(a, son)]);
    imlec = Math.max(imlec, b);
  }
  if (imlec < son) sonuc.push([imlec, son]);
  return sonuc.filter(([a, b]) => b - a >= ar);
}

// ---------------- Arayüz altyapısı ----------------
const ui = { sekme: 'takvim', gun: bugunStr(), berber: 'hepsi', mAra: '', rapor: 'ay', raporRef: bugunStr(), gecmisSlot: false };
const sheetler = [];
let aktifOnay = null;

function tost(m) {
  const t = $('#tost');
  t.textContent = m;
  t.classList.add('gor');
  clearTimeout(tost.z);
  tost.z = setTimeout(() => t.classList.remove('gor'), 2600);
}
function onayla(mesaj, evet = 'Evet', tehlike = false) {
  return new Promise(res => {
    const d = document.createElement('div');
    d.className = 'onay-arka';
    d.innerHTML = `<div class="onay"><p>${esc(mesaj)}</p><div><button class="btn" data-x="0">Vazgeç</button><button class="btn ${tehlike ? 'tehlike' : 'ana'}" data-x="1">${esc(evet)}</button></div></div>`;
    const bitir = v => { d.remove(); aktifOnay = null; res(v); };
    d.addEventListener('click', e => {
      const b = e.target.closest('[data-x]');
      if (b) bitir(b.dataset.x === '1'); else if (e.target === d) bitir(false);
    });
    aktifOnay = () => bitir(false);
    document.body.appendChild(d);
  });
}
function sheetAc(html, kur, secenek = {}) {
  const arka = document.createElement('div');
  arka.className = 'sh-arka';
  const sh = document.createElement('div');
  sh.className = 'sheet';
  sh.innerHTML = html;
  arka.appendChild(sh);
  document.body.appendChild(arka);
  document.body.classList.add('kilit');
  requestAnimationFrame(() => requestAnimationFrame(() => arka.classList.add('acik')));
  const o = { arka, sh, kapanmaz: !!secenek.kapanmaz, yenile: null };
  arka.addEventListener('click', e => { if (e.target === arka && !o.kapanmaz) sheetKapat(o); });
  sheetler.push(o);
  if (kur) kur(sh, o);
  return o;
}
function sheetKapat(o) {
  const i = o ? sheetler.indexOf(o) : sheetler.length - 1;
  if (i < 0) return;
  const [s] = sheetler.splice(i, 1);
  s.arka.classList.remove('acik');
  setTimeout(() => s.arka.remove(), 230);
  if (!sheetler.length) document.body.classList.remove('kilit');
}
function tumunuYenile() {
  ciz();
  sheetler.slice().forEach(s => { if (s.yenile) s.yenile(); });
}
window.geriTus = () => {
  if (aktifOnay) { aktifOnay(); return true; }
  const ust = sheetler[sheetler.length - 1];
  if (ust) { if (ust.kapanmaz) return false; sheetKapat(ust); return true; }
  if (ui.sekme !== 'takvim') { ui.sekme = 'takvim'; ciz(true); return true; }
  return false;
};

// ---------------- Ana çizim ----------------
function ciz(basaDon) {
  const k = $('#uygulama');
  if (ui.berber !== 'hepsi' && !berber(ui.berber)) ui.berber = 'hepsi';
  if (ui.sekme === 'takvim') k.innerHTML = takvimHtml();
  else if (ui.sekme === 'musteri') { k.innerHTML = musterilerHtml(); musteriListeCiz(); }
  else if (ui.sekme === 'kasa') k.innerHTML = kasaHtml();
  else k.innerHTML = ayarHtml();
  $$('#altMenu [data-s]').forEach(b => b.classList.toggle('aktif', b.dataset.s === ui.sekme));
  if (basaDon) window.scrollTo(0, 0);
}

// ---------------- Takvim ----------------
function takvimHtml() {
  const g = ui.gun, bugun = bugunStr(), yarin = gunEkle(bugun, 1);
  const haftaBas = gunEkle(g, -gunNo(g));
  const gunHtml = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const t = gunEkle(haftaBas, i);
    const say = db.randevular.filter(r => r.tarih === t && r.durum !== 'iptal' && (ui.berber === 'hepsi' || r.bid === ui.berber)).length;
    const nokta = Math.min(say, 3);
    return `<button class="gun ${t === g ? 'secili' : ''} ${t === bugun ? 'bugun' : ''} ${gunSaati(t).acik ? '' : 'kapali'}" data-act="gunSec" data-t="${t}">
      <div class="gk">${GUN_KISA[i]}</div><div class="gn">${tarihObj(t).getDate()}</div>
      <div class="gs">${'<i></i>'.repeat(nokta)}</div></button>`;
  }).join('');
  const d = tarihObj(g);
  const tekBerber = db.berberler.length === 1 ? db.berberler[0].id : (ui.berber !== 'hepsi' ? ui.berber : null);
  const rlar = db.randevular.filter(r => r.tarih === g && (ui.berber === 'hepsi' || r.bid === ui.berber)).sort(saatSirala);
  const aktif = rlar.filter(r => r.durum !== 'iptal');
  const tamam = aktif.filter(r => r.durum === 'tamam');
  const ciro = tamam.reduce((s, r) => s + (+r.tutar || 0), 0);
  const bekleyen = aktif.filter(r => r.durum === 'bekliyor');

  let filtre = '';
  if (cokluBerber()) {
    filtre = `<div class="kaydir"><button class="cip ${ui.berber === 'hepsi' ? 'secili' : ''}" data-act="berberFiltre" data-id="hepsi">Hepsi</button>` +
      db.berberler.map(b => `<button class="cip ${ui.berber === b.id ? 'secili' : ''}" data-act="berberFiltre" data-id="${b.id}" style="--renk:${b.renk}"><span class="nokta"></span>${esc(b.ad)}</button>`).join('') + '</div>';
  }

  let bant = '';
  const gs = gunSaati(g);
  if (!gs.acik) bant += `<div class="bant kapali-bant"><span class="ik">🔒</span><div><b>${GUNLER[gunNo(g)]} kapalı</b><span>Çalışma saatlerini Ayarlar'dan değiştirebilirsiniz</span></div></div>`;
  if (g === bugun) {
    const yr = db.randevular.filter(r => r.tarih === yarin && r.durum === 'bekliyor');
    if (yr.length) {
      const gonderilen = yr.filter(r => r.hatirlatma).length;
      bant += `<button class="bant" data-act="yarinHatirlat" style="width:calc(100% - 32px);text-align:left"><span class="ik">💬</span><div><b>Yarın ${yr.length} randevu var</b><span>${gonderilen ? `${gonderilen}/${yr.length} hatırlatma gönderildi` : 'WhatsApp ile hatırlatma gönderin'}</span></div><span class="ok2">›</span></button>`;
    }
  }

  // Zaman çizelgesi
  const ogeler = rlar.map(r => ({ t: dk(r.saat), tur: 'r', r }));
  if (tekBerber) {
    bosluklar(g, tekBerber).forEach(([a, b]) => ogeler.push({ t: a, tur: 'b', a, b, bid: tekBerber }));
    if (gs.acik && gs.araBas && gs.araBit && dk(gs.araBit) > dk(gs.araBas)) ogeler.push({ t: dk(gs.araBas), tur: 'ara' });
  }
  ogeler.sort((x, y) => x.t - y.t || (x.tur === 'r' ? -1 : 1));
  let siradakiId = null;
  if (g === bugun) {
    const s = simdiDk();
    siradakiId = bekleyen.filter(r => bitis(r) > s).sort(saatSirala)[0]?.id || null;
  }
  const liste = ogeler.map(o => {
    if (o.tur === 'r') return randevuKart(o.r, o.r.id === siradakiId);
    if (o.tur === 'ara') return `<div class="ara-sat">☕ Ara ${gs.araBas} – ${gs.araBit}</div>`;
    return `<button class="bosluk" data-act="yeniSaat" data-t="${o.a}" data-bid="${o.bid}"><span>${saat(o.a)} – ${saat(o.b)} boş <small>(${o.b - o.a} dk)</small></span><b>+ Ekle</b></button>`;
  }).join('');

  const bos = !ogeler.length ? `<div class="bos-durum"><div class="logo">${IK.makas}</div><p>${g < bugun ? 'Bu günde randevu yok.' : 'Bu gün için randevu yok.'}</p><button class="btn pirinc" data-act="yeniRandevu">Randevu ekle</button></div>` : '';

  return `
  <header class="ust"><div class="ust-satir">
    <div class="dukkan">${esc(db.ayar.dukkan)}<small>${g === bugun ? 'Bugün · ' : ''}${uzunTarih(g)}</small></div>
    ${g !== bugun ? '<button class="ust-btn vurgu" data-act="bugun">Bugün</button>' : ''}
  </div></header>
  <div class="ay-sec">
    <label class="ay-etiket">${AYLAR[d.getMonth()]} ${d.getFullYear()} ▾<input type="date" id="tarihSec" value="${g}"></label>
  </div>
  <div class="hafta" style="margin-top:0;padding-top:6px">
    <button class="ok" data-act="haftaKay" data-n="-7">‹</button>
    <div class="gunler">${gunHtml}</div>
    <button class="ok" data-act="haftaKay" data-n="7">›</button>
  </div>
  ${filtre}
  <div class="ozet-satir">
    <div class="ozet-k"><b>${aktif.length}</b><span>Randevu</span></div>
    <div class="ozet-k"><b>${tamam.length}</b><span>Tamamlanan</span></div>
    <div class="ozet-k"><b>${para(ciro)}</b><span>${bekleyen.length ? `Kasa · +${para(bekleyen.reduce((s, r) => s + (+r.tutar || 0), 0))} bekliyor` : 'Kasa'}</span></div>
  </div>
  ${bant}
  <div class="bolum-baslik"><span>${tekBerber && cokluBerber() ? esc(berber(tekBerber)?.ad) + ' · ' : ''}Günün akışı</span></div>
  <div class="liste">${liste}</div>${bos}`;
}
function randevuKart(r, siradaki) {
  const d = DURUM[r.durum];
  const alt = [hizmetAdlari(r) || `${r.dk} dk`];
  if (cokluBerber() && ui.berber === 'hepsi') alt.push(berberAdi(r));
  return `<button class="rkart ${r.durum === 'iptal' ? 'iptal' : ''} ${siradaki ? 'siradaki' : ''}" data-act="rDetay" data-id="${r.id}" style="--renk:${berberRenk(r)}">
    <div class="rk-saat"><b>${r.saat}</b><span>${saat(bitis(r))}</span></div>
    <div class="rk-orta">${siradaki ? '<div class="siradaki-et">▶ SIRADAKİ</div>' : ''}<div class="rk-ad">${esc(musteriAdi(r))}</div><div class="rk-alt">${esc(alt.join(' · '))}${r.not ? ' · 📝' : ''}</div></div>
    <div class="rk-sag"><div class="rk-tutar">${para(r.tutar)}</div><span class="rozet ${d.sinif}">${d.ad}</span></div>
  </button>`;
}

// ---------------- Randevu formu ----------------
function randevuFormu(mevcut, on = {}) {
  const duzen = !!mevcut;
  ui.gecmisSlot = false;
  const fs = duzen
    ? { mid: mevcut.mid, ad: musteriAdi(mevcut), tel: musteri(mevcut.mid)?.tel || '', hiz: mevcut.hizmetler.map(h => h.id).filter(id => hizmet(id)),
        bid: berber(mevcut.bid) ? mevcut.bid : db.berberler[0].id, tarih: mevcut.tarih, saat: mevcut.saat, dk: mevcut.dk, dkElle: false, not: mevcut.not || '' }
    : { mid: null, ad: '', tel: '', hiz: [], bid: on.bid || varsayilanBerber(), tarih: on.tarih || ui.gun, saat: on.saat || '', dk: 0, dkElle: false, not: '' };
  if (!duzen && on.mid && musteri(on.mid)) {
    const m = musteri(on.mid);
    Object.assign(fs, { mid: m.id, ad: m.ad, tel: m.tel || '' });
    const son = on.hiz || sonZiyaret(m.id)?.hizmetler.map(h => h.id);
    if (son) fs.hiz = son.filter(id => hizmet(id));
  }
  if (!duzen) fs.dk = hizmetSure(fs.hiz) || 30;
  if (!duzen && !fs.saat && fs.tarih === bugunStr()) {
    const ilk = slotlar(fs.tarih, fs.bid, fs.dk).find(s => s.durum === 'bos');
    if (ilk) fs.saat = saat(ilk.t);
  }

  const html = `
  <div class="sh-bas"><h3>${duzen ? 'Randevuyu düzenle' : 'Yeni randevu'}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <div class="alan"><span>Müşteri</span>
      <input id="fAd" placeholder="Ad Soyad" autocomplete="off" value="${esc(fs.ad)}">
      <div id="fOneri" class="oneri"></div>
    </div>
    <div id="fKayitli" class="kayitli"></div>
    <label class="alan"><span>Telefon</span><input id="fTel" type="tel" inputmode="tel" placeholder="05xx xxx xx xx" autocomplete="off" value="${esc(fs.tel)}"></label>
    <div class="alan"><span>Hizmet</span><div id="fHiz" class="cipler"></div></div>
    ${cokluBerber() ? '<div class="alan"><span>Berber</span><div id="fBerber" class="cipler"></div></div>' : ''}
    <div class="ikili">
      <label class="alan"><span>Tarih</span><input id="fTarih" type="date" value="${fs.tarih}"></label>
      <label class="alan dar"><span>Süre (dk)</span><input id="fDk" type="number" inputmode="numeric" min="5" step="5" value="${fs.dk}"></label>
    </div>
    <div class="alan"><span>Saat <em id="fSaatBilgi"></em></span><div id="fSlotlar" class="slotlar"></div>
      <div class="elle"><span>Saati elle yaz:</span><input id="fSaat" type="time" value="${fs.saat}"></div>
    </div>
    <label class="alan"><span>Not</span><textarea id="fNot" rows="2" placeholder="İsteğe bağlı">${esc(fs.not)}</textarea></label>
  </div>
  <div class="sh-alt"><div class="toplam" id="fToplam"></div><button class="btn ana" id="fKaydet">${duzen ? 'Güncelle' : 'Kaydet'}</button></div>`;

  sheetAc(html, sh => {
    const adEl = $('#fAd', sh), telEl = $('#fTel', sh), oneri = $('#fOneri', sh);
    const oneriCiz = () => {
      const q = trKucuk(adEl.value.trim()), qt = telTemiz(telEl.value);
      if (fs.mid || (!q && qt.length < 3) || (document.activeElement !== adEl && document.activeElement !== telEl)) { oneri.innerHTML = ''; return; }
      const bul = db.musteriler.filter(m => (q && trKucuk(m.ad).includes(q)) || (qt.length >= 3 && telTemiz(m.tel).includes(qt))).slice(0, 5);
      oneri.innerHTML = bul.map(m => `<button type="button" data-mid="${m.id}"><span class="avatar" style="width:32px;height:32px;font-size:12px">${esc(basHarf(m.ad))}</span><span>${esc(m.ad)}<small>${esc(telGoster(m.tel) || 'Telefon yok')}</small></span></button>`).join('');
    };
    const kayitliCiz = () => {
      const m = musteri(fs.mid), el = $('#fKayitli', sh);
      if (!m) { el.innerHTML = ''; return; }
      const son = sonZiyaret(m.id);
      const say = musteriRandevulari(m.id).filter(r => r.durum === 'tamam').length;
      el.innerHTML = `<div>✓ Kayıtlı müşteri · ${say} ziyaret${son ? ` · son: ${kisaTarih(son.tarih)}` : ''}</div><button type="button" id="fKaldir" aria-label="Kaldır">×</button>`;
      $('#fKaldir', sh).onclick = () => { fs.mid = null; kayitliCiz(); adEl.focus(); };
    };
    const hizCiz = () => {
      $('#fHiz', sh).innerHTML = db.hizmetler.map(h => `<button type="button" class="hcip ${fs.hiz.includes(h.id) ? 'secili' : ''}" data-h="${h.id}">${esc(h.ad)}<small>${h.dk} dk · ${para(h.fiyat)}</small></button>`).join('') ||
        '<div class="slot-not">Hizmet yok. Ayarlar\'dan ekleyebilirsiniz.</div>';
    };
    const berberCiz = () => {
      const el = $('#fBerber', sh);
      if (el) el.innerHTML = db.berberler.map(b => `<button type="button" class="cip ${fs.bid === b.id ? 'secili' : ''}" data-b="${b.id}" style="--renk:${b.renk}"><span class="nokta"></span>${esc(b.ad)}</button>`).join('');
    };
    const slotCiz = () => {
      const el = $('#fSlotlar', sh), bilgi = $('#fSaatBilgi', sh);
      const g = gunSaati(fs.tarih);
      $('#fSaat', sh).value = fs.saat;
      if (!g.acik) { el.innerHTML = `<div class="slot-not">${GUNLER[gunNo(fs.tarih)]} kapalı. Saati aşağıya elle yazabilirsiniz.</div>`; bilgi.textContent = ''; return; }
      let sl = slotlar(fs.tarih, fs.bid, +fs.dk || 30, mevcut?.id);
      const bugunMu = fs.tarih === bugunStr();
      const simdi = simdiDk();
      const gecmisSay = bugunMu ? sl.filter(s => s.t < simdi).length : 0;
      const gizle = bugunMu && !ui.gecmisSlot && gecmisSay;
      if (gizle) sl = sl.filter(s => s.t >= simdi || saat(s.t) === fs.saat);
      const bos = sl.filter(s => s.durum === 'bos').length;
      bilgi.textContent = `${bos} boş saat`;
      el.innerHTML = (gizle ? `<button type="button" class="slot" data-gecmis="1" style="grid-column:1/-1;font-size:13px;color:var(--soluk)">Geçmiş saatleri göster (${gecmisSay})</button>` : '') +
        sl.map(s => {
          const kapali = s.durum === 'dolu' || s.durum === 'ara' || s.durum === 'tasma';
          return `<button type="button" class="slot ${s.durum} ${saat(s.t) === fs.saat ? 'secili' : ''}" data-t="${s.t}" ${kapali && saat(s.t) !== fs.saat ? 'disabled' : ''}>${saat(s.t)}</button>`;
        }).join('') || '<div class="slot-not">Uygun saat yok.</div>';
    };
    const toplamCiz = () => {
      const tutar = fs.hiz.length ? hizmetTutar(fs.hiz) : (duzen ? mevcut.tutar : 0);
      const bitisSaat = fs.saat ? ` · ${fs.saat}–${saat(dk(fs.saat) + (+fs.dk || 0))}` : '';
      $('#fToplam', sh).innerHTML = `<b>${para(tutar)}</b>${+fs.dk || 0} dk${bitisSaat}`;
    };
    const hepsi = () => { kayitliCiz(); hizCiz(); berberCiz(); slotCiz(); toplamCiz(); };
    hepsi();

    adEl.addEventListener('input', () => { if (fs.mid) { fs.mid = null; kayitliCiz(); } oneriCiz(); });
    telEl.addEventListener('input', () => { if (fs.mid) { fs.mid = null; kayitliCiz(); } oneriCiz(); });
    adEl.addEventListener('focus', oneriCiz);
    telEl.addEventListener('focus', oneriCiz);
    adEl.addEventListener('blur', () => setTimeout(oneriCiz, 150));
    telEl.addEventListener('blur', () => setTimeout(oneriCiz, 150));
    oneri.addEventListener('pointerdown', e => e.preventDefault());
    oneri.addEventListener('click', e => {
      const b = e.target.closest('[data-mid]');
      if (!b) return;
      const m = musteri(b.dataset.mid);
      fs.mid = m.id; adEl.value = m.ad; telEl.value = m.tel || '';
      if (!fs.hiz.length) {
        const son = sonZiyaret(m.id);
        if (son) { fs.hiz = son.hizmetler.map(h => h.id).filter(id => hizmet(id)); if (!fs.dkElle) fs.dk = hizmetSure(fs.hiz) || 30; $('#fDk', sh).value = fs.dk; }
      }
      oneri.innerHTML = '';
      adEl.blur(); telEl.blur();
      hepsi();
    });
    $('#fHiz', sh).addEventListener('click', e => {
      const b = e.target.closest('[data-h]');
      if (!b) return;
      const id = b.dataset.h;
      fs.hiz = fs.hiz.includes(id) ? fs.hiz.filter(x => x !== id) : [...fs.hiz, id];
      if (!fs.dkElle) { fs.dk = hizmetSure(fs.hiz) || 30; $('#fDk', sh).value = fs.dk; }
      hizCiz(); slotCiz(); toplamCiz();
    });
    const be = $('#fBerber', sh);
    if (be) be.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; fs.bid = b.dataset.b; berberCiz(); slotCiz(); });
    $('#fTarih', sh).addEventListener('change', e => { if (!e.target.value) return; fs.tarih = e.target.value; slotCiz(); toplamCiz(); });
    $('#fDk', sh).addEventListener('input', e => { fs.dk = Math.max(0, parseInt(e.target.value, 10) || 0); fs.dkElle = true; slotCiz(); toplamCiz(); });
    $('#fSaat', sh).addEventListener('change', e => { fs.saat = e.target.value; slotCiz(); toplamCiz(); });
    $('#fSlotlar', sh).addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.gecmis) { ui.gecmisSlot = true; slotCiz(); return; }
      fs.saat = saat(+b.dataset.t); slotCiz(); toplamCiz();
    });
    $('#fKaydet', sh).addEventListener('click', async () => {
      fs.ad = adEl.value.trim(); fs.tel = telEl.value.trim(); fs.not = $('#fNot', sh).value.trim();
      fs.saat = $('#fSaat', sh).value || fs.saat;
      if (!fs.ad) { tost('Müşteri adını yazın'); adEl.focus(); return; }
      if (!fs.saat) { tost('Saat seçin'); return; }
      if (!fs.dk || fs.dk < 5) { tost('Süreyi yazın (en az 5 dk)'); return; }
      const c = cakismalar(fs.tarih, fs.bid, dk(fs.saat), +fs.dk, mevcut?.id)[0];
      if (c && !await onayla(`${cokluBerber() ? berber(fs.bid)?.ad + ' için ' : ''}${c.saat} saatinde ${musteriAdi(c)} randevusu var.\nYine de kaydedilsin mi?`, 'Kaydet')) return;
      // Müşteri bul ya da oluştur
      let m = musteri(fs.mid);
      if (!m) {
        const t = telTemiz(fs.tel);
        m = (t.length >= 7 && db.musteriler.find(x => telTemiz(x.tel) === t)) ||
            db.musteriler.find(x => trKucuk(x.ad.trim()) === trKucuk(fs.ad) && (!t || !telTemiz(x.tel)));
        if (!m) { m = { id: yeniId(), ad: fs.ad, tel: fs.tel, not: '', olusturma: Date.now() }; db.musteriler.push(m); }
        else if (fs.tel && !m.tel) m.tel = fs.tel;
      } else if (fs.tel !== (m.tel || '')) m.tel = fs.tel;
      const hizmetler = fs.hiz.map(hizmet).filter(Boolean).map(h => ({ id: h.id, ad: h.ad, dk: +h.dk, fiyat: +h.fiyat }));
      const tutar = hizmetler.reduce((s, h) => s + h.fiyat, 0);
      const b = berber(fs.bid);
      if (duzen) {
        const hizDegisti = mevcut.hizmetler.map(h => h.id).join() !== hizmetler.map(h => h.id).join();
        if (mevcut.tarih !== fs.tarih || mevcut.saat !== fs.saat) mevcut.hatirlatma = null;
        Object.assign(mevcut, { mid: m.id, mad: m.ad, bid: fs.bid, bad: b?.ad || '', tarih: fs.tarih, saat: fs.saat, dk: +fs.dk, not: fs.not, guncelleme: Date.now() });
        if (hizDegisti) { mevcut.hizmetler = hizmetler; if (mevcut.durum !== 'tamam') mevcut.tutar = tutar; }
      } else {
        db.randevular.push({ id: yeniId(), mid: m.id, mad: m.ad, bid: fs.bid, bad: b?.ad || '', tarih: fs.tarih, saat: fs.saat, dk: +fs.dk,
          hizmetler, tutar, durum: 'bekliyor', odeme: '', not: fs.not, olusturma: Date.now() });
      }
      kaydetVeri();
      sheetKapat();
      if (ui.sekme === 'takvim') ui.gun = fs.tarih;
      tumunuYenile();
      tost(duzen ? 'Randevu güncellendi' : `Randevu kaydedildi · ${kisaTarih(fs.tarih)} ${fs.saat}`);
    });
  });
}

// ---------------- Randevu detayı ----------------
function detayHtml(r) {
  const m = musteri(r.mid), d = DURUM[r.durum], tel = m?.tel || '';
  const ad = musteriAdi(r);
  const eylem = r.durum === 'bekliyor'
    ? `<button class="btn yesil" data-act="tamamla" data-id="${r.id}">✓ Geldi · Ödeme al</button><button class="btn cizgili" data-act="gelmedi" data-id="${r.id}">✗ Gelmedi</button>`
    : `<button class="btn cizgili" data-act="geriAl" data-id="${r.id}">↺ Bekliyor'a al</button>${r.durum === 'tamam' ? `<button class="btn cizgili" data-act="tamamla" data-id="${r.id}">Ödemeyi düzenle</button>` : ''}`;
  return `
  <div class="sh-bas"><h3>${r.saat} – ${saat(bitis(r))}</h3><span class="rozet ${d.sinif}">${d.ad}</span><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <div class="det-ust">
      <div class="det-kisi"><div class="avatar">${esc(basHarf(ad))}</div><div><div class="ad">${esc(ad)}</div><div class="tel">${tel ? esc(telGoster(tel)) : 'Telefon kayıtlı değil'}</div></div></div>
      <div class="hizli">
        <button data-act="ara" data-tel="${esc(tel)}" ${tel ? '' : 'disabled'}>${IK.tel}Ara</button>
        <button data-act="waHatirlat" data-id="${r.id}" ${tel && r.durum === 'bekliyor' ? '' : 'disabled'}>${IK.wa}${r.hatirlatma ? 'Tekrar hatırlat' : 'Hatırlat'}</button>
        <button data-act="mDetay" data-id="${r.mid}" ${m ? '' : 'disabled'}>${IK.kisi}Müşteri kartı</button>
      </div>
    </div>
    <div class="bilgi">
      <div><span>Tarih</span><b>${uzunTarih(r.tarih)}</b></div>
      <div><span>Saat</span><b>${r.saat} – ${saat(bitis(r))} · ${r.dk} dk</b></div>
      <div><span>Hizmet</span><b>${esc(hizmetAdlari(r) || '—')}</b></div>
      ${cokluBerber() ? `<div><span>Berber</span><b>${esc(berberAdi(r))}</b></div>` : ''}
      <div><span>Tutar</span><b>${para(r.tutar)}${r.durum === 'tamam' && r.odeme ? ' · ' + ODEME[r.odeme] : ''}</b></div>
      ${r.not ? `<div><span>Not</span><b>${esc(r.not)}</b></div>` : ''}
      ${r.hatirlatma ? `<div><span>Hatırlatma</span><b>WhatsApp ile gönderildi ✓</b></div>` : ''}
    </div>
    <div class="eylemler">${eylem}</div>
    <div class="kucuk-eylem">
      <button data-act="rDuzenle" data-id="${r.id}">Düzenle / Ertele</button>
      <button data-act="rTekrar" data-id="${r.id}">Yeni randevu ver</button>
      ${r.durum !== 'iptal' && r.durum !== 'tamam' ? `<button class="kirmizi" data-act="rIptal" data-id="${r.id}">İptal et</button>` : ''}
      <button class="kirmizi" data-act="rSil" data-id="${r.id}">Sil</button>
    </div>
  </div>`;
}
function randevuDetay(id) {
  const r = randevu(id);
  if (!r) return;
  sheetAc(detayHtml(r), (sh, o) => {
    o.yenile = () => { const g = randevu(id); if (g) sh.innerHTML = detayHtml(g); else sheetKapat(o); };
  });
}
function tamamlaFormu(r) {
  let odeme = r.odeme || 'nakit';
  sheetAc(`
  <div class="sh-bas"><h3>Ödeme al</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <div class="bilgi"><div><span>${esc(musteriAdi(r))}</span><b>${esc(hizmetAdlari(r) || r.dk + ' dk')}</b></div></div>
    <label class="alan"><span>Alınan tutar (₺)</span><input id="tTutar" type="number" inputmode="numeric" min="0" value="${+r.tutar || 0}"></label>
    <div class="alan"><span>Ödeme şekli</span><div class="secim" id="tOdeme">${Object.entries(ODEME).map(([k, v]) => `<button type="button" data-o="${k}" class="${k === odeme ? 'secili' : ''}">${v}</button>`).join('')}</div></div>
  </div>
  <div class="sh-alt"><button class="btn yesil tam" id="tKaydet">Tamamlandı olarak kaydet</button></div>`, sh => {
    $('#tOdeme', sh).addEventListener('click', e => {
      const b = e.target.closest('[data-o]');
      if (!b) return;
      odeme = b.dataset.o;
      $$('#tOdeme button', sh).forEach(x => x.classList.toggle('secili', x === b));
    });
    $('#tKaydet', sh).addEventListener('click', () => {
      r.tutar = Math.max(0, +$('#tTutar', sh).value || 0);
      r.odeme = odeme;
      r.durum = 'tamam';
      r.tamamZaman = Date.now();
      kaydetVeri();
      sheetKapat();
      tumunuYenile();
      tost(`${musteriAdi(r)} · ${para(r.tutar)} kasaya eklendi`);
    });
  });
}
function waMesaj(r) {
  const bugun = bugunStr();
  const gun = r.tarih === bugun ? 'bugün' : r.tarih === gunEkle(bugun, 1) ? 'yarın' : GUNLER[gunNo(r.tarih)];
  const degerler = { ad: musteriAdi(r), gun, tarih: kisaTarih(r.tarih), saat: r.saat, hizmet: hizmetAdlari(r), berber: berberAdi(r), dukkan: db.ayar.dukkan };
  return String(db.ayar.waSablon || VARSAYILAN_SABLON).replace(/\{(\w+)\}/g, (t, k) => (k in degerler ? degerler[k] : t));
}
function disAc(url) {
  if (android()) { try { AndroidBridge.openUrl(url); return; } catch (e) { /* tarayıcıya düş */ } }
  window.open(url, '_blank');
}
function waHatirlat(r) {
  const tel = musteri(r.mid)?.tel;
  if (!tel) { tost('Müşterinin telefonu kayıtlı değil'); return; }
  disAc(`https://wa.me/${waNo(tel)}?text=${encodeURIComponent(waMesaj(r))}`);
  r.hatirlatma = Date.now();
  kaydetVeri();
  setTimeout(tumunuYenile, 300);
}
function yarinHatirlatma() {
  const yarin = gunEkle(bugunStr(), 1);
  const icerik = () => {
    const yr = db.randevular.filter(r => r.tarih === yarin && r.durum === 'bekliyor').sort(saatSirala);
    return `
    <div class="sh-bas"><h3>Yarınki randevular</h3><button class="x" data-act="kapat">×</button></div>
    <div class="sh-icerik">
      <div class="ipucu" style="margin:0 0 12px">${uzunTarih(yarin)} · Her satırdaki düğme WhatsApp'ı hazır mesajla açar.</div>
      <div class="bilgi" style="background:var(--kart)">${yr.map(r => {
        const tel = musteri(r.mid)?.tel;
        return `<div style="align-items:center"><span style="color:var(--metin)"><b style="font-weight:600">${r.saat}</b> · ${esc(musteriAdi(r))}<br><small style="color:var(--soluk)">${esc(hizmetAdlari(r) || '')}</small></span>
        ${tel ? `<button class="btn kucuk ${r.hatirlatma ? 'cizgili' : 'yesil'}" data-act="waHatirlat" data-id="${r.id}">${r.hatirlatma ? 'Gönderildi ✓' : 'Gönder'}</button>` : '<small style="color:var(--soluk)">Telefon yok</small>'}</div>`;
      }).join('') || '<div>Yarın bekleyen randevu yok.</div>'}</div>
    </div>`;
  };
  sheetAc(icerik(), (sh, o) => { o.yenile = () => { sh.innerHTML = icerik(); }; });
}

// ---------------- Müşteriler ----------------
function musterilerHtml() {
  return `
  <header class="ust"><div class="ust-satir"><div class="dukkan">Müşteriler<small>${db.musteriler.length} kayıtlı müşteri</small></div>
    <button class="ust-btn vurgu" data-act="mYeni">+ Müşteri</button></div></header>
  <div class="arama" style="margin-top:16px">${IK.ara}<input id="mAra" type="search" placeholder="İsim ya da telefon ara" value="${esc(ui.mAra)}" autocomplete="off"></div>
  <div id="mListe"></div>`;
}
function musteriIstatlari() {
  const harita = new Map();
  for (const r of db.randevular) {
    let s = harita.get(r.mid);
    if (!s) { s = { ziyaret: 0, harcama: 0, gelmedi: 0, son: '', gelecek: '' }; harita.set(r.mid, s); }
    if (r.durum === 'tamam') { s.ziyaret++; s.harcama += +r.tutar || 0; if (r.tarih > s.son) s.son = r.tarih; }
    if (r.durum === 'gelmedi') s.gelmedi++;
    if (r.durum === 'bekliyor' && r.tarih >= bugunStr() && (!s.gelecek || r.tarih + r.saat < s.gelecek)) s.gelecek = r.tarih + r.saat;
  }
  return harita;
}
function musteriListeCiz() {
  const el = $('#mListe');
  if (!el) return;
  const q = trKucuk(ui.mAra.trim()), qt = telTemiz(ui.mAra);
  const ist = musteriIstatlari();
  const bos = { ziyaret: 0, harcama: 0, gelmedi: 0, son: '', gelecek: '' };
  const liste = db.musteriler
    .filter(m => !q || trKucuk(m.ad).includes(q) || (qt.length >= 3 && telTemiz(m.tel).includes(qt)))
    .map(m => ({ m, s: ist.get(m.id) || bos }))
    .sort((a, b) => (b.s.gelecek ? 1 : 0) - (a.s.gelecek ? 1 : 0) || b.s.son.localeCompare(a.s.son) || a.m.ad.localeCompare(b.m.ad, 'tr'));
  if (!db.musteriler.length) {
    el.innerHTML = `<div class="bos-durum"><div class="ik">👤</div><p>Henüz müşteri yok.<br>Randevu eklediğinizde müşteriler buraya kendiliğinden kaydedilir.</p></div>`;
    return;
  }
  if (!liste.length) { el.innerHTML = `<div class="bos-durum"><p>“${esc(ui.mAra)}” bulunamadı.</p></div>`; return; }
  el.innerHTML = `<div class="kart">${liste.slice(0, 300).map(({ m, s }) => {
    const alt = [];
    if (s.gelecek) alt.push(`📅 ${kisaTarih(s.gelecek.slice(0, 10))} ${s.gelecek.slice(10)}`);
    alt.push(s.ziyaret ? `${s.ziyaret} ziyaret` : 'Henüz gelmedi');
    if (s.son) alt.push(`son: ${kisaTarih(s.son)}`);
    return `<button class="satir" data-act="mDetay" data-id="${m.id}"><span class="avatar">${esc(basHarf(m.ad))}</span>
      <span class="s-orta"><div class="s-bas">${esc(m.ad)}</div><div class="s-alt">${esc(alt.join(' · '))}</div></span>
      <span class="s-sag">${s.harcama ? para(s.harcama) : ''}</span></button>`;
  }).join('')}</div>${liste.length > 300 ? `<div class="surum">İlk 300 kişi gösteriliyor, aramayla daraltın.</div>` : ''}`;
}
function musteriDetayHtml(m) {
  const rl = musteriRandevulari(m.id).sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat));
  const tamam = rl.filter(r => r.durum === 'tamam');
  const harcama = tamam.reduce((s, r) => s + (+r.tutar || 0), 0);
  const gelmedi = rl.filter(r => r.durum === 'gelmedi').length;
  const bugun = bugunStr();
  const gelecek = rl.filter(r => r.durum === 'bekliyor' && r.tarih >= bugun).reverse();
  const gecmis = rl.filter(r => !gelecek.includes(r));
  const sat = r => `<button class="gecmis-sat" data-act="rDetay" data-id="${r.id}"><span class="gt"><b>${kisaTarih(r.tarih)}</b>${r.saat}</span>
    <span class="go">${esc(hizmetAdlari(r) || r.dk + ' dk')}</span><span class="rozet ${DURUM[r.durum].sinif}">${DURUM[r.durum].ad}</span></button>`;
  return `
  <div class="sh-bas"><h3>Müşteri kartı</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <div class="det-ust">
      <div class="det-kisi"><div class="avatar">${esc(basHarf(m.ad))}</div><div><div class="ad">${esc(m.ad)}</div><div class="tel">${m.tel ? esc(telGoster(m.tel)) : 'Telefon kayıtlı değil'}</div></div></div>
      ${m.not ? `<div class="ipucu" style="margin:10px 0 0">📝 ${esc(m.not)}</div>` : ''}
      <div class="hizli">
        <button data-act="ara" data-tel="${esc(m.tel || '')}" ${m.tel ? '' : 'disabled'}>${IK.tel}Ara</button>
        <button data-act="waAc" data-tel="${esc(m.tel || '')}" ${m.tel ? '' : 'disabled'}>${IK.wa}WhatsApp</button>
        <button data-act="mRandevu" data-id="${m.id}">${IK.takvim}Randevu ver</button>
      </div>
    </div>
    <div class="istat">
      <div><b>${tamam.length}</b><span>Ziyaret</span></div>
      <div><b>${para(harcama)}</b><span>Toplam</span></div>
      <div><b style="${gelmedi ? 'color:var(--kirmizi)' : ''}">${gelmedi}</b><span>Gelmedi</span></div>
    </div>
    ${gelecek.length ? `<div class="etiket">Yaklaşan</div><div class="bilgi" style="overflow:hidden">${gelecek.map(sat).join('')}</div>` : ''}
    <div class="etiket">Geçmiş</div>
    <div class="bilgi" style="overflow:hidden">${gecmis.map(sat).join('') || '<div><span>Kayıt yok</span></div>'}</div>
    <div class="kucuk-eylem"><button data-act="mDuzenle" data-id="${m.id}">Bilgileri düzenle</button><button class="kirmizi" data-act="mSil" data-id="${m.id}">Müşteriyi sil</button></div>
  </div>`;
}
function musteriDetay(id) {
  const m = musteri(id);
  if (!m) return;
  sheetAc(musteriDetayHtml(m), (sh, o) => {
    o.yenile = () => { const g = musteri(id); if (g) sh.innerHTML = musteriDetayHtml(g); else sheetKapat(o); };
  });
}
function musteriFormu(m) {
  sheetAc(`
  <div class="sh-bas"><h3>${m ? 'Müşteriyi düzenle' : 'Yeni müşteri'}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <label class="alan"><span>Ad Soyad</span><input id="mAd" value="${esc(m?.ad || '')}" autocomplete="off"></label>
    <label class="alan"><span>Telefon</span><input id="mTel" type="tel" inputmode="tel" placeholder="05xx xxx xx xx" value="${esc(m?.tel || '')}"></label>
    <label class="alan"><span>Not</span><textarea id="mNot" rows="3" placeholder="Ör. kısa kesim sever, 3 numara">${esc(m?.not || '')}</textarea></label>
  </div>
  <div class="sh-alt"><button class="btn ana tam" id="mKaydet">Kaydet</button></div>`, sh => {
    if (!m) setTimeout(() => $('#mAd', sh).focus(), 250);
    $('#mKaydet', sh).addEventListener('click', () => {
      const ad = $('#mAd', sh).value.trim(), tel = $('#mTel', sh).value.trim(), not = $('#mNot', sh).value.trim();
      if (!ad) { tost('Ad yazın'); return; }
      const t = telTemiz(tel);
      const ayni = t.length >= 7 && db.musteriler.find(x => x !== m && telTemiz(x.tel) === t);
      if (ayni) { tost(`Bu telefon ${ayni.ad} adına kayıtlı`); return; }
      if (m) {
        Object.assign(m, { ad, tel, not });
        db.randevular.forEach(r => { if (r.mid === m.id) r.mad = ad; });
      } else db.musteriler.push({ id: yeniId(), ad, tel, not, olusturma: Date.now() });
      kaydetVeri();
      sheetKapat();
      tumunuYenile();
      tost('Müşteri kaydedildi');
    });
  });
}

// ---------------- Kasa ----------------
function donemAraligi() {
  const ref = ui.raporRef, d = tarihObj(ref);
  if (ui.rapor === 'gun') return { bas: ref, bit: ref, etiket: uzunTarih(ref) };
  if (ui.rapor === 'hafta') {
    const bas = gunEkle(ref, -gunNo(ref)), bit = gunEkle(bas, 6);
    return { bas, bit, etiket: `${kisaTarih(bas)} – ${kisaTarih(bit)}` };
  }
  if (ui.rapor === 'ay') {
    const bas = tarihStr(new Date(d.getFullYear(), d.getMonth(), 1)), bit = tarihStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { bas, bit, etiket: `${AYLAR[d.getMonth()]} ${d.getFullYear()}` };
  }
  return { bas: `${d.getFullYear()}-01-01`, bit: `${d.getFullYear()}-12-31`, etiket: `${d.getFullYear()}` };
}
function donemKaydir(n) {
  const d = tarihObj(ui.raporRef);
  if (ui.rapor === 'gun') d.setDate(d.getDate() + n);
  else if (ui.rapor === 'hafta') d.setDate(d.getDate() + 7 * n);
  else if (ui.rapor === 'ay') { d.setDate(1); d.setMonth(d.getMonth() + n); }
  else d.setFullYear(d.getFullYear() + n);
  ui.raporRef = tarihStr(d);
}
function donemVerisi() {
  const a = donemAraligi();
  const rl = db.randevular.filter(r => r.tarih >= a.bas && r.tarih <= a.bit);
  const tamam = rl.filter(r => r.durum === 'tamam');
  const ciro = tamam.reduce((s, r) => s + (+r.tutar || 0), 0);
  const gelmedi = rl.filter(r => r.durum === 'gelmedi').length;
  const iptal = rl.filter(r => r.durum === 'iptal').length;
  const bekleyen = rl.filter(r => r.durum === 'bekliyor');
  const odeme = { nakit: 0, kart: 0, havale: 0 };
  tamam.forEach(r => { odeme[r.odeme in odeme ? r.odeme : 'nakit'] += +r.tutar || 0; });
  const hizmetler = new Map();
  tamam.forEach(r => {
    const h = r.hizmetler.length ? r.hizmetler : [{ ad: 'Diğer', fiyat: r.tutar }];
    const liste = h.reduce((s, x) => s + (+x.fiyat || 0), 0);
    h.forEach(x => {
      const pay = liste ? (+x.fiyat || 0) / liste * (+r.tutar || 0) : (+r.tutar || 0) / h.length;
      const o = hizmetler.get(x.ad) || { ad: x.ad, adet: 0, ciro: 0 };
      o.adet++; o.ciro += pay;
      hizmetler.set(x.ad, o);
    });
  });
  const berberler = new Map();
  tamam.forEach(r => {
    const k = r.bid;
    const o = berberler.get(k) || { ad: berberAdi(r), renk: berberRenk(r), adet: 0, ciro: 0 };
    o.adet++; o.ciro += +r.tutar || 0;
    berberler.set(k, o);
  });
  const musteriler = new Map();
  tamam.forEach(r => {
    const o = musteriler.get(r.mid) || { ad: musteriAdi(r), adet: 0, ciro: 0 };
    o.adet++; o.ciro += +r.tutar || 0;
    musteriler.set(r.mid, o);
  });
  return { a, rl, tamam, ciro, gelmedi, iptal, bekleyen, odeme,
    hizmetler: [...hizmetler.values()].sort((x, y) => y.ciro - x.ciro),
    berberler: [...berberler.values()].sort((x, y) => y.ciro - x.ciro),
    musteriler: [...musteriler.values()].sort((x, y) => y.adet - x.adet || y.ciro - x.ciro) };
}
function grafikHtml(v) {
  let kovalar = [];
  const bugun = bugunStr();
  if (ui.rapor === 'hafta' || ui.rapor === 'ay') {
    for (let t = v.a.bas; t <= v.a.bit; t = gunEkle(t, 1)) kovalar.push({ k: t, et: ui.rapor === 'hafta' ? GUN_KISA[gunNo(t)] : String(tarihObj(t).getDate()), deger: 0, bugun: t === bugun });
    v.tamam.forEach(r => { const o = kovalar.find(x => x.k === r.tarih); if (o) o.deger += +r.tutar || 0; });
  } else if (ui.rapor === 'yil') {
    const y = v.a.bas.slice(0, 4);
    kovalar = AY_KISA.map((et, i) => ({ k: `${y}-${iki(i + 1)}`, et, deger: 0, bugun: bugun.slice(0, 7) === `${y}-${iki(i + 1)}` }));
    v.tamam.forEach(r => { const o = kovalar.find(x => x.k === r.tarih.slice(0, 7)); if (o) o.deger += +r.tutar || 0; });
  } else return '';
  const enCok = Math.max(1, ...kovalar.map(k => k.deger));
  const etiketGoster = (i) => ui.rapor !== 'ay' || i === 0 || (i + 1) % 5 === 0;
  const kisa = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + 'b' : String(Math.round(n));
  return `<div class="kart"><div class="grafik">${kovalar.map(k => `<div class="cubuk ${k.deger ? '' : 'bos'} ${k.bugun ? 'bugun' : ''}"><i style="height:${Math.max(2, k.deger / enCok * 100)}%"></i>${k.deger && ui.rapor !== 'ay' ? `<em>${kisa(k.deger)}</em>` : ''}</div>`).join('')}</div>
    <div class="grafik-et">${kovalar.map((k, i) => `<span>${etiketGoster(i) ? k.et : ''}</span>`).join('')}</div></div>`;
}
function kasaHtml() {
  const v = donemVerisi();
  const sonuclanan = v.tamam.length + v.gelmedi;
  const oran = sonuclanan ? Math.round(v.gelmedi / sonuclanan * 100) : 0;
  const ort = v.tamam.length ? v.ciro / v.tamam.length : 0;
  const bekTutar = v.bekleyen.reduce((s, r) => s + (+r.tutar || 0), 0);
  const barlar = (liste, max) => liste.map(o => `<div class="bar-satir"><div class="bar-ust"><b style="font-weight:500">${esc(o.ad)}</b><span>${o.adet} adet · ${para(o.ciro)}</span></div><div class="bar" style="--renk:${o.renk || 'var(--pirinc)'}"><i style="width:${max ? o.ciro / max * 100 : 0}%"></i></div></div>`).join('');
  const hMax = Math.max(0, ...v.hizmetler.map(h => h.ciro)), bMax = Math.max(0, ...v.berberler.map(h => h.ciro));
  const odemeToplam = v.ciro || 1;
  return `
  <header class="ust"><div class="ust-satir"><div class="dukkan">Kasa<small>Tamamlanan randevulardan</small></div>
    <button class="ust-btn vurgu" data-act="kasaExcel">Excel'e aktar</button></div></header>
  <div class="donem" style="margin-top:16px">${[['gun', 'Gün'], ['hafta', 'Hafta'], ['ay', 'Ay'], ['yil', 'Yıl']].map(([k, et]) => `<button data-act="raporTur" data-k="${k}" class="${ui.rapor === k ? 'secili' : ''}">${et}</button>`).join('')}</div>
  <div class="donem-nav"><button class="ok" data-act="donemKay" data-n="-1">‹</button><b>${v.a.etiket}</b><button class="ok" data-act="donemKay" data-n="1">›</button></div>
  <div class="kpi">
    <div class="buyuk"><b>${para(v.ciro)}</b><span>Ciro · ${v.tamam.length} tamamlanan randevu${bekTutar ? ` · ${para(bekTutar)} bekleyen` : ''}</span></div>
    <div><b>${para(ort)}</b><span>Ortalama / müşteri</span></div>
    <div><b>${v.rl.filter(r => r.durum !== 'iptal').length}</b><span>Toplam randevu</span></div>
    <div><b style="${v.gelmedi ? 'color:var(--kirmizi)' : ''}">${v.gelmedi}</b><span>Gelmedi${sonuclanan ? ` · %${oran}` : ''}</span></div>
    <div><b>${v.iptal}</b><span>İptal</span></div>
  </div>
  ${grafikHtml(v)}
  ${v.ciro ? `<div class="bolum-baslik"><span>Ödeme şekli</span></div><div class="kart">${Object.entries(ODEME).filter(([k]) => v.odeme[k]).map(([k, et]) => `<div class="bar-satir"><div class="bar-ust"><b style="font-weight:500">${et}</b><span>${para(v.odeme[k])} · %${Math.round(v.odeme[k] / odemeToplam * 100)}</span></div><div class="bar"><i style="width:${v.odeme[k] / odemeToplam * 100}%"></i></div></div>`).join('')}</div>` : ''}
  ${v.hizmetler.length ? `<div class="bolum-baslik"><span>Hizmetler</span></div><div class="kart">${barlar(v.hizmetler, hMax)}</div>` : ''}
  ${cokluBerber() && v.berberler.length ? `<div class="bolum-baslik"><span>Berberler</span></div><div class="kart">${barlar(v.berberler, bMax)}</div>` : ''}
  ${v.musteriler.length ? `<div class="bolum-baslik"><span>En çok gelenler</span></div><div class="kart">${v.musteriler.slice(0, 5).map((o, i) => `<div class="satir"><span class="avatar" style="width:32px;height:32px;font-size:13px">${i + 1}</span><span class="s-orta"><div class="s-bas">${esc(o.ad)}</div></span><span class="s-sag">${o.adet} kez · ${para(o.ciro)}</span></div>`).join('')}</div>` : ''}
  ${!v.rl.length ? '<div class="bos-durum"><p>Bu dönemde randevu yok.</p></div>' : ''}`;
}

// ---------------- Ayarlar ----------------
function saatOzet(g) {
  if (!g.acik) return 'Kapalı';
  return `${g.bas}–${g.bit}${g.araBas && g.araBit ? ` · ara ${g.araBas}–${g.araBit}` : ''}`;
}
function ayarHtml() {
  const a = db.ayar;
  let surum = '';
  try { if (android()) surum = AndroidBridge.version(); } catch (e) { surum = ''; }
  return `
  <header class="ust"><div class="ust-satir"><div class="dukkan">Ayarlar<small>${esc(a.dukkan)}</small></div></div></header>
  <div class="bolum-baslik" style="padding-top:18px"><span>Dükkan</span></div>
  <div class="kart"><button class="satir" data-act="dukkanAdi"><span class="s-orta"><div class="s-bas">${esc(a.dukkan)}</div><div class="s-alt">Dükkan adı · mesajlarda görünür</div></span><span class="ok3">›</span></button></div>

  <div class="bolum-baslik"><span>Berberler</span></div>
  <div class="kart">${db.berberler.map(b => `<button class="satir" data-act="berberDuzenle" data-id="${b.id}"><span class="renk-nokta" style="background:${b.renk}"></span><span class="s-orta"><div class="s-bas">${esc(b.ad)}</div></span><span class="ok3">›</span></button>`).join('')}
    <button class="satir ekle" data-act="berberDuzenle">+ Berber ekle</button></div>

  <div class="bolum-baslik"><span>Hizmetler ve fiyatlar</span></div>
  <div class="kart">${db.hizmetler.map(h => `<button class="satir" data-act="hizmetDuzenle" data-id="${h.id}"><span class="s-orta"><div class="s-bas">${esc(h.ad)}</div><div class="s-alt">${h.dk} dk</div></span><span class="s-sag">${para(h.fiyat)}</span><span class="ok3">›</span></button>`).join('')}
    <button class="satir ekle" data-act="hizmetDuzenle">+ Hizmet ekle</button></div>

  <div class="bolum-baslik"><span>Çalışma saatleri</span></div>
  <div class="kart">${a.saatler.map((g, i) => `<button class="satir" data-act="saatDuzenle" data-i="${i}"><span class="s-orta"><div class="s-bas">${GUNLER[i]}</div></span><span class="s-sag" style="${g.acik ? '' : 'color:var(--kirmizi)'}">${saatOzet(g)}</span><span class="ok3">›</span></button>`).join('')}</div>

  <div class="bolum-baslik"><span>Randevu aralığı</span></div>
  <div class="kart" style="padding:12px"><div class="secim">${[10, 15, 20, 30].map(n => `<button data-act="aralik" data-n="${n}" class="${+a.aralik === n ? 'secili' : ''}">${n} dk</button>`).join('')}</div>
    <div class="ipucu" style="margin:8px 0 0">Saat seçerken düğmeler bu aralıkla dizilir.</div></div>

  <div class="bolum-baslik"><span>Randevu bildirimi</span></div>
  <div class="kart" style="padding:12px"><div class="secim">${[[0, 'Kapalı'], [5, '5 dk'], [15, '15 dk'], [30, '30 dk'], [60, '1 saat']].map(([n, et]) => `<button data-act="hatirlatDk" data-n="${n}" class="${+a.hatirlatDk === n ? 'secili' : ''}">${et}</button>`).join('')}</div>
    <div class="ipucu" style="margin:8px 0 0">Randevudan bu kadar önce telefona bildirim gelir.</div></div>

  <div class="bolum-baslik"><span>WhatsApp hatırlatma mesajı</span></div>
  <div class="kart"><button class="satir" data-act="sablonDuzenle"><span class="s-orta"><div class="s-alt" style="white-space:normal;color:var(--metin)">${esc(a.waSablon)}</div></span><span class="ok3">›</span></button></div>

  <div class="bolum-baslik"><span>Veriler</span></div>
  <div class="kart">
    <button class="satir" data-act="tumExcel"><span class="s-orta"><div class="s-bas">Excel'e aktar</div><div class="s-alt">Tüm randevular ve müşteriler</div></span><span class="ok3">›</span></button>
    <button class="satir" data-act="yedekAl"><span class="s-orta"><div class="s-bas">Yedek al</div><div class="s-alt">${db.randevular.length} randevu, ${db.musteriler.length} müşteri · telefon değişince geri yüklenir</div></span><span class="ok3">›</span></button>
    <button class="satir" data-act="yedekYukle"><span class="s-orta"><div class="s-bas">Yedekten geri yükle</div><div class="s-alt">Daha önce aldığınız .json yedeği</div></span><span class="ok3">›</span></button>
    <button class="satir" data-act="hepsiniSil" style="color:var(--kirmizi)"><span class="s-orta"><div class="s-bas">Tüm verileri sil</div></span></button>
  </div>
  <div class="surum">Berber Randevu${surum ? ' · sürüm ' + esc(surum) : ''}<br>Veriler yalnızca bu telefonda saklanır.</div>`;
}
function tekAlanFormu(baslik, etiket, deger, kaydet, secenek = {}) {
  sheetAc(`
  <div class="sh-bas"><h3>${esc(baslik)}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik"><label class="alan"><span>${esc(etiket)}</span>${secenek.cok ? `<textarea id="tekAlan" rows="5">${esc(deger)}</textarea>` : `<input id="tekAlan" value="${esc(deger)}">`}</label>${secenek.ek || ''}</div>
  <div class="sh-alt">${secenek.varsayilan ? '<button class="btn cizgili" id="tekVars">Varsayılan</button>' : ''}<button class="btn ana tam" id="tekKaydet">Kaydet</button></div>`, sh => {
    const el = $('#tekAlan', sh);
    if (secenek.onizle) { const f = () => secenek.onizle(el.value, sh); el.addEventListener('input', f); f(); }
    if (secenek.varsayilan) $('#tekVars', sh).onclick = () => { el.value = secenek.varsayilan; el.dispatchEvent(new Event('input')); };
    $('#tekKaydet', sh).onclick = () => {
      const v = el.value.trim();
      if (!v) { tost('Boş bırakılamaz'); return; }
      kaydet(v);
      kaydetVeri();
      sheetKapat();
      tumunuYenile();
    };
  });
}
function berberFormu(b) {
  let renk = b?.renk || RENKLER[db.berberler.length % RENKLER.length];
  sheetAc(`
  <div class="sh-bas"><h3>${b ? 'Berberi düzenle' : 'Berber ekle'}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <label class="alan"><span>Ad</span><input id="bAd" value="${esc(b?.ad || '')}" placeholder="Ör. Ali Usta"></label>
    <div class="alan"><span>Takvim rengi</span><div class="renk-sec" id="bRenk">${RENKLER.map(r => `<button type="button" data-r="${r}" style="background:${r}" class="${r === renk ? 'secili' : ''}"></button>`).join('')}</div></div>
  </div>
  <div class="sh-alt">${b ? '<button class="btn cizgili" id="bSil" style="color:var(--kirmizi)">Sil</button>' : ''}<button class="btn ana tam" id="bKaydet">Kaydet</button></div>`, sh => {
    if (!b) setTimeout(() => $('#bAd', sh).focus(), 250);
    $('#bRenk', sh).onclick = e => { const x = e.target.closest('[data-r]'); if (!x) return; renk = x.dataset.r; $$('#bRenk button', sh).forEach(y => y.classList.toggle('secili', y === x)); };
    $('#bKaydet', sh).onclick = () => {
      const ad = $('#bAd', sh).value.trim();
      if (!ad) { tost('Ad yazın'); return; }
      if (b) { Object.assign(b, { ad, renk }); db.randevular.forEach(r => { if (r.bid === b.id) r.bad = ad; }); }
      else db.berberler.push({ id: yeniId(), ad, renk });
      kaydetVeri(); sheetKapat(); tumunuYenile();
    };
    const sil = $('#bSil', sh);
    if (sil) sil.onclick = async () => {
      if (db.berberler.length < 2) { tost('En az bir berber olmalı'); return; }
      const bekleyen = db.randevular.filter(r => r.bid === b.id && r.durum === 'bekliyor' && r.tarih >= bugunStr()).length;
      if (!await onayla(`${b.ad} silinsin mi?${bekleyen ? `\n${bekleyen} bekleyen randevusu var; bunlar ${db.berberler.find(x => x !== b).ad} adına aktarılır.` : ''}\nGeçmiş kayıtlar kasada kalır.`, 'Sil', true)) return;
      const yeni = db.berberler.find(x => x !== b);
      db.randevular.forEach(r => { if (r.bid === b.id) { r.bad = b.ad; if (r.durum === 'bekliyor' && r.tarih >= bugunStr()) { r.bid = yeni.id; r.bad = yeni.ad; } } });
      db.berberler = db.berberler.filter(x => x !== b);
      kaydetVeri(); sheetKapat(); tumunuYenile();
    };
  });
}
function hizmetFormu(h) {
  sheetAc(`
  <div class="sh-bas"><h3>${h ? 'Hizmeti düzenle' : 'Hizmet ekle'}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <label class="alan"><span>Hizmet adı</span><input id="hAd" value="${esc(h?.ad || '')}" placeholder="Ör. Saç kesimi"></label>
    <div class="ikili">
      <label class="alan"><span>Süre (dk)</span><input id="hDk" type="number" inputmode="numeric" min="5" step="5" value="${h?.dk ?? 30}"></label>
      <label class="alan"><span>Fiyat (₺)</span><input id="hFiyat" type="number" inputmode="numeric" min="0" value="${h?.fiyat ?? ''}"></label>
    </div>
    <div class="ipucu">Fiyat değişikliği eski randevuları etkilemez.</div>
  </div>
  <div class="sh-alt">${h ? '<button class="btn cizgili" id="hSil" style="color:var(--kirmizi)">Sil</button>' : ''}<button class="btn ana tam" id="hKaydet">Kaydet</button></div>`, sh => {
    if (!h) setTimeout(() => $('#hAd', sh).focus(), 250);
    $('#hKaydet', sh).onclick = () => {
      const ad = $('#hAd', sh).value.trim(), sure = parseInt($('#hDk', sh).value, 10) || 0, fiyat = Math.max(0, +$('#hFiyat', sh).value || 0);
      if (!ad) { tost('Hizmet adını yazın'); return; }
      if (sure < 5) { tost('Süre en az 5 dk olmalı'); return; }
      if (h) Object.assign(h, { ad, dk: sure, fiyat }); else db.hizmetler.push({ id: yeniId(), ad, dk: sure, fiyat });
      kaydetVeri(); sheetKapat(); tumunuYenile();
    };
    const sil = $('#hSil', sh);
    if (sil) sil.onclick = async () => {
      if (!await onayla(`“${h.ad}” hizmeti silinsin mi?\nEski randevulardaki kayıtlar korunur.`, 'Sil', true)) return;
      db.hizmetler = db.hizmetler.filter(x => x !== h);
      kaydetVeri(); sheetKapat(); tumunuYenile();
    };
  });
}
function saatFormu(i) {
  const g = { ...db.ayar.saatler[i] };
  sheetAc(`
  <div class="sh-bas"><h3>${GUNLER[i]}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik">
    <label class="anahtar"><b style="font-weight:500">Dükkan açık</b><input type="checkbox" id="sAcik" ${g.acik ? 'checked' : ''}></label>
    <div id="sSaatler">
      <div class="ikili"><label class="alan"><span>Açılış</span><input id="sBas" type="time" value="${g.bas}"></label><label class="alan"><span>Kapanış</span><input id="sBit" type="time" value="${g.bit}"></label></div>
      <div class="ikili"><label class="alan"><span>Ara başı</span><input id="sAraBas" type="time" value="${g.araBas}"></label><label class="alan"><span>Ara sonu</span><input id="sAraBit" type="time" value="${g.araBit}"></label></div>
      <div class="ipucu">Öğle arası yoksa ara saatlerini boş bırakın.</div>
    </div>
  </div>
  <div class="sh-alt"><button class="btn cizgili" id="sHepsi">Tüm günlere uygula</button><button class="btn ana tam" id="sKaydet">Kaydet</button></div>`, sh => {
    const goster = () => { $('#sSaatler', sh).style.opacity = $('#sAcik', sh).checked ? 1 : .4; };
    $('#sAcik', sh).onchange = goster; goster();
    const oku = () => {
      const y = { acik: $('#sAcik', sh).checked, bas: $('#sBas', sh).value || '09:00', bit: $('#sBit', sh).value || '21:00', araBas: $('#sAraBas', sh).value, araBit: $('#sAraBit', sh).value };
      if (dk(y.bit) <= dk(y.bas)) { tost('Kapanış açılıştan sonra olmalı'); return null; }
      if ((y.araBas && !y.araBit) || (!y.araBas && y.araBit) || (y.araBas && dk(y.araBit) <= dk(y.araBas))) { tost('Ara saatlerini kontrol edin'); return null; }
      return y;
    };
    $('#sKaydet', sh).onclick = () => { const y = oku(); if (!y) return; db.ayar.saatler[i] = y; kaydetVeri(); sheetKapat(); tumunuYenile(); };
    $('#sHepsi', sh).onclick = async () => {
      const y = oku(); if (!y) return;
      if (!await onayla(`Bu saatler (${saatOzet(y)}) haftanın tüm günlerine uygulansın mı?`, 'Uygula')) return;
      db.ayar.saatler = db.ayar.saatler.map(() => ({ ...y }));
      kaydetVeri(); sheetKapat(); tumunuYenile();
    };
  });
}

// ---------------- İlk kurulum ----------------
function kurulum() {
  const hz = db.hizmetler.map(h => ({ ...h }));
  const berberSatir = (ad = '') => `<div class="hz-satir"><input class="ad bAdK" value="${esc(ad)}" placeholder="Berber adı (ör. Ali Usta)"><button type="button" data-sil="1">×</button></div>`;
  const hizmetSatir = h => `<div class="hz-satir" data-id="${h.id}"><input class="ad hzAd" value="${esc(h.ad)}" placeholder="Hizmet"><input class="sayi hzDk" type="number" inputmode="numeric" value="${h.dk}" title="dk"><input class="sayi hzFiyat" type="number" inputmode="numeric" value="${h.fiyat}" title="₺"><button type="button" data-sil="1">×</button></div>`;
  sheetAc(`
  <div class="sh-icerik" style="padding-top:20px">
    <div class="kurulum-giris"><div class="logo">${IK.makas}</div><h3 style="font-family:Georgia,serif;font-weight:normal;font-size:22px">Berber Randevu</h3><p>Birkaç bilgiyle başlayalım. Hepsini sonra Ayarlar'dan değiştirebilirsiniz.</p></div>
    <label class="alan"><span>Dükkan adı</span><input id="kDukkan" placeholder="Ör. Usta Berber" value=""></label>
    <div class="alan"><span>Berberler</span><div id="kBerberler">${berberSatir()}</div><button type="button" class="btn kucuk cizgili" id="kBerberEkle">+ Berber ekle</button></div>
    <div class="alan"><span>Hizmetler <em>süre (dk) · fiyat (₺) — fiyatlarınızı yazın</em></span><div id="kHizmetler">${hz.map(hizmetSatir).join('')}</div><button type="button" class="btn kucuk cizgili" id="kHizmetEkle">+ Hizmet ekle</button></div>
    <div class="ikili">
      <label class="alan"><span>Açılış</span><input id="kBas" type="time" value="09:00"></label>
      <label class="alan"><span>Kapanış</span><input id="kBit" type="time" value="21:00"></label>
    </div>
    <div class="alan"><span>Kapalı gün</span><div class="secim" id="kKapali">${GUN_KISA.map((g, i) => `<button type="button" data-i="${i}" class="${i === 6 ? 'secili' : ''}" style="min-width:40px;padding:9px 0">${g}</button>`).join('')}</div></div>
  </div>
  <div class="sh-alt"><button class="btn pirinc tam" id="kBasla">Başla</button></div>`, sh => {
    const kapali = new Set([6]);
    $('#kKapali', sh).onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const i = +b.dataset.i; kapali.has(i) ? kapali.delete(i) : kapali.add(i); b.classList.toggle('secili'); };
    $('#kBerberEkle', sh).onclick = () => { $('#kBerberler', sh).insertAdjacentHTML('beforeend', berberSatir()); $$('.bAdK', sh).pop().focus(); };
    $('#kHizmetEkle', sh).onclick = () => { $('#kHizmetler', sh).insertAdjacentHTML('beforeend', hizmetSatir({ id: yeniId(), ad: '', dk: 30, fiyat: '' })); $$('.hzAd', sh).pop().focus(); };
    sh.addEventListener('click', e => { const s = e.target.closest('[data-sil]'); if (s) s.parentElement.remove(); });
    $('#kBasla', sh).onclick = () => {
      const bas = $('#kBas', sh).value || '09:00', bit = $('#kBit', sh).value || '21:00';
      if (dk(bit) <= dk(bas)) { tost('Kapanış açılıştan sonra olmalı'); return; }
      db.ayar.dukkan = $('#kDukkan', sh).value.trim() || 'Berber Salonu';
      const adlar = $$('.bAdK', sh).map(i => i.value.trim()).filter(Boolean);
      db.berberler = (adlar.length ? adlar : ['Usta']).map((ad, i) => ({ id: 'b' + (i + 1), ad, renk: RENKLER[i % RENKLER.length] }));
      db.hizmetler = $$('#kHizmetler .hz-satir', sh).map(s => ({ id: s.dataset.id, ad: $('.hzAd', s).value.trim(), dk: parseInt($('.hzDk', s).value, 10) || 30, fiyat: Math.max(0, +$('.hzFiyat', s).value || 0) })).filter(h => h.ad);
      db.ayar.saatler = GUNLER.map((_, i) => ({ acik: !kapali.has(i), bas, bit, araBas: '', araBit: '' }));
      db.kurulum = true;
      kaydetVeri();
      sheetKapat();
      tumunuYenile();
      bildirimIzni(true);
      tost('Hazır! + ile ilk randevuyu ekleyin');
    };
  }, { kapanmaz: true });
}

// ---------------- Dışa aktarma ve yedek ----------------
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function dosyaVer(ad, bytes, mime, aciklama) {
  if (!android()) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
    a.download = ad;
    document.body.appendChild(a); a.click(); a.remove();
    tost('Dosya indirildi');
    return;
  }
  const veri = b64(bytes);
  sheetAc(`
  <div class="sh-bas"><h3>${esc(aciklama || 'Dosya hazır')}</h3><button class="x" data-act="kapat">×</button></div>
  <div class="sh-icerik"><div class="bilgi"><div><span>Dosya</span><b style="word-break:break-all">${esc(ad)}</b></div></div>
    <div class="eylemler" style="grid-template-columns:1fr">
      <button class="btn ana" id="dKaydet">İndirilenler'e kaydet</button>
      <button class="btn cizgili" id="dPaylas">Paylaş (WhatsApp, Drive, e-posta…)</button>
    </div></div>`, sh => {
    $('#dKaydet', sh).onclick = () => {
      let sonuc = '';
      try { sonuc = AndroidBridge.saveFile(ad, veri, mime); } catch (e) { sonuc = ''; }
      if (sonuc) { sheetKapat(); tost(sonuc); } else { tost('Kaydedilemedi, paylaşarak deneyin'); }
    };
    $('#dPaylas', sh).onclick = () => { try { AndroidBridge.shareFile(ad, veri, mime); } catch (e) { tost('Paylaşılamadı'); } sheetKapat(); };
  });
}
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const R_BASLIK = ['Tarih', 'Gün', 'Saat', 'Bitiş', 'Müşteri', 'Telefon', 'Berber', 'Hizmetler', 'Süre (dk)', 'Tutar', 'Durum', 'Ödeme', 'Not'];
const R_GENISLIK = [11, 11, 7, 7, 22, 15, 14, 28, 9, 10, 12, 12, 30];
const rSatir = r => [tarihTR(r.tarih), GUNLER[gunNo(r.tarih)], r.saat, saat(bitis(r)), musteriAdi(r), telGoster(musteri(r.mid)?.tel || ''), berberAdi(r), hizmetAdlari(r), r.dk, +r.tutar || 0, DURUM[r.durum].ad, r.durum === 'tamam' ? (ODEME[r.odeme] || 'Nakit') : '', r.not || ''];
const tarihSirala = (a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat);
function kasaExcel() {
  const v = donemVerisi();
  if (!v.rl.length) { tost('Bu dönemde randevu yok'); return; }
  const sayfalar = [
    { ad: 'Özet', genislik: [26, 16], satirlar: [['Bilgi', 'Değer'],
      ['Dönem', v.a.etiket], ['Ciro', { v: v.ciro, para: true }], ['Tamamlanan randevu', v.tamam.length],
      ['Ortalama / müşteri', { v: v.tamam.length ? Math.round(v.ciro / v.tamam.length) : 0, para: true }],
      ['Gelmedi', v.gelmedi], ['İptal', v.iptal], ['Bekleyen', v.bekleyen.length],
      ...Object.entries(ODEME).map(([k, et]) => [`${et} tahsilat`, { v: v.odeme[k], para: true }])] },
    { ad: 'Randevular', genislik: R_GENISLIK, paraKolon: [9], satirlar: [R_BASLIK, ...v.rl.slice().sort(tarihSirala).map(rSatir)] },
    { ad: 'Hizmetler', genislik: [24, 8, 12], paraKolon: [2], satirlar: [['Hizmet', 'Adet', 'Ciro'], ...v.hizmetler.map(h => [h.ad, h.adet, Math.round(h.ciro)])] }
  ];
  if (cokluBerber()) sayfalar.push({ ad: 'Berberler', genislik: [20, 8, 12], paraKolon: [2], satirlar: [['Berber', 'Randevu', 'Ciro'], ...v.berberler.map(b => [b.ad, b.adet, Math.round(b.ciro)])] });
  dosyaVer(`Kasa-${v.a.etiket.replace(/[^\wçğıöşüÇĞİÖŞÜ]+/g, '-')}.xlsx`, Xlsx.olustur(sayfalar), XLSX_MIME, 'Excel dosyası hazır');
}
function tumExcel() {
  const ist = musteriIstatlari();
  const bos = { ziyaret: 0, harcama: 0, gelmedi: 0, son: '' };
  const sayfalar = [
    { ad: 'Randevular', genislik: R_GENISLIK, paraKolon: [9], satirlar: [R_BASLIK, ...db.randevular.slice().sort(tarihSirala).map(rSatir)] },
    { ad: 'Müşteriler', genislik: [24, 16, 9, 13, 9, 13, 30], paraKolon: [3], satirlar: [['Ad Soyad', 'Telefon', 'Ziyaret', 'Toplam harcama', 'Gelmedi', 'Son ziyaret', 'Not'],
      ...db.musteriler.slice().sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(m => { const s = ist.get(m.id) || bos; return [m.ad, telGoster(m.tel), s.ziyaret, s.harcama, s.gelmedi, s.son ? tarihTR(s.son) : '', m.not || '']; })] },
    { ad: 'Hizmetler', genislik: [24, 10, 10], paraKolon: [2], satirlar: [['Hizmet', 'Süre (dk)', 'Fiyat'], ...db.hizmetler.map(h => [h.ad, h.dk, h.fiyat])] }
  ];
  dosyaVer(`Berber-Randevu-${bugunStr()}.xlsx`, Xlsx.olustur(sayfalar), XLSX_MIME, 'Excel dosyası hazır');
}
function yedekAl() {
  dosyaVer(`berber-yedek-${bugunStr()}.json`, new TextEncoder().encode(JSON.stringify(db)), 'application/json', 'Yedek hazır');
}
function yedekYukle(dosya) {
  const fr = new FileReader();
  fr.onload = async () => {
    let v;
    try { v = JSON.parse(fr.result); } catch (e) { tost('Bu dosya bir yedek değil'); return; }
    if (!v || !Array.isArray(v.randevular) || !v.ayar) { tost('Bu dosya bir Berber Randevu yedeği değil'); return; }
    if (!await onayla(`Yedekte ${v.randevular.length} randevu ve ${(v.musteriler || []).length} müşteri var.\nTelefondaki mevcut veriler bunlarla değiştirilecek.`, 'Geri yükle', true)) return;
    db = duzenle(v);
    db.kurulum = true;
    kaydetVeri();
    tumunuYenile();
    tost('Yedek geri yüklendi');
  };
  fr.readAsText(dosya);
}

// ---------------- Bildirimler (Android) ----------------
function hatirlaticiPlanla() {
  if (!android()) return;
  const once = +db.ayar.hatirlatDk || 0, simdi = Date.now(), liste = [];
  if (once > 0) {
    for (const r of db.randevular) {
      if (r.durum !== 'bekliyor') continue;
      const d = tarihObj(r.tarih);
      d.setHours(0, dk(r.saat), 0, 0);
      const zaman = d.getTime() - once * 60000;
      if (zaman <= simdi || zaman - simdi > 21 * 864e5) continue;
      liste.push({ no: sayiId(r.id), zaman, baslik: `${r.saat} · ${musteriAdi(r)}`,
        metin: `${once >= 60 ? once / 60 + ' saat' : once + ' dk'} sonra: ${hizmetAdlari(r) || 'randevu'}${cokluBerber() ? ' · ' + berberAdi(r) : ''}` });
    }
  }
  liste.sort((a, b) => a.zaman - b.zaman);
  try { AndroidBridge.setReminders(JSON.stringify(liste.slice(0, 80))); } catch (e) { /* eski sürüm */ }
}
function bildirimIzni(zorla) {
  if (!android() || !(+db.ayar.hatirlatDk > 0)) return;
  try { if (!zorla && localStorage.getItem('bildirimSoruldu')) return; localStorage.setItem('bildirimSoruldu', '1'); } catch (e) { /* yok */ }
  try { AndroidBridge.requestNotificationPermission(); } catch (e) { /* yok */ }
}

// ---------------- Eylemler ----------------
const EYLEM = {
  kapat: () => sheetKapat(),
  sekme: el => { ui.sekme = el.dataset.s; sheetler.slice().forEach(s => { if (!s.kapanmaz) sheetKapat(s); }); ciz(true); },
  gunSec: el => { ui.gun = el.dataset.t; ciz(); },
  haftaKay: el => { ui.gun = gunEkle(ui.gun, +el.dataset.n); ciz(); },
  bugun: () => { ui.gun = bugunStr(); ciz(); },
  berberFiltre: el => { ui.berber = el.dataset.id; ciz(); },
  yeniRandevu: () => randevuFormu(null, ui.sekme === 'takvim' ? {} : { tarih: ui.gun >= bugunStr() ? ui.gun : bugunStr() }),
  yeniSaat: el => randevuFormu(null, { tarih: ui.gun, saat: saat(+el.dataset.t), bid: el.dataset.bid }),
  rDetay: el => randevuDetay(el.dataset.id),
  rDuzenle: el => { const r = randevu(el.dataset.id); if (r) randevuFormu(r); },
  rTekrar: el => {
    const r = randevu(el.dataset.id);
    if (!r) return;
    const t = gunEkle(bugunStr(), 1);
    randevuFormu(null, { mid: r.mid, bid: berber(r.bid) ? r.bid : undefined, tarih: r.tarih > bugunStr() ? gunEkle(r.tarih, 7) : t, hiz: r.hizmetler.map(h => h.id) });
  },
  tamamla: el => { const r = randevu(el.dataset.id); if (r) tamamlaFormu(r); },
  gelmedi: el => { const r = randevu(el.dataset.id); if (!r) return; r.durum = 'gelmedi'; kaydetVeri(); tumunuYenile(); tost('Gelmedi olarak işaretlendi'); },
  geriAl: el => { const r = randevu(el.dataset.id); if (!r) return; r.durum = 'bekliyor'; kaydetVeri(); tumunuYenile(); tost("Bekliyor'a alındı"); },
  rIptal: async el => {
    const r = randevu(el.dataset.id);
    if (!r || !await onayla(`${musteriAdi(r)} · ${kisaTarih(r.tarih)} ${r.saat} randevusu iptal edilsin mi?`, 'İptal et', true)) return;
    r.durum = 'iptal'; kaydetVeri(); tumunuYenile(); tost('Randevu iptal edildi');
  },
  rSil: async el => {
    const r = randevu(el.dataset.id);
    if (!r || !await onayla('Bu randevu tamamen silinsin mi? Kasadan da düşer.', 'Sil', true)) return;
    db.randevular = db.randevular.filter(x => x !== r); kaydetVeri(); tumunuYenile(); tost('Randevu silindi');
  },
  ara: el => { if (el.dataset.tel) disAc('tel:' + telTemiz(el.dataset.tel)); },
  waAc: el => { const n = waNo(el.dataset.tel); if (n) disAc(`https://wa.me/${n}`); },
  waHatirlat: el => { const r = randevu(el.dataset.id); if (r) waHatirlat(r); },
  yarinHatirlat: () => yarinHatirlatma(),
  mDetay: el => musteriDetay(el.dataset.id),
  mYeni: () => musteriFormu(null),
  mDuzenle: el => { const m = musteri(el.dataset.id); if (m) musteriFormu(m); },
  mRandevu: el => randevuFormu(null, { mid: el.dataset.id, tarih: ui.gun >= bugunStr() ? ui.gun : bugunStr() }),
  mSil: async el => {
    const m = musteri(el.dataset.id);
    if (!m) return;
    const bek = db.randevular.filter(r => r.mid === m.id && r.durum === 'bekliyor' && r.tarih >= bugunStr());
    if (!await onayla(`${m.ad} silinsin mi?${bek.length ? `\n${bek.length} bekleyen randevusu da silinecek.` : ''}\nGeçmiş kayıtlar kasada kalır.`, 'Sil', true)) return;
    db.randevular = db.randevular.filter(r => !bek.includes(r));
    db.randevular.forEach(r => { if (r.mid === m.id) r.mad = m.ad; });
    db.musteriler = db.musteriler.filter(x => x !== m);
    kaydetVeri(); tumunuYenile(); tost('Müşteri silindi');
  },
  raporTur: el => { ui.rapor = el.dataset.k; ui.raporRef = bugunStr(); ciz(); },
  donemKay: el => { donemKaydir(+el.dataset.n); ciz(); },
  kasaExcel: () => kasaExcel(),
  tumExcel: () => tumExcel(),
  yedekAl: () => yedekAl(),
  yedekYukle: () => { const i = $('#dosyaSec'); i.value = ''; i.click(); },
  hepsiniSil: async () => {
    if (!await onayla('TÜM randevular, müşteriler ve ayarlar silinecek. Önce yedek almanız önerilir.', 'Devam', true)) return;
    if (!await onayla('Emin misiniz? Bu işlem geri alınamaz.', 'Hepsini sil', true)) return;
    db = varsayilanVeri(); kaydetVeri(); ui.sekme = 'takvim'; ciz(true); kurulum();
  },
  dukkanAdi: () => tekAlanFormu('Dükkan adı', 'Dükkan adı', db.ayar.dukkan, v => { db.ayar.dukkan = v; }),
  berberDuzenle: el => berberFormu(el.dataset.id ? berber(el.dataset.id) : null),
  hizmetDuzenle: el => hizmetFormu(el.dataset.id ? hizmet(el.dataset.id) : null),
  saatDuzenle: el => saatFormu(+el.dataset.i),
  aralik: el => { db.ayar.aralik = +el.dataset.n; kaydetVeri(); ciz(); },
  hatirlatDk: el => { db.ayar.hatirlatDk = +el.dataset.n; kaydetVeri(); ciz(); bildirimIzni(true); tost(+el.dataset.n ? 'Bildirimler açık' : 'Bildirimler kapalı'); },
  sablonDuzenle: () => {
    const ornek = { id: 'x', mid: null, mad: 'Ahmet Yılmaz', bid: db.berberler[0].id, tarih: gunEkle(bugunStr(), 1), saat: '14:30', dk: 30, hizmetler: db.hizmetler.slice(0, 1) };
    tekAlanFormu('WhatsApp mesajı', 'Mesaj', db.ayar.waSablon, v => { db.ayar.waSablon = v; }, {
      cok: true, varsayilan: VARSAYILAN_SABLON,
      ek: '<div class="ipucu" style="margin:-6px 0 10px">Kullanılabilir alanlar: {ad} {gun} {tarih} {saat} {hizmet} {berber} {dukkan}</div><div class="etiket">Önizleme</div><div class="onizleme" id="onizleme"></div>',
      onizle: (deger, sh) => {
        const eski = db.ayar.waSablon;
        db.ayar.waSablon = deger;
        $('#onizleme', sh).textContent = waMesaj(ornek);
        db.ayar.waSablon = eski;
      }
    });
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = EYLEM[el.dataset.act];
  if (f) { e.preventDefault(); f(el, e); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'tarihSec' && e.target.value) { ui.gun = e.target.value; ciz(); }
  if (e.target.id === 'dosyaSec' && e.target.files[0]) yedekYukle(e.target.files[0]);
});
document.addEventListener('input', e => {
  if (e.target.id === 'mAra') { ui.mAra = e.target.value; musteriListeCiz(); }
});

// Saat ilerledikçe "sıradaki" ve boş saatler güncellensin
let sonGun = bugunStr();
function zamanTiki() {
  const b = bugunStr();
  if (b !== sonGun) { if (ui.gun === sonGun) ui.gun = b; sonGun = b; }
  if (!sheetler.length && ui.sekme === 'takvim' && !aktifOnay) ciz();
}
setInterval(zamanTiki, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) zamanTiki(); });

// ---------------- Başlat ----------------
ciz();
hatirlaticiPlanla();
if (!db.kurulum) kurulum(); else bildirimIzni();
