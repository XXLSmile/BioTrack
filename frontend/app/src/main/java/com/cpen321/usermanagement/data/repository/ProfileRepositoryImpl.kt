package com.cpen321.usermanagement.data.repository

import android.util.Log
import com.cpen321.usermanagement.data.local.preferences.TokenManager
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.remote.dto.FavoriteSpeciesRequest
import com.cpen321.usermanagement.data.remote.dto.UpdateProfileRequest
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.dto.UserStatsData
import com.cpen321.usermanagement.data.remote.dto.UsernameAvailabilityResponse
import com.cpen321.usermanagement.data.remote.socket.CatalogSocketService
import com.cpen321.usermanagement.utils.JsonUtils.parseErrorMessage
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.inject.Inject
import javax.inject.Singleton
import retrofit2.HttpException

@Singleton
class ProfileRepositoryImpl @Inject constructor(
    private val userInterface: UserInterface,
    private val tokenManager: TokenManager,
    private val catalogSocketService: CatalogSocketService
) : ProfileRepository {

    companion object {
        private const val TAG = "ProfileRepositoryImpl"
    }

    override suspend fun getProfile(): Result<User> {
        return try {
            val response = userInterface.getProfile()
            val body = response.body()

            if (response.isSuccessful && body?.data?.user != null) {
                Result.success(body.data.user)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage =
                    parseErrorMessage(errorBodyString, body?.message ?: "Failed to fetch user information.")
                Log.e(TAG, "Failed to get profile: $errorMessage")
                tokenManager.clearToken()
                RetrofitClient.setAuthToken(null)
                catalogSocketService.disconnect()
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) {
            Log.e(TAG, "Network timeout while getting profile", e)
            Result.failure(e)
        } catch (e: UnknownHostException) {
            Log.e(TAG, "Network connection failed while getting profile", e)
            Result.failure(e)
        } catch (e: IOException) {
            Log.e(TAG, "IO error while getting profile", e)
            Result.failure(e)
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP error while getting profile: ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun updateProfile(
        name: String?,
        username: String?,
        location: String?,
        region: String?,
        isPublicProfile: Boolean?,
        profilePicture: String?,
        favoriteSpecies: List<String>?
    ): Result<User> {
        return try {
            val updateRequest = UpdateProfileRequest(
                name = name,
                username = username,
                location = location,
                region = region,
                isPublicProfile = isPublicProfile,
                profilePicture = profilePicture,
                favoriteSpecies = favoriteSpecies
            )

            val response = userInterface.updateProfile(updateRequest)
            val body = response.body()

            if (response.isSuccessful && body?.data?.user != null) {
                Result.success(body.data.user)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = parseErrorMessage(errorBodyString, body?.message ?: "Failed to update profile.")
                Log.e(TAG, "Failed to update profile: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) {
            Log.e(TAG, "Network timeout while updating profile", e)
            Result.failure(e)
        } catch (e: UnknownHostException) {
            Log.e(TAG, "Network connection failed while updating profile", e)
            Result.failure(e)
        } catch (e: IOException) {
            Log.e(TAG, "IO error while updating profile", e)
            Result.failure(e)
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP error while updating profile: ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun getUserStats(): Result<UserStatsData> {
        return try {
            val response = userInterface.getUserStats()
            val body = response.body()

            if (response.isSuccessful && body?.data != null) {
                Result.success(body.data)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = parseErrorMessage(errorBodyString, body?.message ?: "Failed to load user stats.")
                Log.e(TAG, "Failed to get user stats: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) {
            Log.e(TAG, "Network timeout while getting user stats", e)
            Result.failure(e)
        } catch (e: UnknownHostException) {
            Log.e(TAG, "Network connection failed while getting user stats", e)
            Result.failure(e)
        } catch (e: IOException) {
            Log.e(TAG, "IO error while getting user stats", e)
            Result.failure(e)
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP error while getting user stats: ${e.code()}", e)
            Result.failure(e)
        }
    }

    override suspend fun addFavoriteSpecies(speciesName: String): Result<Unit> {
        return try {
            val response = userInterface.addFavoriteSpecies(FavoriteSpeciesRequest(speciesName))
            val body = response.body()

            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = parseErrorMessage(errorBodyString, body?.message ?: "Failed to add favorite species.")
                Log.e(TAG, "Failed to add favorite species: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error while adding favorite species", e)
            Result.failure(e)
        }
    }

    override suspend fun removeFavoriteSpecies(speciesName: String): Result<Unit> {
        return try {
            val response = userInterface.removeFavoriteSpecies(FavoriteSpeciesRequest(speciesName))
            val body = response.body()

            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage = parseErrorMessage(errorBodyString, body?.message ?: "Failed to remove favorite species.")
                Log.e(TAG, "Failed to remove favorite species: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error while removing favorite species", e)
            Result.failure(e)
        }
    }

    override suspend fun checkUsernameAvailability(username: String): Result<UsernameAvailabilityResponse> {
        return try {
            val response = userInterface.checkUsername(username)
            val body = response.body()

            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                val errorBodyString = response.errorBody()?.string()
                val errorMessage =
                    parseErrorMessage(errorBodyString, body?.message ?: "Failed to check username availability.")
                Log.e(TAG, "Failed to check username: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) {
            Log.e(TAG, "Network timeout while checking username", e)
            Result.failure(e)
        } catch (e: UnknownHostException) {
            Log.e(TAG, "Network failure while checking username", e)
            Result.failure(e)
        } catch (e: IOException) {
            Log.e(TAG, "IO error while checking username", e)
            Result.failure(e)
        } catch (e: HttpException) {
            Log.e(TAG, "HTTP error while checking username: ${e.code()}", e)
            Result.failure(e)
        }
    }
}
