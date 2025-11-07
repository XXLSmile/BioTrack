@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.dto.SaveRecognitionRequest
import com.cpen321.usermanagement.data.remote.dto.ScanData
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.cpen321.usermanagement.util.ImagePicker
import com.cpen321.usermanagement.util.RealImagePicker
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream

@Composable
fun CameraScreen(
    onBack: () -> Unit,
    viewModel: CatalogViewModel = hiltViewModel(),
    imagePicker: ImagePicker = RealImagePicker()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    var currentLocation by remember { mutableStateOf<Location?>(null) }
    val uiState = rememberCameraUiState()

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            scope.launch {
                currentLocation = fetchCurrentLocation(fusedLocationClient)
            }
        }
    }

    val additionalCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }

    CameraScreenSideEffects(
        catalogShareViewModel = catalogShareViewModel,
        viewModel = viewModel,
        uiState = uiState,
        context = context,
        fusedLocationClient = fusedLocationClient,
        onLocationUpdated = { currentLocation = it }
    )

    CameraScreenLayout(
        onBack = onBack,
        imageUri = uiState.imageUri,
        resultText = uiState.resultText,
        isSaving = uiState.isSaving,
        imagePicker = imagePicker,
        onImageSelected = uiState::updateImage,
        onRecognizeClick = {
            performRecognition(
                context = context,
                scope = scope,
                uiState = uiState,
                fusedLocationClient = fusedLocationClient,
                currentLocation = currentLocation,
                onLocationUpdated = { currentLocation = it },
                hasLocationPermission = { hasLocationPermission(context) },
                requestLocationPermission = {
                    locationPermissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        )
                    )
                }
            )
        }
    )

    if (uiState.showCatalogDialog && uiState.recognitionResult != null) {
        AddToCatalogDialog(
            viewModel = viewModel,
            isSaving = uiState.isSaving,
            onSave = { catalogId ->
                handleCatalogSave(
                    catalogId = catalogId,
                    uiState = uiState,
                    hasLocationPermission = hasLocationPermission(context),
                    fusedLocationClient = fusedLocationClient,
                    currentLocation = currentLocation,
                    onLocationUpdated = { currentLocation = it },
                    viewModel = viewModel,
                    profileViewModel = profileViewModel,
                    scope = scope
                )
            },
            onDismiss = {
                if (!uiState.isSaving) {
                    uiState.dismissCatalogDialog()
                }
            },
            additionalCatalogs = additionalCatalogOptions
        )
    }
}

@Composable
private fun CameraScreenLayout(
    onBack: () -> Unit,
    imageUri: Uri?,
    resultText: String?,
    isSaving: Boolean,
    imagePicker: ImagePicker,
    onImageSelected: (Uri?) -> Unit,
    onRecognizeClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Scan Wildlife") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        CameraScreenBody(
            paddingValues = paddingValues,
            imageUri = imageUri,
            resultText = resultText,
            isSaving = isSaving,
            imagePicker = imagePicker,
            onImageSelected = onImageSelected,
            onRecognizeClick = onRecognizeClick
        )
    }
}

@Composable
private fun CameraScreenBody(
    paddingValues: PaddingValues,
    imageUri: Uri?,
    resultText: String?,
    isSaving: Boolean,
    imagePicker: ImagePicker,
    onImageSelected: (Uri?) -> Unit,
    onRecognizeClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CameraPreview(imageUri)
        Spacer(modifier = Modifier.height(16.dp))
        CameraActionButtons(imagePicker = imagePicker, onImageSelected = onImageSelected)
        Spacer(modifier = Modifier.height(24.dp))
        RecognizeButton(
            enabled = imageUri != null && !isSaving,
            onClick = onRecognizeClick
        )
        Spacer(modifier = Modifier.height(24.dp))
        resultText?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun CameraPreview(imageUri: Uri?) {
    if (imageUri == null) {
        return
    }

    Card(
        shape = MaterialTheme.shapes.medium,
        elevation = CardDefaults.cardElevation(6.dp),
        modifier = Modifier
            .size(250.dp)
            .padding(8.dp)
    ) {
        Image(
            painter = rememberAsyncImagePainter(imageUri),
            contentDescription = "Selected image",
            modifier = Modifier.fillMaxSize()
        )
    }
}

@Composable
private fun CameraActionButtons(
    imagePicker: ImagePicker,
    onImageSelected: (Uri?) -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        imagePicker.CameraButton { uri -> onImageSelected(uri) }
        imagePicker.GalleryButton { uri -> onImageSelected(uri) }
    }
}

@Composable
private fun RecognizeButton(
    enabled: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(0.8f)
    ) {
        Icon(Icons.Default.Search, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text("Recognize Animal")
    }
}

@Composable
private fun CameraScreenSideEffects(
    catalogShareViewModel: CatalogShareViewModel,
    viewModel: CatalogViewModel,
    uiState: CameraUiState,
    context: Context,
    fusedLocationClient: FusedLocationProviderClient,
    onLocationUpdated: (Location?) -> Unit
) {
    LaunchedEffect(Unit) {
        catalogShareViewModel.loadSharedWithMe()
        if (hasLocationPermission(context)) {
            onLocationUpdated(fetchCurrentLocation(fusedLocationClient))
        }
    }

    LaunchedEffect(uiState.showCatalogDialog) {
        if (uiState.showCatalogDialog) {
            viewModel.loadCatalogs()
        }
    }
}

private fun performRecognition(
    context: Context,
    scope: CoroutineScope,
    uiState: CameraUiState,
    fusedLocationClient: FusedLocationProviderClient,
    currentLocation: Location?,
    onLocationUpdated: (Location?) -> Unit,
    hasLocationPermission: () -> Boolean,
    requestLocationPermission: () -> Unit
) {
    if (!hasLocationPermission()) {
        requestLocationPermission()
        uiState.updateResult("Grant location permission to attach coordinates.")
        return
    }

    val uri = uiState.imageUri
    if (uri == null) {
        uiState.updateResult("Select a photo before scanning.")
        return
    }

    scope.launch {
        val locationToUse = currentLocation ?: fetchCurrentLocation(fusedLocationClient).also {
            onLocationUpdated(it)
        }
        uiState.updateResult("Recognizing...")
        val (message, response) = recognizeImage(context, uri, locationToUse)
        uiState.showRecognitionResult(message, response)
    }
}

private fun handleCatalogSave(
    catalogId: String,
    uiState: CameraUiState,
    hasLocationPermission: Boolean,
    fusedLocationClient: FusedLocationProviderClient,
    currentLocation: Location?,
    onLocationUpdated: (Location?) -> Unit,
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    scope: CoroutineScope
) {
    if (uiState.isSaving) return
    val recognition = uiState.recognitionResult
    if (recognition == null) {
        uiState.updateResult("⚠️ Run recognition before saving.")
        return
    }
    if (recognition.data.imagePath.isNullOrBlank()) {
        uiState.updateResult("⚠️ Unable to save because the image reference is missing.")
        return
    }

    uiState.setSavingState(true)
    scope.launch {
        val locationToUse = if (hasLocationPermission) {
            currentLocation ?: fetchCurrentLocation(fusedLocationClient).also(onLocationUpdated)
        } else {
            currentLocation
        }

        val (success, message) = saveRecognitionToCatalog(recognition, catalogId, locationToUse)
        uiState.updateResult(message)
        if (success) {
            uiState.resetAfterSave()
            viewModel.loadCatalogs()
            profileViewModel.refreshStats()
        }
        uiState.setSavingState(false)
    }
}

@Stable
private class CameraUiState {
    var imageUri by mutableStateOf<Uri?>(null)
        private set
    var resultText by mutableStateOf<String?>(null)
        private set
    var recognitionResult by mutableStateOf<ScanResponse?>(null)
        private set
    var showCatalogDialog by mutableStateOf(false)
        private set
    var isSaving by mutableStateOf(false)
        private set

    fun updateImage(uri: Uri?) {
        imageUri = uri
    }

    fun updateResult(message: String?) {
        resultText = message
    }

    fun showRecognitionResult(message: String, response: ScanResponse?) {
        resultText = message
        recognitionResult = response
        showCatalogDialog = response?.data?.imagePath?.isNotBlank() == true
    }

    fun dismissCatalogDialog() {
        showCatalogDialog = false
        recognitionResult = null
    }

    fun resetAfterSave() {
        showCatalogDialog = false
        recognitionResult = null
        imageUri = null
    }

    fun setSavingState(value: Boolean) {
        isSaving = value
    }
}

@Composable
private fun rememberCameraUiState(): CameraUiState {
    return remember { CameraUiState() }
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

        if (response.isSuccessful) {
            val body = response.body()
            val payload = body?.data
            val recognitionData = payload?.recognition
            if (recognitionData != null) {
                val message = formatRecognitionMessage(recognitionData)
                val saveHint = if (payload.imagePath.isNullOrBlank()) {
                    "\n⚠️ Unable to save this recognition because the image reference is missing."
                } else {
                    null
                }
                val finalMessage = saveHint?.let { "$message$it" } ?: message
                finalMessage to body
            } else {
                "⚠️ No species identified. Try again!" to null
            }
        } else {
            val errorMessage = response.errorBody()?.string()?.takeIf { it.isNotBlank() }
            "❌ Error: ${errorMessage ?: response.message()}" to null
        }
    } catch (e: Exception) {
        "⚠️ Upload failed: ${e.localizedMessage ?: "Unknown error"}" to null
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
    if (imagePath.isNullOrBlank()) {
        return false to "⚠️ Cannot save this observation because the image reference is missing."
    }

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

        if (response.isSuccessful) {
            val body = response.body()
            if (body?.data?.entry?._id != null) {
                val speciesName =
                    body?.data?.recognition?.species?.commonName
                        ?: body?.data?.recognition?.species?.scientificName
                        ?: recognitionResponse.data.recognition?.species?.commonName
                        ?: recognitionResponse.data.recognition?.species?.scientificName

                val message = speciesName?.let { "✅ Saved $it to catalog." }
                    ?: (body?.message?.takeIf { it.isNotBlank() } ?: "✅ Saved observation to catalog.")
                true to message
            }
            else {
                false to (body?.message ?: "Failed to save observation.")
            }
        } else {
            val errorMessage = response.errorBody()?.string()?.takeIf { it.isNotBlank() }
            false to ("❌ Error: ${errorMessage ?: response.message()}")
        }
    } catch (e: Exception) {
        false to ("⚠️ Save failed: ${e.localizedMessage ?: "Unknown error"}")
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

private fun hasLocationPermission(context: Context): Boolean {
    val fineGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACCESS_COARSE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
    return fineGranted || coarseGranted
}

@SuppressLint("MissingPermission")
private suspend fun fetchCurrentLocation(
    client: FusedLocationProviderClient
): Location? {
    return try {
        val tokenSource = CancellationTokenSource()
        try {
            client.getCurrentLocation(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                tokenSource.token
            ).await()
                ?: client.lastLocation.await()
        } finally {
            tokenSource.cancel()
        }
    } catch (exception: Exception) {
        null
    }
}

private fun Double.toTextRequestBody() =
    toString().toRequestBody("text/plain".toMediaTypeOrNull())
