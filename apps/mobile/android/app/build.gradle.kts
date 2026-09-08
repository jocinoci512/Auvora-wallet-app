import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "com.auvora.auvora_wallet"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Side-by-side QA / Staging: set auvoraQa=true or auvoraStaging=true in android/gradle.properties.
    // Never overwrites com.auvora.auvora_wallet when neither is set.
    val isStagingBuild =
        listOfNotNull(rootProject.findProperty("auvoraStaging"), project.findProperty("auvoraStaging"))
            .any { it.toString().equals("true", ignoreCase = true) }
    val isQaBuild =
        listOfNotNull(rootProject.findProperty("auvoraQa"), project.findProperty("auvoraQa"))
            .any { it.toString().equals("true", ignoreCase = true) }

    defaultConfig {
        applicationId = when {
            isStagingBuild -> "com.auvora.auvora_wallet.staging"
            isQaBuild -> "com.auvora.auvora_wallet.qa"
            else -> "com.auvora.auvora_wallet"
        }
        minSdk = 24
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLabel"] = when {
            isStagingBuild -> "Auvora Staging"
            isQaBuild -> "Auvora QA"
            else -> "Auvora Wallet"
        }
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Play/upload builds use the upload keystore when present. CI has no
            // key.properties — fall back to the debug keystore (matches flutter-mobile.yml).
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            // Minify deferred until ProGuard keep-rules are validated on device.
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
