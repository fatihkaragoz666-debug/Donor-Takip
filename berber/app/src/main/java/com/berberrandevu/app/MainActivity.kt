package com.berberrandevu.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private var dosyaGeriDonus: ValueCallback<Array<Uri>>? = null

    private val dosyaSecici = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        dosyaGeriDonus?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        dosyaGeriDonus = null
    }

    private val bildirimIzni = registerForActivityResult(ActivityResultContracts.RequestPermission()) { _: Boolean -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Hatirlatici.kanalOlustur(this)

        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.textZoom = web.settings.textZoom.coerceAtMost(120)
        web.addJavascriptInterface(Kopru(), "AndroidBridge")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("file:///android_asset/")) return false
                disAc(url)
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: WebChromeClient.FileChooserParams?
            ): Boolean {
                dosyaGeriDonus?.onReceiveValue(null)
                dosyaGeriDonus = filePathCallback
                return try {
                    dosyaSecici.launch("*/*")
                    true
                } catch (e: ActivityNotFoundException) {
                    dosyaGeriDonus = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.geriTus && window.geriTus()) ? 'evet' : 'hayir'") { sonuc ->
                    if (sonuc == null || !sonuc.contains("evet")) finish()
                }
            }
        })

        web.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onResume() {
        super.onResume()
        if (::web.isInitialized) web.evaluateJavascript("window.zamanTiki && window.zamanTiki()", null)
    }

    private fun disAc(url: String) {
        try {
            val niyet = if (url.startsWith("tel:")) Intent(Intent.ACTION_DIAL, Uri.parse(url))
            else Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(niyet)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "Bunu açacak uygulama bulunamadı", Toast.LENGTH_SHORT).show()
        }
    }

    private fun izinIste() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            bildirimIzni.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    /** Web sayfasının çağırdığı telefon işlevleri. */
    inner class Kopru {
        private val veriDosyasi get() = File(filesDir, "veri.json")

        @JavascriptInterface
        fun loadData(): String {
            return try {
                if (veriDosyasi.exists()) veriDosyasi.readText() else ""
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun saveData(json: String): Boolean {
            return try {
                val gecici = File(filesDir, "veri.json.tmp")
                gecici.writeText(json)
                if (!gecici.renameTo(veriDosyasi)) {
                    veriDosyasi.writeText(json)
                    gecici.delete()
                }
                true
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun setReminders(json: String) {
            Hatirlatici.planla(this@MainActivity, json)
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread { izinIste() }
        }

        @JavascriptInterface
        fun openUrl(url: String) {
            runOnUiThread { disAc(url) }
        }

        @JavascriptInterface
        fun saveFile(ad: String, base64: String, mime: String): String {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return ""
            return try {
                val veri = Base64.decode(base64, Base64.DEFAULT)
                val degerler = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, ad)
                    put(MediaStore.MediaColumns.MIME_TYPE, mime)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BerberRandevu")
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, degerler) ?: return ""
                val akis = contentResolver.openOutputStream(uri) ?: return ""
                akis.use { it.write(veri) }
                "İndirilenler › BerberRandevu klasörüne kaydedildi"
            } catch (e: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun shareFile(ad: String, base64: String, mime: String) {
            try {
                val klasor = File(cacheDir, "paylas")
                klasor.mkdirs()
                val dosya = File(klasor, ad)
                dosya.writeBytes(Base64.decode(base64, Base64.DEFAULT))
                val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.dosyalar", dosya)
                val gonder = Intent(Intent.ACTION_SEND).apply {
                    type = mime
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread { startActivity(Intent.createChooser(gonder, "Paylaş")) }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this@MainActivity, "Paylaşılamadı", Toast.LENGTH_SHORT).show() }
            }
        }

        @JavascriptInterface
        fun version(): String {
            return try {
                packageManager.getPackageInfo(packageName, 0).versionName ?: ""
            } catch (e: Exception) {
                ""
            }
        }
    }
}
