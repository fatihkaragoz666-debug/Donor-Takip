package com.berberrandevu.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray

/** Randevudan önce gelen bildirimleri kurar. Liste telefonda saklanır, telefon yeniden açılınca tekrar kurulur. */
object Hatirlatici {
    private const val KANAL = "randevu"
    private const val TERCIH = "hatirlatici"
    private const val ANAHTAR = "liste"
    private const val EYLEM = "com.berberrandevu.app.HATIRLAT"

    fun kanalOlustur(ctx: Context) {
        val kanal = NotificationChannel(KANAL, "Randevu hatırlatmaları", NotificationManager.IMPORTANCE_HIGH)
        kanal.description = "Randevu saatinden önce gelen bildirimler"
        ctx.getSystemService(NotificationManager::class.java)?.createNotificationChannel(kanal)
    }

    @Synchronized
    fun planla(ctx: Context, json: String) {
        val tercih = ctx.getSharedPreferences(TERCIH, Context.MODE_PRIVATE)
        iptalEt(ctx, tercih.getString(ANAHTAR, "[]") ?: "[]")
        tercih.edit().putString(ANAHTAR, json).apply()
        kur(ctx, json)
    }

    @Synchronized
    fun yenidenKur(ctx: Context) {
        val json = ctx.getSharedPreferences(TERCIH, Context.MODE_PRIVATE).getString(ANAHTAR, "[]") ?: "[]"
        kur(ctx, json)
    }

    private fun niyet(ctx: Context, no: Int, baslik: String, metin: String): PendingIntent {
        val i = Intent(ctx, HatirlaticiAlici::class.java).apply {
            action = EYLEM
            putExtra("no", no)
            putExtra("baslik", baslik)
            putExtra("metin", metin)
        }
        return PendingIntent.getBroadcast(ctx, no, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun iptalEt(ctx: Context, json: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        try {
            val dizi = JSONArray(json)
            for (i in 0 until dizi.length()) {
                val o = dizi.getJSONObject(i)
                am.cancel(niyet(ctx, o.getInt("no"), "", ""))
            }
        } catch (e: Exception) {
            // bozuk liste: yok say
        }
    }

    private fun kur(ctx: Context, json: String) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val simdi = System.currentTimeMillis()
        val tam = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.canScheduleExactAlarms() else true
        val dizi = try { JSONArray(json) } catch (e: Exception) { return }
        for (i in 0 until dizi.length()) {
            try {
                val o = dizi.getJSONObject(i)
                val zaman = o.getLong("zaman")
                if (zaman <= simdi) continue
                val pi = niyet(ctx, o.getInt("no"), o.optString("baslik"), o.optString("metin"))
                if (tam) {
                    try {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi)
                    } catch (e: SecurityException) {
                        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi)
                    }
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, zaman, pi)
                }
            } catch (e: Exception) {
                // tek kayıt hatası diğerlerini durdurmasın
            }
        }
    }

    fun goster(ctx: Context, no: Int, baslik: String, metin: String) {
        val ac = Intent(ctx, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(ctx, no, ac, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val bildirim = NotificationCompat.Builder(ctx, KANAL)
            .setSmallIcon(R.drawable.ic_bildirim)
            .setColor(0xFFB8894A.toInt())
            .setContentTitle(baslik)
            .setContentText(metin)
            .setStyle(NotificationCompat.BigTextStyle().bigText(metin))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(no, bildirim)
        } catch (e: SecurityException) {
            // bildirim izni verilmemiş
        }
    }
}

/** Zamanı gelen hatırlatmayı bildirim olarak gösterir. */
class HatirlaticiAlici : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Hatirlatici.goster(
            ctx,
            intent.getIntExtra("no", 1),
            intent.getStringExtra("baslik") ?: "Randevu",
            intent.getStringExtra("metin") ?: ""
        )
    }
}

/** Telefon yeniden başlayınca ya da uygulama güncellenince hatırlatmaları yeniden kurar. */
class AcilisAlici : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Hatirlatici.yenidenKur(ctx)
        }
    }
}
