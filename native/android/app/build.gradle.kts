import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
}

// Single marketing version shared with iOS (native/VERSION).
val marketingVersion = file("../../VERSION").readText().trim()

// CI passes -PversionCodeOverride=<github run number + offset>; local builds use 1.
val versionCodeValue = (findProperty("versionCodeOverride") as String?)?.toIntOrNull() ?: 1

android {
    namespace = "com.maamoun.footballpredictions"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.maamoun.footballpredictions"
        minSdk = 24
        targetSdk = 35
        versionCode = versionCodeValue
        versionName = marketingVersion
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    signingConfigs {
        // Release keystore comes from CI secrets; without them `assembleRelease` falls back to the debug key.
        create("release") {
            val path = System.getenv("ANDROID_KEYSTORE_PATH")
            if (path != null) {
                storeFile = file(path)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            // Dev server / mock server run over plain http on the emulator loopback.
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            // Debug builds talk to the dev server through the emulator loopback (see AppConfig).
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "API_BASE_URL", "\"https://predictions-virid.vercel.app\"")
            signingConfig = if (System.getenv("ANDROID_KEYSTORE_PATH") != null)
                signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    sourceSets {
        // Contract fixtures are shared with iOS and decoded by the unit tests (classpath: fixtures/*.json).
        getByName("test").resources.srcDir("../../contract")
    }

    testOptions { unitTests.isReturnDefaultValues = true }

    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    // Pinned so lint-vital accepts the ActivityResult APIs used by MainActivity.
    implementation(libs.androidx.fragment)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.navigation.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.coil.compose)

    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
}
