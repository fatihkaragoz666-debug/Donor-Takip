plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Antalya Transfer · GitHub Actions'ta her derlemede sürüm numarası artar; böylece yeni APK eskisinin üzerine kurulur (veriler korunur).
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.oabkm.antalyatransfer"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.oabkm.antalyatransfer"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Donör Takip ile aynı imza anahtarı (app/donortakip.jks): güncellemeler eski sürümün üzerine kurulabilsin diye her derlemede aynı anahtar kullanılır.
    // Depoyu (repository) gizli (private) tutun.
    signingConfigs {
        create("imza") {
            storeFile = file("../../app/donortakip.jks")
            storePassword = "DonorTakip-FhlbxChQ55"
            keyAlias = "donortakip"
            keyPassword = "DonorTakip-FhlbxChQ55"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("imza")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("imza")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
}
