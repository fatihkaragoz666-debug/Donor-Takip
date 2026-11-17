"""PDF raporları için gömülü yazı tipi: Carlito (Calibri ile aynı ölçüler, SIL OFL) alt kümesi.
Carlito'da olmayan ₺ işareti DejaVu Sans'tan ölçeklenerek eklenir. Çıktı: js/pdf-font.js
Kullanım: python3 tools/pdf-font.py <Carlito-Regular.ttf> <Carlito-Bold.ttf> <DejaVuSans.ttf> <DejaVuSans-Bold.ttf> <çıktı.js>
"""
import sys, io, zlib, base64, json
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen

UNI = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [
    0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026, 0x2030,
    0x2032, 0x2033, 0x2039, 0x203A, 0x20AC, 0x20BA, 0x2116, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193,
    0x2212, 0x2248, 0x2260, 0x2264, 0x2265, 0x2713, 0x25CF, 0x02C6, 0x02DC, 0x0300, 0x0301, 0x0307]

def cap_height(font):
    g = font['glyf'][font.getBestCmap()[ord('H')]]
    g.recalcBounds(font['glyf'])
    return g.yMax

def add_lira(font, donor):
    cm = font.getBestCmap()
    if 0x20BA in cm:
        return
    dcm = donor.getBestCmap()
    src = dcm[0x20BA]
    s = cap_height(font) / cap_height(donor)
    gs = donor.getGlyphSet()
    pen = TTGlyphPen(None)
    gs[src].draw(TransformPen(pen, (s, 0, 0, s, 0, 0)))
    g = pen.glyph()
    name = 'uni20BA'
    order = font.getGlyphOrder() + [name]
    font.setGlyphOrder(order)
    font['glyf'].glyphs[name] = g
    font['glyf'].glyphOrder = order
    g.recalcBounds(font['glyf'])
    adv = round(donor['hmtx'][src][0] * s)
    font['hmtx'].metrics[name] = (adv, g.xMin if hasattr(g, 'xMin') else 0)
    for t in font['cmap'].tables:
        if t.isUnicode():
            t.cmap[0x20BA] = name
    if 'post' in font and hasattr(font['post'], 'extraNames'):
        pass

def build(path, donor_path):
    font = TTFont(path)
    add_lira(font, TTFont(donor_path))
    have = font.getBestCmap()
    uni = [u for u in UNI if u in have]
    opt = subset.Options()
    opt.hinting = False
    opt.layout_features = []
    opt.glyph_names = False
    opt.notdef_outline = True
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opt.drop_tables += ['GSUB', 'GPOS', 'GDEF', 'kern', 'DSIG', 'LTSH', 'VDMX', 'hdmx', 'PCLT', 'gasp']
    sub = subset.Subsetter(opt)
    sub.populate(unicodes=uni)
    sub.subset(font)
    # OFL: değiştirilmiş (alt küme + ₺) yazı tipi ayrılmış adı (Carlito) taşımaz
    style = 'Bold' if 'Bold' in font['name'].getDebugName(2) else 'Regular'
    nm = font['name']
    for rec in list(nm.names):
        if rec.nameID in (1, 3, 4, 6):
            nm.removeNames(nameID=rec.nameID)
    for pid, eid, lid in ((3, 1, 0x409), (1, 0, 0)):
        nm.setName('DT Rapor', 1, pid, eid, lid)
        nm.setName('DT Rapor ' + style, 3, pid, eid, lid)
        nm.setName('DT Rapor ' + style, 4, pid, eid, lid)
        nm.setName('DTRapor-' + style, 6, pid, eid, lid)
    buf = io.BytesIO(); font.save(buf); raw = buf.getvalue()
    upm = font['head'].unitsPerEm
    k = 1000.0 / upm
    order = font.getGlyphOrder()
    gid = {n: i for i, n in enumerate(order)}
    hm = font['hmtx']
    cmap = font.getBestCmap()
    pairs = sorted((u, gid[n]) for u, n in cmap.items())
    widths = [round(hm[n][0] * k) for n in order]
    os2, head, hhea = font['OS/2'], font['head'], font['hhea']
    return {
        'b64': base64.b64encode(zlib.compress(raw, 9)).decode(), 'len1': len(raw),
        'name': font['name'].getDebugName(6),
        'asc': round(hhea.ascent * k), 'desc': round(hhea.descent * k), 'cap': round(cap_height(font) * k),
        'bbox': [round(head.xMin * k), round(head.yMin * k), round(head.xMax * k), round(head.yMax * k)],
        'w': widths, 'cmap': ''.join('%x:%x,' % p for p in pairs).rstrip(','),
    }

if __name__ == '__main__':
    reg, bold, dj, djb, out = sys.argv[1:6]
    data = {'R': build(reg, dj), 'B': build(bold, djb)}
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* PDF raporlarının yazı tipi: Carlito’dan (SIL Open Font License 1.1, tyPoland Łukasz Dziedzic) türetilmiş alt küme "DT Rapor"; ₺ DejaVu Sans’tan. tools/pdf-font.py ile üretildi; lisans: fonts/OFL.txt */\n')
        f.write('window.PDF_FONT = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    for k, v in data.items():
        print(k, v['name'], 'ham', v['len1'], 'sıkışık b64', len(v['b64']), 'glif', len(v['w']))
