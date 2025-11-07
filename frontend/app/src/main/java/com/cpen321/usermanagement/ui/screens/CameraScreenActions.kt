package com.cpen321.usermanagement.ui.screens

import android.content.Context
import android.location.Location
import android.net.Uri
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.dto.RecognizeAndSaveResponse
import com.cpen321.usermanagement.data.remote.dto.SaveRecognitionRequest
import com.cpen321.usermanagement.data.remote.dto.ScanData
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.google.android.gms.location.FusedLocationProviderClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import retrofit2.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

internal data class RecognitionContext(
    val appContext: Context,
    val scope: CoroutineScope,
    val uiState: CameraUiState,
    val fusedLocationClient: FusedLocationProviderClient,
    val currentLocation: Location?,
    val onLocationUpdated: (Location?) -> Unit,
    val hasLocationPermission: () -> Boolean,
    val requestLocationPermission: () -> Unit
)

internal data class CatalogSaveContext(
    val uiState: CameraUiState,
    val hasLocationPermission: Boolean,
    val fusedLocationClient: FusedLocationProviderClient,
    val currentLocation: Location?,
    val onLocationUpdated: (Location?) -> Unit,
    val viewModel: CatalogViewModel,
    val profileViewModel: ProfileViewModel,
    val scope: CoroutineScope
)

internal fun performRecognition(environment: RecognitionContext) {
    if (!environment.hasLocationPermission()) {
        environment.requestLocationPermission()
        environment.uiState.updateResult("Grant location permission to attach coordinates.")
        return
    }

    val uri = environment.uiState.imageUri
    if (uri == null) {
        environment.uiState.updateResult("Select a photo before scanning.")
        return
    }

    environment.scope.launch {
        val locationToUse = environment.currentLocation ?: fetchCurrentLocation(environment.fusedLocationClient).also {
            environment.onLocationUpdated(it)
        }
        environment.uiState.updateResult("Recognizing...")
        val (message, response) = recognizeImage(environment.appContext, uri, locationToUse)
        environment.uiState.showRecognitionResult(message, response)
    }
}

internal fun handleCatalogSave(
    catalogId: String,
    context: CatalogSaveContext
) {
    val uiState = context.uiState
    if (uiState.isSaving) return
    val recognition = context.uiState.recognitionResult
    if (recognition == null) {
        uiState.updateResult("⚠️ Run recognition before saving.")
        return
    }
    if (recognition.data.imagePath.isNullOrBlank()) {
        uiState.updateResult("⚠️ Unable to save because the image reference is missing.")
        return
    }

    uiState.setSavingState(true)
    context.scope.launch {
        val locationToUse = if (context.hasLocationPermission) {
            context.currentLocation ?: fetchCurrentLocation(context.fusedLocationClient).also(context.onLocationUpdated)
        } else {
            context.currentLocation
        }

        val (success, message) = saveRecognitionToCatalog(recognition, catalogId, locationToUse)
        uiState.updateResult(message)
        if (success) {
            uiState.resetAfterSave()
            context.viewModel.loadCatalogs()
            context.profileViewModel.refreshStats()
        }
        uiState.setSavingState(false)
    }
}

private suspend fun recognizeImage(
    context: Context,
    uri: Uri,
    location: Location?
): Pair<String, ScanResponse?> {
    var tempFile: File? = null
    return try {
        val (imagePart, file) = createImagePart(context, uri)
        tempFile = file
        val latitudeBody = location?.latitude?.toTextRequestBody()
        val longitudeBody = location?.longitude?.toTextRequestBody()
        val response = withContext(Dispatchers.IO) {
            RetrofitClient.wildlifeApi.recognizeAnimal(imagePart, latitudeBody, longitudeBody)
        }
        buildRecognitionResult(response)
    } catch (e: IOException) {
        "⚠️ Upload failed: ${e.localizedMessage ?: "Check your connection and try again."}" to null
    } catch (e: HttpException) {
        "⚠️ Upload failed: HTTP ${e.code()}" to null
    } catch (e: IllegalArgumentException) {
        "⚠️ Upload failed: ${e.localizedMessage ?: "Invalid image"}" to null
    } finally {
        tempFile?.delete()
    }
}

private suspend fun saveRecognitionToCatalog(
    recognitionResponse: ScanResponse,
    catalogId: String,
    location: Location?
): Pair<Boolean, String> {
    val imagePath = recognitionResponse.data.imagePath
        ?: return false to "⚠️ Cannot save this observation because the image reference is missing."

    val request = SaveRecognitionRequest(
        imagePath = imagePath,
        recognition = recognitionResponse.data.recognition,
        catalogId = catalogId,
        latitude = location?.latitude,
        longitude = location?.longitude
    )

    return try {
        val response = withContext(Dispatchers.IO) {
            RetrofitClient.wildlifeApi.recognizeAndSave(request)
        }
        interpretSaveResponse(response, recognitionResponse)
    } catch (e: IOException) {
        false to ("⚠️ Save failed: ${e.localizedMessage ?: "Check your connection and try again."}")
    } catch (e: HttpException) {
        false to ("⚠️ Save failed: HTTP ${e.code()}")
    } catch (e: IllegalArgumentException) {
        false to ("⚠️ Save failed: ${e.localizedMessage ?: "Invalid data"}")
    }
}

private suspend fun createImagePart(
    context: Context,
    uri: Uri
): Pair<MultipartBody.Part, File> = withContext(Dispatchers.IO) {
    val inputStream = context.contentResolver.openInputStream(uri)
        ?: throw IllegalArgumentException("Unable to open selected image.")
    val tempFile = File.createTempFile("upload_", ".jpg", context.cacheDir)
    inputStream.use { input ->
        FileOutputStream(tempFile).use { output ->
            input.copyTo(output)
        }
    }

    val requestFile = tempFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
    MultipartBody.Part.createFormData("image", tempFile.name, requestFile) to tempFile
}

private fun formatRecognitionMessage(data: ScanData): String {
    val species = data.species
    val displayName = species?.commonName ?: species?.scientificName ?: "Unknown species"
    val scientificLabel = species?.scientificName
    val confidencePercent = String.format("%.2f", data.confidence * 100)

    val builder = StringBuilder("✅ $displayName")
    if (!scientificLabel.isNullOrBlank() && !scientificLabel.equals(displayName, ignoreCase = true)) {
        builder.append("\n(").append(scientificLabel).append(")")
    }
    builder.append("\nConfidence: $confidencePercent%")
    return builder.toString()
}

private fun buildRecognitionResult(response: Response<ScanResponse>): Pair<String, ScanResponse?> {
    if (!response.isSuccessful) {
        val errorMessage = response.errorBody()?.string()?.takeIf { it.isNotBlank() }
        return "❌ Error: ${errorMessage ?: response.message()}" to null
    }
    val body = response.body() ?: return "⚠️ No species identified. Try again!" to null
    val recognitionData = body.data.recognition
    val message = formatRecognitionMessage(recognitionData)
    val saveHint = body.data.imagePath.takeIf { it.isNullOrBlank() }?.let {
        "\n⚠️ Unable to save this recognition because the image reference is missing."
    }
    val finalMessage = saveHint?.let { "$message$it" } ?: message
    return finalMessage to body
}

private fun interpretSaveResponse(
    response: Response<RecognizeAndSaveResponse>,
    recognitionResponse: ScanResponse
): Pair<Boolean, String> {
    if (!response.isSuccessful) {
        val errorMessage = response.errorBody()?.string()?.takeIf { it.isNotBlank() }
        return false to ("❌ Error: ${errorMessage ?: response.message()}")
    }
    val body = response.body()
    val entry = body?.data?.entry
    if (entry?._id != null) {
        val speciesName =
            body?.data?.recognition?.species?.commonName
                ?: body?.data?.recognition?.species?.scientificName
                ?: recognitionResponse.data.recognition?.species?.commonName
                ?: recognitionResponse.data.recognition?.species?.scientificName

        val message = speciesName?.let { "✅ Saved $it to catalog." }
            ?: (body?.message?.takeIf { it.isNotBlank() } ?: "✅ Saved observation to catalog.")
        return true to message
    }
    return false to (body?.message ?: "Failed to save observation.")
}

private fun Double.toTextRequestBody() =
    toString().toRequestBody("text/plain".toMediaTypeOrNull())
