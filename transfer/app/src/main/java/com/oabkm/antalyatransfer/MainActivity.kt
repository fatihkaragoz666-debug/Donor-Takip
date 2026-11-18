package com.oabkm.antalyatransfer

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File

/**
 * Antalya Transfer: uygulamanın tamamı assets/www içindeki HTML/JS dosyalarıdır.
 * Bu sınıf onları bir WebView'da açar; kayıtları telefonun kendi dosya alanına yazar,
 * Excel seçme/kaydetme/paylaşma, WhatsApp, pano ve bildirim işlerini yapar.
 * İnternet izni yoktur: veriler yalnızca bu telefonda tutulur.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSaveBytes: ByteArray? = null
    private var pendingJs: String? = null
    private var pageReady = false
    private var insetTop = 0
    private var insetBottom = 0
    private var izinIstendi = false

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    private val openFileLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            val uri = result.data?.data
            if (result.resultCode == RESULT_OK && uri != null) callback?.onReceiveValue(arrayOf(uri))
            else callback?.onReceiveValue(null)
        }

    private val createFileLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val bytes = pendingSaveBytes
            pendingSaveBytes = null
            val uri = result.data?.data
            var ok = false
            if (result.resultCode == RESULT_OK && uri != null && bytes != null) {
                ok = try {
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                    true
                } catch (e: Exception) {
                    false
                }
            }
            webView.evaluateJavascript("window.onNativeFileSaved && window.onNativeFileSaved($ok)", null)
        }

    private val notifPermLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            webView.evaluateJavascript("window.onNotifPermission && window.onNotifPermission($granted)", null)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#A8102A"))
        webView = WebView(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        setContentView(root)

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, 0, bars.right, if (imeVisible) ime.bottom else 0)
            val density = resources.displayMetrics.density
            insetTop = (bars.top / density).toInt()
            insetBottom = if (imeVisible) 0 else (bars.bottom / density).toInt()
            pushInsets()
            insets
        }

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            cacheMode = WebSettings.LOAD_NO_CACHE
            textZoom = 100
        }
        webView.addJavascriptInterface(Bridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == APP_HOST) return false
                val intent = if (url.scheme == "tel") Intent(Intent.ACTION_DIAL, url) else Intent(Intent.ACTION_VIEW, url)
                try {
                    startActivity(intent)
                } catch (e: ActivityNotFoundException) {
                    toast("Bu bağlantıyı açacak uygulama bulunamadı")
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                pushInsets()
                deliver()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(
                        Intent.EXTRA_MIME_TYPES, arrayOf(
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "application/vnd.ms-excel",
                            "application/json",
                            "application/octet-stream",
                            "text/plain"
                        )
                    )
                }
                return try {
                    openFileLauncher.launch(intent)
                    true
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    toast("Dosya seçici açılamadı")
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("!!(window.handleBack && window.handleBack())") { handled ->
                    if (handled != "true") finish()
                }
            }
        })

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl("https://$APP_HOST/assets/www/index.html")
        }
        handleIncoming(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncoming(intent)
    }

    /** Bildirime dokununca ilgili saat grubu açılır */
    private fun handleIncoming(intent: Intent?) {
        if (intent == null) return
        val hedef = intent.getStringExtra(Hatirlatici.EXTRA_HEDEF) ?: return
        intent.removeExtra(Hatirlatici.EXTRA_HEDEF)
        pendingJs = "window.onNativeAction && window.onNativeAction(${JSONObject.quote(hedef)})"
        deliver()
    }

    private fun deliver() {
        val js = pendingJs
        if (!pageReady || js == null) return
        pendingJs = null
        webView.evaluateJavascript(js, null)
    }

    override fun onResume() {
        super.onResume()
        if (pageReady) webView.evaluateJavascript("window.onNativeResume && window.onNativeResume()", null)
    }

    override fun onPause() {
        // Bekleyen kayıtlar hemen diske yazılır
        if (pageReady) webView.evaluateJavascript("window.flushNow && window.flushNow()", null)
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
        super.onDestroy()
    }

    private fun pushInsets() {
        if (::webView.isInitialized) {
            webView.evaluateJavascript("window.setInsets && window.setInsets($insetTop, $insetBottom)", null)
        }
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private fun safeName(name: String): String =
        name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "dosya" }

    private fun dataDir(): File = File(filesDir, "kayitlar").apply { mkdirs() }

    private fun installedPackage(vararg packages: String): String? = packages.firstOrNull { pkg ->
        try {
            packageManager.getPackageInfo(pkg, 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Sayfadaki JavaScript'in çağırdığı Android işlevleri (window.AndroidBridge) */
    inner class Bridge {

        /** Kayıtlar: kisiler / seferler / meta → filesDir/kayitlar/<ad>.json */
        @JavascriptInterface
        fun loadData(name: String): String {
            val f = File(dataDir(), safeName(name) + ".json")
            val b = File(dataDir(), safeName(name) + ".bak")
            return try {
                when {
                    f.exists() -> f.readText(Charsets.UTF_8)
                    b.exists() -> b.readText(Charsets.UTF_8)
                    else -> ""
                }
            } catch (e: Exception) {
                try {
                    if (b.exists()) b.readText(Charsets.UTF_8) else ""
                } catch (e2: Exception) {
                    ""
                }
            }
        }

        /** Önce geçici dosyaya yazılır, sonra eskisi .bak olur ve yenisi yerine geçer (yarım kayıt olmaz). */
        @JavascriptInterface
        fun saveData(name: String, json: String): Boolean = try {
            val dir = dataDir()
            val base = safeName(name)
            val tmp = File(dir, "$base.tmp")
            val f = File(dir, "$base.json")
            val b = File(dir, "$base.bak")
            tmp.outputStream().use { out ->
                out.write(json.toByteArray(Charsets.UTF_8))
                out.fd.sync()
            }
            if (f.exists()) {
                b.delete()
                f.renameTo(b)
            }
            tmp.renameTo(f)
        } catch (e: Exception) {
            false
        }

        @JavascriptInterface
        fun saveFile(base64: String, fileName: String, mimeType: String) {
            val bytes = try {
                Base64.decode(base64, Base64.DEFAULT)
            } catch (e: IllegalArgumentException) {
                null
            }
            runOnUiThread {
                if (bytes == null) {
                    webView.evaluateJavascript("window.onNativeFileSaved && window.onNativeFileSaved(false)", null)
                    return@runOnUiThread
                }
                pendingSaveBytes = bytes
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                    putExtra(Intent.EXTRA_TITLE, safeName(fileName))
                }
                try {
                    createFileLauncher.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    pendingSaveBytes = null
                    toast("Dosya kaydedilemedi")
                }
            }
        }

        /** target: whatsapp | share */
        @JavascriptInterface
        fun shareFile(base64: String, fileName: String, mimeType: String, text: String, target: String) {
            val bytes = try {
                Base64.decode(base64, Base64.DEFAULT)
            } catch (e: IllegalArgumentException) {
                null
            }
            runOnUiThread {
                if (bytes == null) {
                    toast("Dosya hazırlanamadı")
                    return@runOnUiThread
                }
                try {
                    val dir = File(cacheDir, "paylas")
                    dir.mkdirs()
                    val file = File(dir, safeName(fileName))
                    file.writeBytes(bytes)
                    val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = mimeType
                        putExtra(Intent.EXTRA_STREAM, uri)
                        if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
                        clipData = ClipData.newRawUri(file.name, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    val wa = if (target == "whatsapp") installedPackage("com.whatsapp", "com.whatsapp.w4b") else null
                    if (wa != null) {
                        try {
                            startActivity(Intent(send).setPackage(wa))
                            return@runOnUiThread
                        } catch (e: ActivityNotFoundException) {
                            // seçiciye düş
                        }
                    }
                    startActivity(Intent.createChooser(send, "Paylaş"))
                } catch (e: Exception) {
                    toast("Dosya paylaşılamadı")
                }
            }
        }

        @JavascriptInterface
        fun shareText(text: String) {
            runOnUiThread {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startActivity(Intent.createChooser(send, "Paylaş"))
            }
        }

        @JavascriptInterface
        fun shareWhatsApp(text: String) {
            runOnUiThread {
                val wa = installedPackage("com.whatsapp", "com.whatsapp.w4b")
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    if (wa != null) setPackage(wa)
                }
                try {
                    startActivity(if (wa != null) send else Intent.createChooser(send, "Paylaş"))
                } catch (e: ActivityNotFoundException) {
                    startActivity(Intent.createChooser(send.setPackage(null), "Paylaş"))
                }
            }
        }

        @JavascriptInterface
        fun copyText(text: String) {
            runOnUiThread {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Antalya Transfer", text))
            }
        }

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread { this@MainActivity.toast(message) }
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        /** Uyarı listesi: [{at, title, text, nid, hedef}] — öncekiler iptal edilip yenileri kurulur */
        @JavascriptInterface
        fun setReminders(json: String) {
            Hatirlatici.save(this@MainActivity, json)
            val dolu = json.length > 2
            if (dolu && !izinIstendi && Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                izinIstendi = true
                runOnUiThread { notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
            }
        }

        @JavascriptInterface
        fun reminderStatus(): String = Hatirlatici.durum(this@MainActivity)

        /** Bir dakika sonra deneme bildirimi */
        @JavascriptInterface
        fun testReminder() {
            if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                runOnUiThread { notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
            }
            Hatirlatici.dene(this@MainActivity)
        }

        /** Telefon ayarları: bildirim | alarm | pil | uygulama */
        @JavascriptInterface
        fun openSettings(ne: String) {
            runOnUiThread { telefonAyari(ne) }
        }
    }

    @SuppressLint("BatteryLife")
    private fun telefonAyari(ne: String) {
        val paket = Uri.parse("package:$packageName")
        val intent = when (ne) {
            "bildirim" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            "alarm" -> if (Build.VERSION.SDK_INT >= 31) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, paket) else null
            "pil" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, paket)
            else -> null
        } ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paket)
        try {
            startActivity(intent)
        } catch (e: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, paket))
            } catch (e2: Exception) {
                toast("Ayarlar açılamadı")
            }
        }
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
    }
}
