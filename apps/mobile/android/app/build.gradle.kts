import java.util.Properties
import java.io.FileInputStream
import java.io.File

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
        // PERMANENT production identity. Never change the else branch.
        // QA/staging suffixes are for side-by-side developer installs only.
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
        // Fail the build if a "production" configuration somehow resolves to QA/staging.
        if (!isQaBuild && !isStagingBuild && applicationId != "com.auvora.auvora_wallet") {
            throw GradleException(
                "Production applicationId lock violated: expected com.auvora.auvora_wallet, got $applicationId",
            )
        }
        if ((isQaBuild || isStagingBuild) && applicationId == "com.auvora.auvora_wallet") {
            throw GradleException(
                "QA/staging build must not use the production applicationId com.auvora.auvora_wallet",
            )
        }
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                val rawStoreFile = keystoreProperties["storeFile"] as String
                // key.properties is in apps/mobile/android/ (rootProject).
                // If rawStoreFile is relative (e.g. "../upload-keystore.jks" or "upload-keystore.jks"),
                // resolve it relative to keystorePropertiesFile.parentFile.
                val candidate = File(rawStoreFile)
                storeFile = if (candidate.isAbsolute) candidate else File(keystorePropertiesFile.parentFile, rawStoreFile)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Play/upload builds use the release keystore when android/key.properties exists.
            // CI `flutter build apk --release` has no keystore — fall back to debug signing.
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
