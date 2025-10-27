package com.cpen321.usermanagement

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.cpen321.usermanagement.data.repository.AuthRepositoryImpl
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import jakarta.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MyFirebaseMessagingService : FirebaseMessagingService() {
    @Inject lateinit var authRepository: AuthRepositoryImpl

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New FCM token: $token")

        // Send the token to your backend inside a coroutine
        sendTokenToServer(token)
    }

    private fun sendTokenToServer(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            if (token.isBlank()) {
                Log.w("FCM", "Skipping FCM token sync because provided token is blank")
                return@launch
            }
            authRepository.sendFcmTokenToServer(token)
        }
    }




    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d("FCM", "Message received from: ${remoteMessage.from}")

        // Display notification if present
        remoteMessage.notification?.let {
            showNotification(it.title ?: "New Message", it.body ?: "")
        }

        // Optional: log data payload
        if (remoteMessage.data.isNotEmpty()) {
            Log.d("FCM", "Data Payload: ${remoteMessage.data}")
        }
    }

    private fun showNotification(title: String, message: String) {
        val channelId = "friend_request_channel"
        val notificationId = System.currentTimeMillis().toInt()
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Friend Requests",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for friend requests"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        // Android 13+ permission check
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED
            ) {
                NotificationManagerCompat.from(this).notify(notificationId, notification)
            } else {
                Log.w("FCM", "Missing POST_NOTIFICATIONS permission. Request it in MainActivity.")
            }
        } else {
            // Pre-Android 13, no permission needed
            NotificationManagerCompat.from(this).notify(notificationId, notification)
        }
    }
}
