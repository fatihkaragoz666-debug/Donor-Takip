package com.oabkm.antalyatransfer

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Transfer uyarıları: uygulama her değişiklikte açık saat gruplarının listesini gönderir
 * ({at, title, text, nid, hedef}); hepsi tam saatinde çalışan alarm olarak kurulur.
 * İşaretlenen gruplar listeden çıktığı için onların uyarıları iptal olur.
 */
object Hatirlatici {
    const val EXTRA_HEDEF = "antalyatransfer.hedef"
    private const val PREFS = "uyarilar"
    private const val CHANNEL = "transfer_uyari"
    private const val ACTION = "com.oabkm.antalyatransfer.UYARI"
    private const val DENEME_KODU = 99999

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(c: Context, json: String) {
        prefs(c).edit().putString("liste", json).apply()
        schedule(c)
    }

    private fun intentFor(c: Context, code: Int, o: JSONObject?): PendingIntent {
        val i = Intent(c, UyariReceiver::class.java).setAction(ACTION)
        if (o != null) {
            i.putExtra("baslik", o.optString("title"))
            i.putExtra("metin", o.optString("text"))
            i.putExtra("hedef", o.optString("hedef"))
            i.putExtra("nid", o.optInt("nid", 3000 + code))
        }
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun kur(am: AlarmManager, at: Long, pi: PendingIntent): Boolean {
        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            try {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
                return true
            } catch (e: SecurityException) {
                // izin yok: aşağıdaki yönteme düş
            }
        }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        return false
    }

    fun schedule(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val p = prefs(c)
        val eski = p.getInt("adet", 0)
        for (k in 0 until eski) am.cancel(intentFor(c, k, null))
        val arr = try {
            JSONArray(p.getString("liste", "[]") ?: "[]")
        } catch (e: Exception) {
            JSONArray()
        }
        val now = System.currentTimeMillis()
        var n = 0
        var sonraki = 0L
        for (k in 0 until arr.length()) {
            val o = arr.optJSONObject(k) ?: continue
            val at = o.optLong("at", 0L)
            if (at <= now + 5_000L) continue
            kur(am, at, intentFor(c, n, o))
            if (sonraki == 0L || at < sonraki) sonraki = at
            n++
            if (n >= 400) break
        }
        p.edit().putInt("adet", n).putLong("sonraki", sonraki).apply()
    }

    fun dene(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val o = JSONObject()
            .put("title", "Deneme bildirimi")
            .put("text", "Uyarılar çalışıyor. Uçuş ve biniş saatlerinden önce böyle bir bildirim gelecek.")
            .put("nid", 2999)
            .put("hedef", "")
        kur(am, System.currentTimeMillis() + 60_000L, intentFor(c, DENEME_KODU, o))
    }

    fun fire(c: Context, intent: Intent) {
        bildir(
            c,
            intent.getStringExtra("baslik") ?: "Transfer uyarısı",
            intent.getStringExtra("metin") ?: "",
            intent.getStringExtra("hedef") ?: "",
            intent.getIntExtra("nid", 3000)
        )
    }

    private fun kanal(nm: NotificationManager) {
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Transfer uyarıları", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Uçuş varışı ve otelden biniş öncesi, işaretlenmeyen gruplar için uyarı"
                enableVibration(true)
            }
        )
    }

    private fun bildir(c: Context, baslik: String, metin: String, hedef: String, id: Int) {
        if (Build.VERSION.SDK_INT >= 33 &&
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        kanal(nm)
        val open = Intent(c, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        if (hedef.isNotEmpty()) open.putExtra(EXTRA_HEDEF, hedef)
        val pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_transfer)
            .setContentTitle(baslik)
            .setContentText(metin)
            .setStyle(NotificationCompat.BigTextStyle().bigText(metin))
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()
        nm.notify(id, n)
    }

    fun durum(c: Context): String {
        val p = prefs(c)
        val nm = c.getSystemService(NotificationManager::class.java)
        val izin = Build.VERSION.SDK_INT < 33 ||
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val ch = nm?.getNotificationChannel(CHANNEL)
        val bildirim = izin && nm != null && nm.areNotificationsEnabled() &&
            (ch == null || ch.importance != NotificationManager.IMPORTANCE_NONE)
        val am = c.getSystemService(AlarmManager::class.java)
        val tamAlarm = Build.VERSION.SDK_INT < 31 || am?.canScheduleExactAlarms() == true
        val pm = c.getSystemService(PowerManager::class.java)
        val pil = pm?.isIgnoringBatteryOptimizations(c.packageName) == true
        return JSONObject()
            .put("bildirim", bildirim)
            .put("tamAlarm", tamAlarm)
            .put("pil", pil)
            .put("adet", p.getInt("adet", 0))
            .put("sonraki", p.getLong("sonraki", 0L))
            .toString()
    }
}

class UyariReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Hatirlatici.fire(context, intent)
    }
}

/** Telefon yeniden başlayınca, saat değişince ya da uygulama güncellenince uyarılar yeniden kurulur */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
            AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED -> Hatirlatici.schedule(context)
        }
    }
}
