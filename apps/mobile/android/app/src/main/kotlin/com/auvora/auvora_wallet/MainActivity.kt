package com.auvora.auvora_wallet

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/// FragmentActivity is required by local_auth's BiometricPrompt on Android.
class MainActivity : FlutterFragmentActivity() {
    private val channelName = "auvora/screenshot_guard"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        ensureNotificationChannels()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                if (call.method == "setSecure") {
                    val enabled = call.argument<Boolean>("enabled") == true
                    runOnUiThread {
                        if (enabled) {
                            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        } else {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        }
                    }
                    result.success(null)
                } else {
                    result.notImplemented()
                }
            }
    }

    /** Android 8+ requires channels before any notification can post. */
    private fun ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channels = listOf(
            NotificationChannel(
                "auvora_transactions",
                "Transactions",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Confirmed sends, receives, and pending transfer updates."
            },
            NotificationChannel(
                "auvora_security",
                "Security",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Unlock alerts, permission changes, and security reminders."
            },
            NotificationChannel(
                "auvora_general",
                "General",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Sync status, product tips, and non-urgent updates."
            },
        )
        manager.createNotificationChannels(channels)
    }
}
