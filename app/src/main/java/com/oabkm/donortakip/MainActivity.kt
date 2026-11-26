package com.oabkm.donortakip

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Rect
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
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
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

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
    private var pendingSaveFile: File? = null
    private var bigFile: File? = null
    private var bigStream: FileOutputStream? = null
    /** Son paylaşılan dosyanın bilgileri (mime, konu, metin, numara): yeniden paylaşmak için */
    private var sonPaylas: Array<String>? = null
    /** Son dosya hatası (gönderim bilgisi ve hata penceresi için) */
    @Volatile private var sonHata = ""
    private var sharedUri: Uri? = null
    private var sharedName = "dosya"
    private var sharedMime = "application/octet-stream"
    private var pendingJs: String? = null
    /** Sayfa hazır olmadan gelen ekran görüntüsü okuma sonuçları */
    private val bekleyenJs = ArrayList<String>()
    private var ocrTanima: TextRecognizer? = null
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
            val file = pendingSaveFile
            pendingSaveBytes = null
            pendingSaveFile = null
            val uri = result.data?.data
            var ok = false
            if (result.resultCode == RESULT_OK && uri != null && (bytes != null || file != null)) {
                ok = try {
                    contentResolver.openOutputStream(uri)?.use { out ->
                        if (bytes != null) out.write(bytes) else file?.inputStream()?.use { it.copyTo(out) }
                    }
                    true
                } catch (e: Exception) {
                    false
                }
            }
            webView.evaluateJavascript("window.onNativeFileSaved && window.onNativeFileSaved($ok)", null)
        }

    /** Ekran görüntüsü seçimi (galeri): mesai saatleri okunur */
    private val ocrSecici =
        registerForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { uris ->
            if (uris.isNotEmpty()) ocrCalistir(uris)
        }

    /** Android 13+ bildirim izni (hafta içi tablo hatırlatması için) */
    private val notifPermLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            webView.evaluateJavascript("window.onNotifPermission && window.onNotifPermission($granted)", null)
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        internetsizGuvence()
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
                            "text/plain",
                            "application/zip",
                            "application/x-zip-compressed"
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
        val eylem = intent.getStringExtra(Hatirlatma.EXTRA_EYLEM)
        if (eylem != null) {
            intent.removeExtra(Hatirlatma.EXTRA_EYLEM)
            pendingJs = "window.onNativeAction && window.onNativeAction(${JSONObject.quote(eylem)})"
            deliverShared()
            return
        }
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
                // Ekran görüntüsü: yazısı telefonda okunur, mesai saatleri sayfaya verilir
                if (gorselMi(intent.type, stream)) {
                    ocrCalistir(listOf(stream))
                    return
                }
                receiveFile(stream, intent.type)
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                val list = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) ?: return
                val gorseller = list.filter { gorselMi(intent.type, it) }
                if (gorseller.isNotEmpty()) ocrCalistir(gorseller.take(10))
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
        if (!pageReady) return
        val js = pendingJs
        if (js != null) {
            pendingJs = null
            webView.evaluateJavascript(js, null)
        }
        if (bekleyenJs.isNotEmpty()) {
            val liste = ArrayList(bekleyenJs)
            bekleyenJs.clear()
            liste.forEach { webView.evaluateJavascript(it, null) }
        }
    }

    /** Sayfa hazırsa hemen, değilse yüklenince çalıştırılır (ana iş parçacığında çağrılır) */
    private fun jsGonder(js: String) {
        if (isDestroyed) return
        if (pageReady) webView.evaluateJavascript(js, null) else bekleyenJs.add(js)
    }

    private fun gorselMi(type: String?, uri: Uri): Boolean {
        val t = type ?: ""
        if (t.startsWith("image/")) return true
        if (t.isNotEmpty() && t != "*/*" && t != "application/octet-stream") return false
        return (contentResolver.getType(uri) ?: "").startsWith("image/")
    }

    // ---------------- Ekran görüntüsünden yazı okuma (ML Kit, telefonda; internet gerekmez) ----------------
    private fun tanima(): TextRecognizer =
        ocrTanima ?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also { ocrTanima = it }

    /** Görselleri sırayla okur; sonuç: window.receiveOcr('[{ ad, zaman, w, h, satirlar: [{ t, x, y, w, h, e: [...] }] }]') */
    private fun ocrCalistir(uris: List<Uri>) {
        jsGonder("window.ocrBasladi && window.ocrBasladi(${uris.size})")
        val tanima = tanima()
        Thread {
            val sonuc = JSONArray()
            uris.forEachIndexed { i, uri ->
                if (i > 0) runOnUiThread { jsGonder("window.ocrIlerleme && window.ocrIlerleme(${i + 1}, ${uris.size})") }
                sonuc.put(ocrOku(tanima, uri))
            }
            val js = "window.receiveOcr && window.receiveOcr(" + JSONObject.quote(sonuc.toString()) + ")"
            runOnUiThread { jsGonder(js) }
        }.start()
    }

    private fun ocrOku(tanima: TextRecognizer, uri: Uri): JSONObject {
        val o = JSONObject()
        val bilgi = gorselBilgisi(uri)
        o.put("ad", bilgi.first).put("zaman", bilgi.second)
        try {
            val image = InputImage.fromFilePath(this, uri)
            val donuk = image.rotationDegrees == 90 || image.rotationDegrees == 270
            o.put("w", if (donuk) image.height else image.width).put("h", if (donuk) image.width else image.height)
            val text = Tasks.await(tanima.process(image), 60, TimeUnit.SECONDS)
            val satirlar = JSONArray()
            for (blok in text.textBlocks) {
                for (satir in blok.lines) {
                    val kutu = satir.boundingBox ?: continue
                    val parcalar = JSONArray()
                    for (el in satir.elements) {
                        val k = el.boundingBox ?: continue
                        parcalar.put(kutuJson(el.text, k))
                    }
                    satirlar.put(kutuJson(satir.text, kutu).put("e", parcalar))
                }
            }
            o.put("satirlar", satirlar)
        } catch (e: Exception) {
            o.put("hata", hataYazi(e))
        } catch (e: OutOfMemoryError) {
            o.put("hata", "Görsel çok büyük")
        }
        return o
    }

    private fun kutuJson(t: String, r: Rect): JSONObject =
        JSONObject().put("t", t).put("x", r.left).put("y", r.top).put("w", r.width()).put("h", r.height())

    /** Görselin adı (Screenshot_20261126-184012…) ve çekildiği an (ms; bilinmiyorsa 0) */
    private fun gorselBilgisi(uri: Uri): Pair<String, Long> {
        var ad = "ekran görüntüsü"
        var zaman = 0L
        try {
            contentResolver.query(uri, null, null, null, null)?.use { c ->
                if (c.moveToFirst()) {
                    val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (i >= 0 && !c.isNull(i)) ad = c.getString(i) ?: ad
                    for (k in arrayOf("datetaken", "last_modified", "date_modified", "date_added")) {
                        val j = c.getColumnIndex(k)
                        if (j < 0 || c.isNull(j)) continue
                        var v = c.getLong(j)
                        if (v in 1L..99_999_999_999L) v *= 1000L
                        if (v > 0L) {
                            zaman = v
                            break
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // ad ve zaman okunamazsa varsayılanlar kalır
        }
        return Pair(ad, zaman)
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

    override fun onPause() {
        super.onPause()
        if (waVerildi > 0L && waDurakladi == 0L) waDurakladi = System.currentTimeMillis()
    }

    override fun onResume() {
        super.onResume()
        // WhatsApp açılır açılmaz kapandıysa (tabloyu almadıysa) sayfaya bildir
        if (waVerildi > 0L && waDurakladi > 0L && System.currentTimeMillis() - waDurakladi < 2500L) waKontrol(true)
        // Ayarlar'dan (bildirim, alarm, pil) dönünce durum satırları yenilenir
        if (pageReady) webView.evaluateJavascript("window.onNativeResume && window.onNativeResume()", null)
    }

    // WhatsApp gerçekten öne geldi mi: verildikten sonra ekranımız duraklamalı ve hemen geri gelmemeli.
    // Bazı telefonlarda WhatsApp (özellikle numaranın sohbetine açarken) paylaşımı sessizce kapatıyor.
    private var waVerildi = 0L
    private var waDurakladi = 0L
    private var waAciklama = ""
    private val waKontrolR = Runnable { waKontrol(false) }

    private fun waIzle(aciklama: String) {
        waVerildi = System.currentTimeMillis()
        waDurakladi = 0L
        waAciklama = aciklama
        webView.removeCallbacks(waKontrolR)
        webView.postDelayed(waKontrolR, 3500L)
    }

    private fun waKontrol(dondu: Boolean) {
        if (waVerildi == 0L) return
        val tamam = !dondu && waDurakladi > 0L
        val mesaj = when {
            tamam -> "WhatsApp açıldı"
            dondu -> "WhatsApp tabloyu almadan hemen kapandı"
            else -> "WhatsApp öne gelmedi"
        }
        waVerildi = 0L
        webView.removeCallbacks(waKontrolR)
        sonucBildir("whatsappKontrol", tamam, "$mesaj · $waAciklama")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        try {
            ocrTanima?.close()
        } catch (e: Exception) {
            // kapanırken hata önemsiz
        }
        ocrTanima = null
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

        /** Büyük dosya (güncel tablo) parça parça yazılır: fileBegin → fileAppend… → fileFinish */
        @JavascriptInterface
        fun fileBegin(fileName: String): Boolean = try {
            sonHata = ""
            bigStream?.close()
            val dir = File(cacheDir, "paylas")
            dir.mkdirs()
            val eski = System.currentTimeMillis() - 60 * 60 * 1000L
            dir.listFiles()?.forEach { if (it.lastModified() < eski) it.delete() }
            val f = File(dir, safeName(fileName))
            bigFile = f
            bigStream = FileOutputStream(f)
            true
        } catch (e: Exception) {
            sonHata = hataYazi(e)
            false
        }

        @JavascriptInterface
        fun fileAppend(base64: String): Boolean = try {
            bigStream?.write(Base64.decode(base64, Base64.DEFAULT))
            if (bigStream == null) sonHata = "Dosya açık değil"
            bigStream != null
        } catch (e: Exception) {
            sonHata = hataYazi(e)
            false
        }

        @JavascriptInterface
        fun sonHata(): String = sonHata

        /** Son hazırlanan dosyayı yeniden paylaşır (tablo yeniden hazırlanmaz): "whatsapp:secici", "save" … */
        @JavascriptInterface
        fun sonDosyayiPaylas(target: String) {
            val f = bigFile
            val p = sonPaylas
            if (f == null || p == null || !f.exists()) {
                sonucBildir(target, false, "Hazır dosya yok; tabloyu yeniden gönderin")
                return
            }
            runOnUiThread { paylas(f, target, p[0], p[1], p[2], p[3]) }
        }

        /** Telefondaki WhatsApp uygulamaları: [{paket, ad, surum, etkin}] */
        @JavascriptInterface
        fun whatsappUygulamalari(): String {
            val a = JSONArray()
            for (p in listOf("com.whatsapp", "com.whatsapp.w4b")) {
                try {
                    val info = packageManager.getPackageInfo(p, 0)
                    val etkin = info.applicationInfo?.enabled ?: true
                    a.put(JSONObject().put("paket", p).put("ad", waAd(p)).put("surum", info.versionName ?: "").put("etkin", etkin))
                } catch (e: Exception) {
                    // yüklü değil
                }
            }
            return a.toString()
        }

        /** Gönderim bilgisi: Android, cihaz, WebView, boş alan */
        @JavascriptInterface
        fun cihazBilgisi(): String {
            val wv = try {
                WebViewCompat.getCurrentWebViewPackage(this@MainActivity)?.let { (it.packageName ?: "") + " " + (it.versionName ?: "") } ?: ""
            } catch (e: Exception) {
                ""
            }
            return JSONObject()
                .put("android", Build.VERSION.RELEASE ?: "")
                .put("sdk", Build.VERSION.SDK_INT)
                .put("cihaz", ((Build.MANUFACTURER ?: "") + " " + (Build.MODEL ?: "")).trim())
                .put("webview", wv)
                .put("bosMB", cacheDir.usableSpace / 1048576L)
                .toString()
        }

        /** target: whatsapp | email | save | share | open */
        @JavascriptInterface
        fun fileFinish(target: String, mimeType: String, subject: String, text: String, phone: String) {
            try {
                bigStream?.close()
            } catch (e: Exception) {
                sonHata = hataYazi(e)
            }
            bigStream = null
            val f = bigFile
            if (f == null) {
                sonucBildir(target, false, "Dosya bulunamadı" + if (sonHata.isNotEmpty()) " ($sonHata)" else "")
                return
            }
            sonPaylas = arrayOf(mimeType, subject, text, phone)
            runOnUiThread { paylas(f, target, mimeType, subject, text, phone) }
        }

        /** Günlük hatırlatma: {on, saat, dakika, tatil:"yyyy-MM-dd,…", hergun} */
        @JavascriptInterface
        fun hatirlatmaKur(json: String) {
            Hatirlatma.save(this@MainActivity, json)
            val on = try { JSONObject(json).optBoolean("on", false) } catch (e: Exception) { false }
            if (on && Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                runOnUiThread { notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
            }
        }

        /** Bildirim, tam saat alarmı, pil kısıtlaması, son çalışma (JSON) */
        @JavascriptInterface
        fun hatirlatmaDurum(): String = Hatirlatma.durum(this@MainActivity)

        /** Bir dakika sonra bir kez dener */
        @JavascriptInterface
        fun hatirlatmaDene() {
            Hatirlatma.dene(this@MainActivity)
        }

        /** Telefon ayarları: bildirim | alarm | pil | uygulama */
        @JavascriptInterface
        fun ayarAc(ne: String) {
            runOnUiThread { telefonAyari(ne) }
        }

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

        /** Galeriden ekran görüntüsü seçtirip yazısını okur (sonuç: window.receiveOcr) */
        @JavascriptInterface
        fun ocrSec(): Boolean {
            runOnUiThread {
                try {
                    ocrSecici.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                } catch (e: Exception) {
                    this@MainActivity.toast("Galeri açılamadı")
                }
            }
            return true
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

    private fun safeName(name: String): String =
        name.replace(Regex("[\\\\/:*?\"<>|]"), "_").ifBlank { "dosya" }

    private fun fileIntent(file: File, mimeType: String, subject: String, text: String): Intent {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        return Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            if (subject.isNotEmpty()) putExtra(Intent.EXTRA_SUBJECT, subject)
            if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
            clipData = ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    /** Raporu telefondaki PDF / Excel uygulamasında açar; açacak uygulama yoksa paylaşım seçicisi */
    private fun openFile(file: File, mimeType: String) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        val view = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType)
            clipData = ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            startActivity(view)
        } catch (e: ActivityNotFoundException) {
            toast("Dosyayı açacak uygulama bulunamadı")
            startActivity(Intent.createChooser(fileIntent(file, mimeType, "", ""), "Paylaş"))
        }
    }

    /** Dosyayı WhatsApp'ta açar; numara verilmişse doğrudan o sohbete gitmeyi dener */
    /**
     * Dosyayı hedefe verir ve sonucu sayfaya bildirir (window.onNativeShare).
     * target: whatsapp | whatsapp:<tercih> (paket, secici, numarasiz; "|" ile birleşebilir) | email | save | share | open
     */
    private fun paylas(f: File, target: String, mimeType: String, subject: String, text: String, phone: String) {
        try {
            val sonuc = when {
                target == "save" -> {
                    pendingSaveFile = f
                    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = mimeType
                        putExtra(Intent.EXTRA_TITLE, f.name)
                    }
                    createFileLauncher.launch(intent)
                    "Kaydetme ekranı açıldı"
                }
                target == "whatsapp" || target.startsWith("whatsapp:") ->
                    shareToWhatsApp(f, mimeType, text, phone, target.substringAfter(':', ""))
                target == "email" -> {
                    startShare(fileIntent(f, mimeType, subject, text))
                    "E-posta açıldı"
                }
                target == "open" -> {
                    openFile(f, mimeType)
                    "Dosya açıldı"
                }
                else -> {
                    startActivity(Intent.createChooser(fileIntent(f, mimeType, subject, text), "Paylaş"))
                    "Paylaş menüsü açıldı"
                }
            }
            sonucBildir(target, true, sonuc + " · " + String.format(java.util.Locale.ROOT, "%.1f MB", f.length() / 1048576.0))
        } catch (e: Exception) {
            sonucBildir(target, false, hataYazi(e))
        }
    }

    private fun sonucBildir(target: String, ok: Boolean, mesaj: String) {
        val js = "window.onNativeShare && window.onNativeShare(" +
            JSONObject().put("target", target).put("ok", ok).put("mesaj", mesaj).toString() + ")"
        runOnUiThread { if (pageReady) webView.evaluateJavascript(js, null) }
    }

    private fun hataYazi(e: Throwable): String = (e.javaClass.simpleName + ": " + (e.message ?: "")).take(300)

    private fun waAd(pkg: String) = if (pkg == "com.whatsapp.w4b") "WhatsApp Business" else "WhatsApp"

    /**
     * Dosyayı WhatsApp'ta açar. tercih ("|" ile birleşebilir): "" (önce WhatsApp, yoksa Business) | paket adı |
     * "secici" (paylaş menüsü) | "numarasiz" (numara verilmiş olsa da sohbet listesiyle).
     * Numara verilmişse doğrudan o sohbete gitmeyi dener; WhatsApp'ın öne gelip gelmediği ayrıca izlenir.
     */
    private fun shareToWhatsApp(file: File, mimeType: String, text: String, phone: String, tercih: String): String {
        val send = fileIntent(file, mimeType, "", text)
        val parca = tercih.split('|')
        if ("secici" in parca) {
            startActivity(Intent.createChooser(send, "Tabloyu gönder"))
            return "Paylaş menüsü açıldı"
        }
        val paket = parca.firstOrNull { it.startsWith("com.") } ?: ""
        val numarasiz = "numarasiz" in parca
        val pkg = (if (paket.isNotEmpty()) installedPackage(paket) else null)
            ?: installedPackage("com.whatsapp", "com.whatsapp.w4b")
        if (pkg == null) {
            startActivity(Intent.createChooser(send, "Paylaş"))
            return "Telefonda WhatsApp bulunamadı; paylaş menüsü açıldı"
        }
        send.setPackage(pkg)
        var digits = phone.filter { it.isDigit() }
        if (digits.startsWith("00")) digits = digits.substring(2)
        if (digits.length == 11 && digits.startsWith("0")) digits = "9$digits"
        if (digits.length == 10 && digits.startsWith("5")) digits = "90$digits"
        val numarali = !numarasiz && digits.length >= 11
        if (numarali) send.putExtra("jid", "$digits@s.whatsapp.net")
        val nasil = if (numarali) "numaranın sohbeti" else "sohbet listesi"
        return try {
            startActivity(send)
            waIzle(waAd(pkg) + " · " + nasil)
            waAd(pkg) + "’a verildi ($nasil)"
        } catch (e: ActivityNotFoundException) {
            startActivity(Intent.createChooser(send.setPackage(null), "Paylaş"))
            waAd(pkg) + " açılamadı; paylaş menüsü açıldı"
        }
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

    /**
     * Uygulamanın internet izni yok. Bir kütüphane arka planda yine de bağlanmaya çalışırsa Android
     * "missing INTERNET permission" hatası verir; bu hata ana iş parçacığı dışındaysa uygulamayı kapatmasın.
     */
    private fun internetsizGuvence() {
        val onceki = Thread.getDefaultUncaughtExceptionHandler()
        if (onceki is InternetsizYakalayici) return
        Thread.setDefaultUncaughtExceptionHandler(InternetsizYakalayici(onceki))
    }

    private class InternetsizYakalayici(private val onceki: Thread.UncaughtExceptionHandler?) : Thread.UncaughtExceptionHandler {
        override fun uncaughtException(t: Thread, e: Throwable) {
            var x: Throwable? = e
            var internet = false
            while (x != null && !internet) {
                internet = x is SecurityException && (x.message ?: "").contains("INTERNET")
                x = x.cause
            }
            if (internet && t !== android.os.Looper.getMainLooper().thread) return
            onceki?.uncaughtException(t, e)
        }
    }

    companion object {
        private const val OUTLOOK = "com.microsoft.office.outlook"
        /** WebViewAssetLoader'ın varsayılan alan adı: sayfa güvenli (https) kökenden yüklenir. */
        private const val APP_HOST = "appassets.androidplatform.net"
    }
}
