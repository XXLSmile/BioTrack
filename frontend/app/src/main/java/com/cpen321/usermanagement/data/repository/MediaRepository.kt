package com.cpen321.usermanagement.data.repository

import android.util.Log
import com.cpen321.usermanagement.data.remote.api.MediaInterface
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.HttpException
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MediaRepository @Inject constructor(
    private val mediaInterface: MediaInterface
) {
    suspend fun uploadAndIdentify(imageFile: File): Result<ScanResponse> {
        return try {
            val requestFile = imageFile.asRequestBody("image/*".toMediaTypeOrNull())
            val multipart = MultipartBody.Part.createFormData("image", imageFile.name, requestFile)

            val response = mediaInterface.uploadImage(multipart)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val msg = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("Upload failed: $msg"))
            }
        } catch (e: HttpException) {
            Log.e("MediaRepository", "HTTP error: ${e.code()}", e)
            Result.failure(e)
        } catch (e: IOException) {
            Log.e("MediaRepository", "Upload failed due to network error", e)
            Result.failure(e)
        }
    }
}
