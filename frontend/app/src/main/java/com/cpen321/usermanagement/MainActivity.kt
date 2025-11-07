package com.cpen321.usermanagement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.cpen321.usermanagement.ui.navigation.AppNavigation
import com.cpen321.usermanagement.ui.screens.SplashScreen
import com.cpen321.usermanagement.ui.theme.ProvideFontSizes
import com.cpen321.usermanagement.ui.theme.ProvideSpacing
import com.cpen321.usermanagement.ui.theme.UserManagementTheme
import dagger.hilt.android.AndroidEntryPoint

import com.cpen321.usermanagement.data.remote.api.RetrofitClient

import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope
import com.cpen321.usermanagement.data.repository.AuthRepositoryImpl
import javax.inject.Inject
import android.content.pm.PackageManager
import android.os.Build



@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var authRepository: AuthRepositoryImpl

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Detect if we are running a test
        val isTest = intent.getBooleanExtra("isTest", false)

        // Only request runtime permissions if not testing
        if (!isTest) {
            requestPermissionsIfNeeded()
        }

        setContent {
            UserManagementApp(isTest = isTest)
        }

        // Send FCM token if user is already logged in
        lifecycleScope.launch {
            if (authRepository.doesTokenExist()) {
                RetrofitClient.setAuthToken(authRepository.getStoredToken())
                authRepository.sendFcmTokenToServer()
            }
        }
    }

    private fun requestPermissionsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.CAMERA), 1001)
            }
        }
    }
}



@Composable
fun UserManagementApp(
    isTest: Boolean = false
) {
    ProvideSpacing {
        ProvideFontSizes {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                if (isTest) {
                    // Directly show main navigation for tests
                    AppNavigation()
                } else {
                    var showSplash by remember { mutableStateOf(true) }

                    if (showSplash) {
                        SplashScreen(onTimeout = { showSplash = false })
                    } else {
                        AppNavigation()
                    }
                }
            }
        }
    }
}




