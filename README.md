# Donör Takip · Android uygulaması

OABKM Donör Takip Excel dosyasının telefon sürümü. Excel'deki gibi Ana Sayfa'da Kızılay görseli ve
dört grup (PLANLAMA, TAKİP, DONÖR KAYIT VE ARŞİV, DASHBOARD) vardır; her grubun altında Excel'deki sayfalar yer alır. Donör kaydı, kontrol uyarıları, geri sayım
uyarıları, takvim, WhatsApp'a gönderilecek Çalışma Programı, takip listeleri (sağlık kontrolü, aşı,
toplama, ürün taşıma, son izlem, IDM) ve Dashboard istatistikleri Excel'deki formüllerle aynı
kurallarla hesaplanır.

Veriler yalnızca telefonda saklanır; uygulamanın internet izni yoktur.

## APK nasıl derlenir?

1. Bilgisayara **Android Studio** kurun (https://developer.android.com/studio).
2. Bu klasörü (`DonorTakip`) zip'ten çıkarın.
3. Android Studio'da **File › Open** ile `DonorTakip` klasörünü açın. İlk açılışta Gradle gerekli
   bileşenleri internetten indirir (birkaç dakika sürebilir). "Upgrade" önerisi gelirse kabul
   etmeniz gerekmez.
4. **Build › Build App Bundle(s) / APK(s) › Build APK(s)** seçin.
5. Bitince sağ altta çıkan bildirimdeki **locate** bağlantısı APK'yı gösterir:
   `app/build/outputs/apk/debug/app-debug.apk`
6. APK'yı telefona gönderin (USB, e-posta, Drive) ve açın. Telefon "bilinmeyen kaynaklardan
   yükleme" izni isterse verin.

Telefon USB ile bağlıysa ve geliştirici seçeneklerinde USB hata ayıklama açıksa, Android Studio'daki
yeşil ▶ (Run) düğmesi uygulamayı doğrudan telefona kurar.

Komut satırından: `./gradlew assembleDebug` (Windows'ta `gradlew.bat assembleDebug`).

## Bilgisayarsız: GitHub ile APK

Proje GitHub'a yüklendiğinde `.github/workflows/apk.yml` APK'yı otomatik derler (5–10 dakika).
Hazır APK deponun **Releases** bölümünde `DonorTakip-1.0.N.apk` olarak görünür; telefondan indirip kurun.
Her yeni yüklemede sürüm numarası artar ve yeni APK eskisinin üzerine kurulur, veriler silinmez.
İmza anahtarı (`app/donortakip.jks`) depoda durduğu için depoyu **gizli (private)** tutun.

## İlk kullanım

1. Uygulamayı açın, **Excel dosyası seç** ile Donör Takip `.xlsx` dosyanızı seçin.
2. Donörler, Listeler sayfası (personel, hastaneler, resmi tatiller, anahtar kelimeler, programdaki
   yazılışlar), Haftalık Program / Haftalık Plan'da seçilmiş görev personeli ve Çalışma Programı'ndaki
   EK GÖREVLER aktarılır.
3. Sonraki değişiklikleri uygulamada yapın. Ayarlar'dan **Yedek al** ile düzenli yedek alın;
   **Excel'e aktar** Donör Kayıt sayfasını (KONTROL ve DURUM dahil) `.xlsx` olarak kaydeder.

## Dosya yapısı

- `app/src/main/assets/www/` — uygulamanın kendisi (HTML/CSS/JavaScript)
  - `js/logic.js` — Excel formüllerinin karşılığı (aşı tarihi, görev havuzu, uyarılar, takip
    listeleri, Çalışma Programı metni, Dashboard)
  - `js/xlsx-io.js` — Excel dosyası okuma/yazma
  - `js/app.js` — ekranlar
  - `js/defaults.js` — varsayılan listeler (Excel'deki Listeler sayfasından)
- `app/src/main/java/.../MainActivity.kt` — WebView kabuğu: dosya seçme/kaydetme, WhatsApp'ta
  paylaşma, panoya kopyalama, telefon araması, geri tuşu
- Uygulama adı, paket adı ve sürüm: `app/build.gradle.kts` (`applicationId`, `versionName`)

## Excel ile farklar

- Görev personeli (Haftalık Program'daki seçim) uygulamada görevin kendisine kaydedilir; hafta
  değişse de kaybolmaz. Görevin yanındaki personel düğmesine dokunarak atanır.
- Görev Listesi, Aşı Takip ve Toplama Takip'te personel olarak görevin atanmış personeli gösterilir.
- Haftalık Plan, Haftalık Kapanış, Görev Kayıtları, Taşıma Kayıtları, İş Yükü ve Taşıma İstatistiği
  sonraki sürümde eklenecek.
