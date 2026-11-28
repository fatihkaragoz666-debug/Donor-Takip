# Berber Randevu

Berber dükkanı için Android randevu uygulaması: takvim, müşteri kartları, kasa raporu,
WhatsApp hatırlatma mesajı ve randevudan önce telefon bildirimi.

## APK nasıl oluşur

`berber/` klasöründe bir değişiklik GitHub'a yüklenince `.github/workflows/berber-apk.yml`
(deponun kökündeki `gradlew` ile, `-p berber`) APK'yı otomatik derler (5–10 dakika). Hazır APK deponun **Releases** bölümünde
`BerberRandevu-1.0.N.apk` adıyla görünür; telefondan indirip kurun.
Yeni sürüm eskisinin üzerine kurulur, randevular silinmez.

## Veriler

Tüm veriler yalnızca telefonda saklanır (depoda müşteri bilgisi yoktur).
Telefon değiştirirken Ayarlar › Yedek al ile alınan `.json` dosyasını yeni telefonda
Ayarlar › Yedekten geri yükle ile açın.

## Yapı

- `app/src/main/assets/www/` — uygulama ekranları (index.html, js/app.js, js/xlsx.js)
- `app/src/main/java/.../MainActivity.kt` — WebView kabuğu; dosya kaydetme, paylaşma, arama/WhatsApp açma
- `app/src/main/java/.../Hatirlatici.kt` — randevu bildirimleri (telefon yeniden açılınca tekrar kurulur)
- `app/berber.jks` — sabit imza anahtarı (güncellemelerin üzerine kurulabilmesi için)
