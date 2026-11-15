package com.oabkm.donortakip

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
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
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.File

/**
 * Donör Takip: uygulamanın tamamı assets/www içindeki HTML/JS dosyalarıdır.
 * Bu sınıf onları bir WebView'da açar ve dosya seçme, dosya kaydetme, paylaşma,
 * panoya kopyalama ve telefon araması gibi Android işlevlerini sağlar.
 * Veriler WebView'ın yerel depolamasında (yalnızca bu telefonda) tutulur; internet izni yoktur.
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSaveBytes: ByteArray? = null
    private var sharedUri: Uri? = null
    private var sharedName = "dosya"
    private var sharedMime = "application/octet-stream"
    private var pendingJs: String? = null
    private var pageReady = false
    private var insetTop = 0
    private var insetBottom = 0

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/paylasilan/", SharedFileHandler())
            .build()
    }

    /** Excel / yedek dosyası seçimi (<input type="file">) */
    private val openFileLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            val uri = result.data?.data
            if (result.resultCode == RESULT_OK && uri != null) {
                callback?.onReceiveValue(arrayOf(uri))
            } else {
                callback?.onReceiveValue(null)
            }
        }

    /** Dışa aktarılan Excel / yedek dosyasının kaydedileceği yer */
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

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        )
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        root.setBackgroundColor(Color.parseColor("#0F4C5C"))
        webView = WebView(this)
        root.addView(
            webView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        setContentView(root)

        // Sistem çubukları: üst/alt boşluklar sayfaya CSS değişkeni olarak verilir; klavye açıkken WebView küçülür.
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
            mediaPlaybackRequiresUserGesture = true
        }
        webView.addJavascriptInterface(Bridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == APP_HOST) return false
                // tel:, https://wa.me vb. bağlantılar telefondaki uygulamalarla açılır
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
                deliverShared()
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
                            "application/pdf",
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

        // Geri tuşu: önce açık pencereyi kapat, sonra sayfa geçmişinde geri git, en sonda uygulamadan çık.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("!!(window.handleBack && window.handleBack())") { handled ->
                    if (handled != "true") {
                        if (webView.canGoBack()) webView.goBack() else finish()
                    }
                }
            }
        })

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl("https://$APP_HOST/assets/www/index.html")
        }
        if (savedInstanceState == null) handleIncoming(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncoming(intent)
    }

    /** Outlook vb. uygulamalardan paylaşılan dosya ya da mail metni ("Paylaş", "Birlikte aç", seçili metin menüsü) */
    private fun handleIncoming(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            Intent.ACTION_PROCESS_TEXT -> {
                val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString() ?: return
                sendText("", text)
                return
            }
            Intent.ACTION_SEND -> {
                val stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                if (stream == null) {
                    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString() ?: return
                    sendText(intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: "", text)
                    return
                }
                receiveFile(stream, intent.type)
            }
            Intent.ACTION_VIEW -> receiveFile(intent.data ?: return, intent.type)
        }
    }

    private fun sendText(subject: String, text: String) {
        pendingJs = "window.receiveSharedText && window.receiveSharedText(${JSONObject.quote(subject)}, ${JSONObject.quote(text)})"
        deliverShared()
    }

    private fun receiveFile(uri: Uri, type: String?) {
        var name = "dosya"
        try {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (i >= 0) name = c.getString(i) ?: name
                }
            }
        } catch (e: Exception) {
            // ad okunamazsa varsayılan kalır
        }
        sharedUri = uri
        sharedName = name
        sharedMime = type ?: contentResolver.getType(uri) ?: "application/octet-stream"
        pendingJs = "window.receiveSharedFile && window.receiveSharedFile(${JSONObject.quote(sharedName)}, ${JSONObject.quote(sharedMime)})"
        deliverShared()
    }

    private fun deliverShared() {
        val js = pendingJs
        if (!pageReady || js == null) return
        pendingJs = null
        webView.evaluateJavascript(js, null)
    }

    /** Sayfa paylaşılan dosyayı https://appassets.androidplatform.net/paylasilan/… adresinden okur */
    inner class SharedFileHandler : WebViewAssetLoader.PathHandler {
        override fun handle(path: String): WebResourceResponse? {
            val uri = sharedUri ?: return null
            return try {
                val stream = contentResolver.openInputStream(uri) ?: return null
                WebResourceResponse(sharedMime, null, stream)
            } catch (e: Exception) {
                null
            }
        }
    }

    private fun installedPackage(vararg packages: String): String? = packages.firstOrNull { pkg ->
        try {
            packageManager.getPackageInfo(pkg, 0)
            true
        } catch (e: Exception) {
            false
        }
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

    /** Sayfadaki JavaScript'in çağırdığı Android işlevleri (window.AndroidBridge) */
    inner class Bridge {
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
                val packages = listOf("com.whatsapp", "com.whatsapp.w4b")
                val installed = packages.firstOrNull { pkg ->
                    try {
                        packageManager.getPackageInfo(pkg, 0)
                        true
                    } catch (e: Exception) {
                        false
                    }
                }
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, text)
                    if (installed != null) setPackage(installed)
                }
                try {
                    startActivity(if (installed != null) send else Intent.createChooser(send, "Paylaş"))
                } catch (e: ActivityNotFoundException) {
                    startActivity(Intent.createChooser(send.setPackage(null), "Paylaş"))
                }
            }
        }

        /** E-posta: Outlook kuruluysa doğrudan Outlook açılır */
        @JavascriptInterface
        fun shareEmail(subject: String, text: String) {
            runOnUiThread {
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, subject)
                    putExtra(Intent.EXTRA_TEXT, text)
                }
                startShare(send)
            }
        }

        /** Dosyayı (ör. Donör Raporu .xlsx) e-postaya ekleyerek gönder */
        @JavascriptInterface
        fun shareFile(base64: String, fileName: String, mimeType: String, subject: String, text: String) {
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
                    val file = File(dir, fileName.replace(Regex("[\\\\/:*?\"<>|]"), "_"))
                    file.writeBytes(bytes)
                    val uri = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", file)
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = mimeType
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_SUBJECT, subject)
                        putExtra(Intent.EXTRA_TEXT, text)
                        clipData = ClipData.newRawUri(fileName, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startShare(send)
                } catch (e: Exception) {
                    toast("Dosya paylaşılamadı")
                }
            }
        }

        @JavascriptInterface
        fun hasOutlook(): Boolean = installedPackage(OUTLOOK) != null

        @JavascriptInterface
        fun copyText(text: String) {
            runOnUiThread {
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Donör Takip", text))
            }
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
                    putExtra(Intent.EXTRA_TITLE, fileName)
                }
                try {
                    createFileLauncher.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    pendingSaveBytes = null
                    toast("Dosya kaydedilemedi")
                }
            }
        }

        @JavascriptInterface
        fun toast(message: String) {
            runOnUiThread { this@MainActivity.toast(message) }
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME
    }

    private fun startShare(send: Intent) {
        val outlook = installedPackage(OUTLOOK)
        if (outlook != null) {
            try {
                startActivity(Intent(send).setPackage(outlook))
                return
            } catch (e: ActivityNotFoundException) {
                // seçiciye düş
            }
        }
        startActivity(Intent.createChooser(send, "E-posta ile gönder"))
    }

    companion object {
        private const val OUTLOOK = "com.microsoft.office.outlook"
        /** WebViewAssetLoader'ın varsayılan alan adı: sayfa güvenli (https) kökenden yüklenir. */
        private const val APP_HOST = "appassets.androidplatform.net"
    }
}
