package com.oabkm.donortakip

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Path
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.content.ContextCompat
import java.util.Locale

/**
 * Erişilebilirlik hizmeti "Donör Takip – tablo gönderme".
 *
 * Yalnızca uygulama güncel tabloyu WhatsApp'ta açtıktan sonraki kısa süre içinde (kur → en çok 90 sn) çalışır:
 * WhatsApp'ın Gönder düğmesine basar; numara verilmemişse önce ayarlardaki sohbet / grup adını seçer.
 * Olaylar yalnızca WhatsApp'tan gelir (res/xml/oto_gonder.xml); hiçbir içerik okunup saklanmaz.
 * Ayrıca kilit açılınca bekleyen günlük gönderimi başlatır (Hatirlatma.bekleyeniBaslat).
 */
class OtoGonder : AccessibilityService() {

    companion object {
        @Volatile
        var servis: OtoGonder? = null
            private set

        private var bitis = 0L
        private var sohbet = ""
        private var secildi = false
        private var gonderSayisi = 0
        private var tiklama = 0
        private var sonTik = 0L
        private val basilanlar = HashSet<String>()
        private val GONDER = setOf("gönder", "gonder", "send")

        /** Ayarlar › Erişilebilirlik'te açık mı */
        fun etkin(c: Context): Boolean {
            if (servis != null) return true
            val s = Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
            val ben = ComponentName(c, OtoGonder::class.java)
            return s.split(':').any { ComponentName.unflattenFromString(it.trim()) == ben }
        }

        /** MainActivity, tabloyu WhatsApp'ta açmadan hemen önce çağırır. Hizmet çalışmıyorsa false. */
        fun kur(sohbetAdi: String): Boolean {
            val s = servis ?: return false
            bitis = System.currentTimeMillis() + 90_000L
            sohbet = sohbetAdi.trim()
            secildi = false
            gonderSayisi = 0
            tiklama = 0
            sonTik = 0L
            basilanlar.clear()
            s.basla()
            return true
        }

        private fun norm(cs: CharSequence?): String = cs?.toString()?.trim()?.lowercase(Locale.forLanguageTag("tr")) ?: ""
    }

    private val h = Handler(Looper.getMainLooper())
    private var sinif = ""
    private var diyalog = false
    private var taraPlanli = false
    private val taraR = Runnable {
        taraPlanli = false
        tara()
    }

    /** Ekranı ms sonra tara; ekran sürekli değişse de tarama ertelenip durmasın diye olaylar planı yenilemez */
    private fun planla(ms: Long) {
        h.removeCallbacks(taraR)
        taraPlanli = true
        h.postDelayed(taraR, ms)
    }
    private val zamanAsimiR = Runnable { bitir(gonderSayisi > 0) }
    private var kilitKayitli = false

    private val kilit = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            if (i.action == Intent.ACTION_USER_PRESENT) Hatirlatma.bekleyeniBaslat(this@OtoGonder)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        servis = this
        if (!kilitKayitli) {
            ContextCompat.registerReceiver(this, kilit, IntentFilter(Intent.ACTION_USER_PRESENT), ContextCompat.RECEIVER_EXPORTED)
            kilitKayitli = true
        }
        Hatirlatma.bekleyeniBaslat(this)
    }

    override fun onDestroy() {
        if (kilitKayitli) {
            try {
                unregisterReceiver(kilit)
            } catch (e: Exception) {
                // yok say
            }
            kilitKayitli = false
        }
        h.removeCallbacksAndMessages(null)
        if (servis === this) servis = null
        super.onDestroy()
    }

    override fun onInterrupt() {}

    private fun aktif() = bitis > 0L && System.currentTimeMillis() < bitis

    private fun basla() {
        sinif = ""
        diyalog = false
        h.removeCallbacks(zamanAsimiR)
        h.postDelayed(zamanAsimiR, bitis - System.currentTimeMillis())
        planla(1500)
    }

    private fun sohbetEkrani(cn: String) = cn.contains("Conversation") && !cn.contains("Picker")

    override fun onAccessibilityEvent(e: AccessibilityEvent?) {
        if (e == null || !aktif()) return
        val pkg = e.packageName?.toString() ?: return
        if (!pkg.startsWith("com.whatsapp")) return
        if (e.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val cn = e.className?.toString() ?: ""
            if (cn.contains("Dialog")) {
                diyalog = true
            } else if (cn.startsWith("com.whatsapp")) {
                sinif = cn
                diyalog = false
                // Gönderildikten sonra WhatsApp sohbeti açar: iş bitti
                if (gonderSayisi > 0 && sohbetEkrani(cn)) {
                    bitir(true)
                    return
                }
            }
        }
        if (!taraPlanli) planla(450)
    }

    private fun tara() {
        if (!aktif()) return
        val root = rootInActiveWindow ?: return
        if (root.packageName?.toString()?.startsWith("com.whatsapp") != true) return
        // Sohbet ekranındaki yazma kutusunun düğmesine basılmaz; yalnızca önizleme, diyalog ve kişi seçme ekranı
        if (sohbetEkrani(sinif) && !diyalog) {
            if (gonderSayisi > 0) bitir(true)
            return
        }
        // Bir dokunuştan sonra ekranın değişmesini bekle (iki kez göndermesin)
        val bekle = sonTik + 2500L - System.currentTimeMillis()
        if (bekle > 0) {
            planla(bekle)
            return
        }
        // Her ekranda (ve her onay penceresinde) Gönder'e en çok bir kez basılır
        val ekran = sinif + (if (diyalog) "|diyalog" else "")
        val gonder = if (ekran in basilanlar) null else gonderBul(root)
        if (gonder != null && tiklama < 6) {
            if (tikla(gonder)) {
                basilanlar.add(ekran)
                sonTik = System.currentTimeMillis()
                tiklama++
                gonderSayisi++
                diyalog = false // onay penceresi kapandı; yenisi açılırsa olay yeniden işaretler
                // Ardından bir onay ekranı daha çıkabilir: kısa süre daha bekle, yoksa bitir
                bitis = minOf(bitis, System.currentTimeMillis() + 12_000L)
                h.removeCallbacks(zamanAsimiR)
                h.postDelayed(zamanAsimiR, 12_000L)
                planla(1500)
            }
            return
        }
        if (!secildi && sohbet.isNotEmpty() && tiklama < 6) {
            val kisi = adBul(root, sohbet)
            if (kisi != null && tikla(kisi)) {
                secildi = true
                sonTik = System.currentTimeMillis() - 1600L
                tiklama++
                planla(900)
            }
        }
    }

    private fun bitir(ok: Boolean) {
        if (bitis == 0L) return
        bitis = 0L
        taraPlanli = false
        h.removeCallbacks(taraR)
        h.removeCallbacks(zamanAsimiR)
        Hatirlatma.sonucBildir(this, ok)
    }

    private fun gonderBul(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var yedek: AccessibilityNodeInfo? = null
        val q = ArrayDeque<AccessibilityNodeInfo>()
        q.add(root)
        var n = 0
        while (q.isNotEmpty() && n++ < 1500) {
            val x = q.removeFirst()
            if (x.isVisibleToUser && x.isEnabled) {
                val id = x.viewIdResourceName ?: ""
                if (id.endsWith(":id/send") || id.endsWith(":id/send_btn") || id.endsWith(":id/send_button")) {
                    return tiklanabilir(x) ?: x
                }
                if (yedek == null) {
                    val d = norm(x.contentDescription)
                    val t = norm(x.text)
                    if (d in GONDER || (t in GONDER && (x.isClickable || id == "android:id/button1"))) yedek = tiklanabilir(x) ?: x
                }
            }
            for (i in 0 until x.childCount) x.getChild(i)?.let { q.add(it) }
        }
        return yedek
    }

    private fun adBul(root: AccessibilityNodeInfo, ad: String): AccessibilityNodeInfo? {
        val hedef = norm(ad)
        val list = root.findAccessibilityNodeInfosByText(ad) ?: return null
        for (x in list) {
            if (!x.isVisibleToUser) continue
            if (x.isEditable || x.className?.toString()?.contains("EditText") == true) continue
            if (norm(x.text) == hedef || norm(x.contentDescription) == hedef) return tiklanabilir(x) ?: x
        }
        return null
    }

    private fun tiklanabilir(x: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        var y: AccessibilityNodeInfo? = x
        var k = 0
        while (y != null && k++ < 6) {
            if (y.isClickable) return y
            y = y.parent
        }
        return null
    }

    private fun tikla(x: AccessibilityNodeInfo): Boolean {
        if (x.isClickable && x.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
        // Tıklanamıyorsa ekranda o noktaya dokun
        val r = Rect()
        x.getBoundsInScreen(r)
        if (r.isEmpty) return false
        val p = Path()
        p.moveTo(r.exactCenterX(), r.exactCenterY())
        return dispatchGesture(
            GestureDescription.Builder().addStroke(GestureDescription.StrokeDescription(p, 0L, 60L)).build(),
            null, null
        )
    }
}
