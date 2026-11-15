plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// GitHub Actions'ta her derlemede sürüm numarası artar; böylece yeni APK eskisinin üzerine kurulur (veriler korunur).
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.oabkm.donortakip"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.oabkm.donortakip"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Sabit imza anahtarı: güncellemeler eski sürümün üzerine kurulabilsin diye her derlemede aynı anahtar kullanılır.
    // Depoyu (repository) gizli (private) tutun.
    signingConfigs {
        create("donortakip") {
            storeFile = file("donortakip.jks")
            storePassword = "DonorTakip-FhlbxChQ55"
            keyAlias = "donortakip"
            keyPassword = "DonorTakip-FhlbxChQ55"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("donortakip")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("donortakip")
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
