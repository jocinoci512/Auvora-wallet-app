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

    // Side-by-side QA: set auvoraQa=true in android/gradle.properties (build-qa.ps1).
    // Never overwrites com.auvora.auvora_wallet when auvoraQa is unset/false.
    val isQaBuild =
        listOfNotNull(rootProject.findProperty("auvoraQa"), project.findProperty("auvoraQa"))
            .any { it.toString().equals("true", ignoreCase = true) }

    defaultConfig {
        applicationId = if (isQaBuild) "com.auvora.auvora_wallet.qa" else "com.auvora.auvora_wallet"
        minSdk = 24
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLabel"] = if (isQaBuild) "Auvora QA" else "Auvora Wallet"
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
            // Enforce upload release signing for Google Play compliance — no debug fallback.
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                throw GradleException("Release builds require android/key.properties and upload-keystore.jks for Google Play compliance.")
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
