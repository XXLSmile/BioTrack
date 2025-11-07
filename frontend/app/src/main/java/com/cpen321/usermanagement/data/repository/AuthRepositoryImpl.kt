package com.cpen321.usermanagement.data.repository

import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.local.preferences.TokenManager
import com.cpen321.usermanagement.data.remote.api.AuthInterface
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.remote.dto.ApiResponse
import com.cpen321.usermanagement.data.remote.dto.AuthData
import com.cpen321.usermanagement.data.remote.dto.GoogleLoginRequest
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.socket.CatalogSocketService
import com.cpen321.usermanagement.utils.JsonUtils
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import java.io.IOException
import retrofit2.HttpException
import retrofit2.Response
import kotlinx.coroutines.CancellationException

@Singleton
class AuthRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val authInterface: AuthInterface,
    private val userInterface: UserInterface,
    private val tokenManager: TokenManager,
    private val catalogSocketService: CatalogSocketService
) : AuthRepository {

    companion object {
        private const val TAG = "AuthRepositoryImpl"
    }

    private val credentialManager = CredentialManager.create(context)
    private val signInWithGoogleOption: GetSignInWithGoogleOption =
        GetSignInWithGoogleOption.Builder(
            serverClientId = BuildConfig.GOOGLE_CLIENT_ID
        ).build()

    override suspend fun signInWithGoogle(context: Context): Result<GoogleIdTokenCredential> {
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(signInWithGoogleOption)
            .build()

        return try {
            val response = credentialManager.getCredential(context, request)
            handleSignInWithGoogleOption(response)
        } catch (e: GetCredentialException) {
            Log.e(TAG, "Failed to get credential from CredentialManager", e)
            Result.failure(e)
        }
    }

    private fun handleSignInWithGoogleOption(
        result: GetCredentialResponse
    ): Result<GoogleIdTokenCredential> {
        val credential = result.credential

        return when (credential) {
            is CustomCredential -> {
                if (credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    try {
                        val googleIdTokenCredential =
                            GoogleIdTokenCredential.createFrom(credential.data)
                        Result.success(googleIdTokenCredential)
                    } catch (e: GoogleIdTokenParsingException) {
                        Log.e(TAG, "Failed to parse Google ID token credential", e)
                        Result.failure(e)
                    }
                } else {
                    Log.e(TAG, "Unexpected type of credential: ${credential.type}")
                    Result.failure(Exception("Unexpected type of credential"))
                }
            }

            else -> {
                Log.e(TAG, "Unexpected type of credential: ${credential::class.simpleName}")
                Result.failure(Exception("Unexpected type of credential"))
            }
        }
    }

    override suspend fun googleSignIn(tokenId: String): Result<AuthData> {
        val googleLoginReq = GoogleLoginRequest(tokenId)
        return try {
            val response = authInterface.googleSignIn(googleLoginReq)
            if (response.isSuccessful && response.body()?.data != null) {
                val authData = response.body()!!.data!!
                tokenManager.saveToken(authData.token)
                RetrofitClient.setAuthToken(authData.token)
                catalogSocketService.updateAuthToken(authData.token)
                // Send FCM token
                sendFcmTokenToServer()
                Result.success(authData)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = JsonUtils.parseErrorMessage(
                    errorBodyString,
                    response.body()?.message ?: "Failed to sign in with Google."
                )
                Log.e(TAG, "Google sign in failed: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "Network timeout during Google sign in", e)
            Result.failure(e)
        } catch (e: java.net.UnknownHostException) {
            Log.e(TAG, "Network connection failed during Google sign in", e)
            Result.failure(e)
        } catch (e: java.io.IOException) {
            Log.e(TAG, "IO error during Google sign in", e)
            Result.failure(e)
        } catch (e: retrofit2.HttpException) {
            Log.e(TAG, "HTTP error during Google sign in: ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun googleSignUp(tokenId: String): Result<AuthData> {
        val googleLoginReq = GoogleLoginRequest(tokenId)
        return try {
            val response = authInterface.googleSignUp(googleLoginReq)
            if (response.isSuccessful && response.body()?.data != null) {
                val authData = response.body()!!.data!!
                tokenManager.saveToken(authData.token)
                RetrofitClient.setAuthToken(authData.token)
                catalogSocketService.updateAuthToken(authData.token)
                // Send FCM token
                sendFcmTokenToServer()
                Result.success(authData)

            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = JsonUtils.parseErrorMessage(
                    errorBodyString,
                    response.body()?.message ?: "Failed to sign up with Google."
                )
                Log.e(TAG, "Google sign up failed: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "Network timeout during Google sign up", e)
            Result.failure(e)
        } catch (e: java.net.UnknownHostException) {
            Log.e(TAG, "Network connection failed during Google sign up", e)
            Result.failure(e)
        } catch (e: java.io.IOException) {
            Log.e(TAG, "IO error during Google sign up", e)
            Result.failure(e)
        } catch (e: retrofit2.HttpException) {
            Log.e(TAG, "HTTP error during Google sign up: ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun sendFcmTokenToServer(fcmToken: String?) {
        try {
            val authToken = getStoredToken()
            if (authToken.isNullOrBlank()) {
                Log.d(TAG, "Skipping FCM token sync: user is not authenticated")
                return
            }

            RetrofitClient.setAuthToken(authToken)

            val tokenToSend = fcmToken?.takeIf { it.isNotBlank() }
                ?: runCatching { FirebaseMessaging.getInstance().token.await() }
                    .getOrElse { error ->
                        Log.e(TAG, "Failed to retrieve FCM token", error)
                        return
                    }

            if (tokenToSend.isBlank()) {
                Log.w(TAG, "Skipping FCM token sync: token is blank")
                return
            }

            val response = RetrofitClient.userInterface.updateFcmToken(mapOf("token" to tokenToSend))
            if (response.isSuccessful) {
                Log.d(TAG, "FCM token sent successfully")
            } else {
                Log.e(TAG, "Failed to send FCM token: ${response.errorBody()?.string()}")
            }
        } catch (e: IOException) {
            Log.e(TAG, "Network error sending FCM token", e)
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP error sending FCM token: ${e.code()}", e)
        } catch (e: CancellationException) {
            Log.e(TAG, "FCM token sync cancelled", e)
        }
    }

    override suspend fun clearToken(): Result<Unit> {
        tokenManager.clearToken()
        RetrofitClient.setAuthToken(null)
        catalogSocketService.disconnect()
        return Result.success(Unit)
    }

    override suspend fun doesTokenExist(): Boolean {
        return tokenManager.getToken().first() != null
    }

    override suspend fun getStoredToken(): String? {
        return tokenManager.getTokenSync()
    }

    override suspend fun getCurrentUser(): User? {
        return try {
            val response = userInterface.getProfile()
            if (response.isSuccessful && response.body()?.data != null) {
                response.body()!!.data!!.user
            } else {
                Log.e(
                    TAG,
                    "Failed to get current user: ${response.body()?.message ?: "Unknown error"}"
                )
                null
            }
        } catch (e: java.net.SocketTimeoutException) {
            Log.e(TAG, "Network timeout while getting current user", e)
            null
        } catch (e: java.net.UnknownHostException) {
            Log.e(TAG, "Network connection failed while getting current user", e)
            null
        } catch (e: java.io.IOException) {
            Log.e(TAG, "IO error while getting current user", e)
            null
        } catch (e: retrofit2.HttpException) {
            Log.e(TAG, "HTTP error while getting current user: ${e.code()}", e)
            null
        }
    }

    override suspend fun isUserAuthenticated(): Boolean {
        val isLoggedIn = doesTokenExist()
        if (isLoggedIn) {
            val token = getStoredToken()
            token?.let { RetrofitClient.setAuthToken(it) }
            token?.let { catalogSocketService.updateAuthToken(it) }
            // Verify token is still valid by trying to get user profile
            return getCurrentUser() != null
        }
        return false
    }

    override suspend fun logout(): Result<Unit> {
        val authToken = getStoredToken()
        RetrofitClient.setAuthToken(authToken)
        return try {
            authToken?.let { clearServerFcmToken() }
            val result = handleLogoutResponse(authInterface.logout())
            if (result.isSuccess) {
                tokenManager.clearToken()
                RetrofitClient.setAuthToken(null)
                catalogSocketService.disconnect()
            }
            result
        } catch (e: IOException) {
            Log.e(TAG, "Logout failed due to network error", e)
            Result.failure(e)
        } catch (e: HttpException) {
            Log.e(TAG, "Logout failed with HTTP ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteAccount() {
        try {
            userInterface.deleteProfile()
        } catch (e: IOException) {
            Log.e(TAG, "Delete account failed due to network error", e)
        } catch (e: HttpException) {
            Log.e(TAG, "Delete account failed with HTTP ${e.code()}", e)
        }
    }

    private suspend fun clearServerFcmToken() {
        try {
            val clearResponse = RetrofitClient.userInterface.clearFcmToken()
            if (!clearResponse.isSuccessful) {
                Log.w(TAG, "Failed to clear FCM token on server during logout: ${clearResponse.errorBody()?.string()}")
            }
        } catch (e: IOException) {
            Log.w(TAG, "Network error clearing FCM token during logout", e)
        } catch (e: HttpException) {
            Log.w(TAG, "HTTP error clearing FCM token during logout: ${e.code()}", e)
        }
    }

    private fun handleLogoutResponse(response: Response<ApiResponse<Unit>>): Result<Unit> {
        if (response.isSuccessful) {
            return Result.success(Unit)
        }

        val errorBodyString = response.errorBody()?.string()
        val errorMessage = JsonUtils.parseErrorMessage(
            errorBodyString,
            response.body()?.message ?: "Logout failed."
        )
        Log.e(TAG, "Logout failed: $errorMessage")
        return Result.failure(Exception(errorMessage))
    }
}
