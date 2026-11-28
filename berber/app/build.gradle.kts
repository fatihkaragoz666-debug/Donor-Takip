plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// GitHub Actions'ta her derlemede sürüm numarası artar; yeni APK eskisinin üzerine kurulur, veriler korunur.
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

android {
    namespace = "com.berberrandevu.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.berberrandevu.app"
        minSdk = 26
        targetSdk = 34
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    // Sabit imza anahtarı: güncellemeler eski sürümün üzerine kurulabilsin diye her derlemede aynı anahtar kullanılır.
    signingConfigs {
        create("sabit") {
            storeFile = file("berber.jks")
            storePassword = "Berber-Rw7BfVSZrQSM"
            keyAlias = "berber"
            keyPassword = "Berber-Rw7BfVSZrQSM"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("sabit")
        }
        debug {
            signingConfig = signingConfigs.getByName("sabit")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
}
