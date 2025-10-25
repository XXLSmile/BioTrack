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


@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var authRepository: AuthRepositoryImpl
    override fun onCreate(savedInstanceState: Bundle?) {

        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            UserManagementTheme {
                UserManagementApp()
            }
        }

        // Send FCM token if user is already logged in
        lifecycleScope.launch {
            if (authRepository.doesTokenExist()) {
                RetrofitClient.setAuthToken(authRepository.getStoredToken())
                authRepository.sendFcmTokenToServer()
            }
        }
    }
}

@Composable
fun UserManagementApp() {
    ProvideSpacing {
        ProvideFontSizes {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                var showSplash by remember { mutableStateOf(true) }

                if (showSplash) {
                    //Animated splash before main nav appears
                    SplashScreen(onTimeout = { showSplash = false })
                } else {
                    //Once splash fades out, show your app normally
                    AppNavigation()
                }
            }
        }
    }
}

