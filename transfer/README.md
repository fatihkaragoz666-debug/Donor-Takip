# Antalya Transfer 2026

Kök Hücre Organizasyonu (Antalya, 20–24 Kasım 2026) havalimanı–otel transferlerini takip eden Android uygulaması.
Donör Takip'ten ayrı bir uygulamadır (`com.oabkm.antalyatransfer`), aynı depodan derlenir.

- Uygulamanın tamamı `app/src/main/assets/www` içindeki HTML/JS dosyalarıdır; `MainActivity` bunları WebView'da açar.
- **Kişi bilgisi depoda yoktur.** İlk açılışta organizasyonun Excel dosyası telefondan seçilir; kayıtlar yalnızca telefonda (`filesDir/kayitlar`) tutulur. İnternet izni yoktur.
- Excel okuma/yazma `js/xlsx-io.js` ile (Donör Takip'teki dosyanın kopyası), harici kütüphane yok.
- Uyarılar: her açık saat grubu için uçuş/biniş öncesi ve "hâlâ Bekleniyor" bildirimi (`Hatirlatici.kt`).

## Derleme

`transfer/` altındaki bir değişiklik GitHub'a yüklenince `.github/workflows/transfer-apk.yml` APK'yı derler.
APK, deponun **Releases** bölümünde `AntalyaTransfer-1.0.N.apk` adıyla çıkar. Donör Takip derlemesi bu değişikliklerle tetiklenmez.

Yerelde: `./gradlew -p transfer assembleRelease`
