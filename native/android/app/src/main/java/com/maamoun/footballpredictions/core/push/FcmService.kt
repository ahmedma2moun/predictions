package com.maamoun.footballpredictions.core.push

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.maamoun.footballpredictions.R
import com.maamoun.footballpredictions.app.MainActivity

/**
 * Foreground messages: the system only draws notifications for backgrounded apps, so we post one ourselves
 * (RN's expo handler showed banner + sound in the foreground too). Taps open MainActivity with the
 * message `data` as intent extras, which MainActivity routes via [NotificationRouter].
 */
class FcmService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: return
        ensureNotificationChannel(this)
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            message.data.forEach { (k, v) -> putExtra(k, v) }
        }
        val pending = PendingIntent.getActivity(
            this, message.messageId.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, DEFAULT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFF10B981.toInt())
            .setContentTitle(title)
            .setContentText(message.notification?.body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(message.messageId.hashCode(), notification)
        } catch (_: SecurityException) { /* permission denied */ }
    }
}
