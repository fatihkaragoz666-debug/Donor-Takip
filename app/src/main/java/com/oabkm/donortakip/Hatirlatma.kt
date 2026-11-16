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
import androidx.core.app.NotificationCompat
import java.util.Calendar
import java.util.Locale

/**
 * Seçilen saatte (hafta içi, resmi tatiller hariç; ya da her gün) "güncel tabloyu WhatsApp'ta gönder" bildirimi.
 * Bildirime dokununca uygulama açılır, tabloyu hazırlar ve WhatsApp'ı açar; mesajı kullanıcı gönderir.
 */
object Hatirlatma {
    const val EXTRA_EYLEM = "donortakip.eylem"
    private const val PREFS = "hatirlatma"
    private const val CHANNEL = "gunluk_tablo"
    private const val ACTION_ALARM = "com.oabkm.donortakip.HATIRLATMA"
    private const val NOTIF_ID = 1001

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(c: Context, on: Boolean, hour: Int, minute: Int, holidays: String, everyDay: Boolean) {
        prefs(c).edit()
            .putBoolean("on", on)
            .putBoolean("hergun", everyDay)
            .putInt("saat", hour.coerceIn(0, 23))
            .putInt("dakika", minute.coerceIn(0, 59))
            .putString("tatil", holidays)
            .apply()
        schedule(c)
    }

    private fun alarmIntent(c: Context): PendingIntent = PendingIntent.getBroadcast(
        c, 1,
        Intent(c, HatirlatmaReceiver::class.java).setAction(ACTION_ALARM),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    private fun isWorkday(c: Context, cal: Calendar, holidays: Set<String>): Boolean {
        if (prefs(c).getBoolean("hergun", false)) return true
        val dow = cal.get(Calendar.DAY_OF_WEEK)
        if (dow == Calendar.SATURDAY || dow == Calendar.SUNDAY) return false
        val key = String.format(
            Locale.ROOT, "%04d-%02d-%02d",
            cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH)
        )
        return key !in holidays
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

    fun schedule(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val pi = alarmIntent(c)
        am.cancel(pi)
        if (!prefs(c).getBoolean("on", false)) return
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTime(c), pi)
    }

    fun fire(c: Context) {
        if (!prefs(c).getBoolean("on", false)) return
        if (isWorkday(c, Calendar.getInstance(), holidays(c))) notify(c)
        schedule(c)
    }

    private fun notify(c: Context) {
        if (Build.VERSION.SDK_INT >= 33 &&
            c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, "Günlük tablo", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Hafta içi güncel tabloyu WhatsApp'ta gönderme hatırlatması"
            }
        )
        val open = Intent(c, MainActivity::class.java)
            .setAction(Intent.ACTION_MAIN)
            .putExtra(EXTRA_EYLEM, "tabloGonder")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(c, 2, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_tablo)
            .setContentTitle("Güncel donör tablosu")
            .setContentText("WhatsApp’ta göndermek için dokunun")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()
        nm.notify(NOTIF_ID, n)
    }
}

class HatirlatmaReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Hatirlatma.fire(context)
    }
}

/** Telefon yeniden başlayınca ya da uygulama güncellenince hatırlatma yeniden kurulur */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> Hatirlatma.schedule(context)
        }
    }
}
