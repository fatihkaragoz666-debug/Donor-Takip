package com.oabkm.donortakip

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
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

/**
 * Seçilen saatte (hafta içi, resmi tatiller hariç; ya da her gün) "güncel tabloyu WhatsApp'ta gönder" bildirimi.
 * Tam saatinde çalışan alarm kullanılır. Bildirime dokununca uygulama açılır, tabloyu hazırlar ve WhatsApp'ı açar;
 * Gönder'e kullanıcı basar (Android, WhatsApp'ta başka bir uygulamanın göndermesine izin vermez).
 */
object Hatirlatma {
    const val EXTRA_EYLEM = "donortakip.eylem"
    private const val PREFS = "hatirlatma"
    private const val CHANNEL = "tablo_gonder"
    private const val ESKI_CHANNEL = "gunluk_tablo"
    const val ACTION_ALARM = "com.oabkm.donortakip.HATIRLATMA"
    const val ACTION_DENEME = "com.oabkm.donortakip.HATIRLATMA_DENEME"
    private const val NOTIF_ID = 1001

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** JS'ten: {on, saat, dakika, tatil:"yyyy-MM-dd,…", hergun} */
    fun save(c: Context, json: String) {
        val o = try { JSONObject(json) } catch (e: Exception) { JSONObject() }
        prefs(c).edit()
            .putBoolean("on", o.optBoolean("on", false))
            .putBoolean("hergun", o.optBoolean("hergun", false))
            .putInt("saat", o.optInt("saat", 8).coerceIn(0, 23))
            .putInt("dakika", o.optInt("dakika", 30).coerceIn(0, 59))
            .putString("tatil", o.optString("tatil", ""))
            .apply()
        schedule(c)
    }

    private fun alarmIntent(c: Context, action: String, code: Int): PendingIntent = PendingIntent.getBroadcast(
        c, code,
        Intent(c, HatirlatmaReceiver::class.java).setAction(action),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    private fun gunAnahtari(cal: Calendar): String = String.format(
        Locale.ROOT, "%04d-%02d-%02d",
        cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
    )

    private fun isWorkday(c: Context, cal: Calendar, holidays: Set<String>): Boolean {
        if (prefs(c).getBoolean("hergun", false)) return true
        val dow = cal.get(Calendar.DAY_OF_WEEK)
        if (dow == Calendar.SATURDAY || dow == Calendar.SUNDAY) return false
        return gunAnahtari(cal) !in holidays
    }

    private fun holidays(c: Context): Set<String> =
        (prefs(c).getString("tatil", "") ?: "").split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    /** Bir sonraki iş günü, seçilen saat */
    private fun nextTime(c: Context): Long {
        val p = prefs(c)
        val tat = holidays(c)
        val now = System.currentTimeMillis()
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, p.getInt("saat", 8))
        cal.set(Calendar.MINUTE, p.getInt("dakika", 30))
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        if (cal.timeInMillis <= now + 30_000L) cal.add(Calendar.DAY_OF_YEAR, 1)
        var guard = 0
        while (!isWorkday(c, cal, tat) && guard++ < 40) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }

    /** Tam saatinde çalışan alarm (Android 12+ izin varsa); yoksa sistemin geciktirebileceği alarm */
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
        val pi = alarmIntent(c, ACTION_ALARM, 1)
        am.cancel(pi)
        val p = prefs(c)
        if (!p.getBoolean("on", false)) {
            p.edit().putLong("sonraki", 0L).apply()
            return
        }
        val at = nextTime(c)
        kur(am, at, pi)
        p.edit().putLong("sonraki", at).apply()
    }

    /** "Dene": bir dakika sonra, gün ve açık/kapalı ayarına bakmadan bir kez çalışır */
    fun dene(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        kur(am, System.currentTimeMillis() + 60_000L, alarmIntent(c, ACTION_DENEME, 3))
        prefs(c).edit().putString("sonSonuc", "Deneme 1 dakika sonra").putLong("son", System.currentTimeMillis()).apply()
    }

    fun fire(c: Context, deneme: Boolean) {
        val p = prefs(c)
        if (!deneme && !p.getBoolean("on", false)) return
        if (deneme || isWorkday(c, Calendar.getInstance(), holidays(c))) calistir(c)
        if (!deneme) schedule(c)
    }

    private fun calistir(c: Context) {
        prefs(c).edit().putLong("son", System.currentTimeMillis()).putString("sonSonuc", "Bildirim gösterildi").apply()
        bildir(c, "Güncel donör tablosu", "WhatsApp’ta göndermek için dokunun", "tabloGonder")
    }

    fun bildirimiKaldir(c: Context) {
        c.getSystemService(NotificationManager::class.java)?.cancel(NOTIF_ID)
    }

    private fun kanal(nm: NotificationManager) {
        nm.deleteNotificationChannel(ESKI_CHANNEL)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Güncel tablo", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Güncel tabloyu WhatsApp’ta gönderme hatırlatması ve sonucu"
            }
        )
    }

    private fun bildir(c: Context, baslik: String, metin: String, eylem: String?, id: Int = NOTIF_ID) {
        if (Build.VERSION.SDK_INT >= 33 &&
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        kanal(nm)
        val open = Intent(c, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        if (eylem != null) open.putExtra(EXTRA_EYLEM, eylem)
        val pi = PendingIntent.getActivity(c, 2 + id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_tablo)
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

    /** Ayarlar sayfasındaki durum satırları */
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
            .put("sonraki", p.getLong("sonraki", 0L))
            .put("son", p.getLong("son", 0L))
            .put("sonSonuc", p.getString("sonSonuc", "") ?: "")
            .put("sdk", Build.VERSION.SDK_INT)
            .toString()
    }
}

class HatirlatmaReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Hatirlatma.fire(context, intent.action == Hatirlatma.ACTION_DENEME)
    }
}

/** Telefon yeniden başlayınca, saat değişince ya da uygulama güncellenince hatırlatma yeniden kurulur */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
            AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED -> Hatirlatma.schedule(context)
        }
    }
}
