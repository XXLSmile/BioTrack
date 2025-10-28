@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.location.Location
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import android.annotation.SuppressLint


@Composable
fun CameraScreen(
    onBack: () -> Unit,
    viewModel: CatalogViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    var currentLocation by remember { mutableStateOf<Location?>(null) }

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

    LaunchedEffect(Unit) {
        catalogShareViewModel.loadSharedWithMe()
        if (hasLocationPermission(context)) {
            currentLocation = fetchCurrentLocation(fusedLocationClient)
        }
    }

    val additionalCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }

    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var resultText by remember { mutableStateOf<String?>(null) }
    var showCatalogDialog by remember { mutableStateOf(false) }
    var recognitionResult by remember { mutableStateOf<ScanResponse?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicturePreview()
    ) { bitmap ->
        bitmap?.let {
            val uri = saveBitmapToCache(context, it)
            imageUri = uri
        }
    }

    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? -> imageUri = uri }

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
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            imageUri?.let {
                Card(
                    shape = MaterialTheme.shapes.medium,
                    elevation = CardDefaults.cardElevation(6.dp),
                    modifier = Modifier
                        .size(250.dp)
                        .padding(8.dp)
                ) {
                    Image(
                        painter = rememberAsyncImagePainter(it),
                        contentDescription = "Selected image",
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                ElevatedButton(onClick = { cameraLauncher.launch(null) }) {
                    Icon(Icons.Default.CameraAlt, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Take Photo")
                }

                OutlinedButton(onClick = { galleryLauncher.launch("image/*") }) {
                    Icon(Icons.Default.Image, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Gallery")
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    val hasPermission = hasLocationPermission(context)
                    if (!hasPermission) {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                        resultText = "Grant location permission to attach coordinates."
                        return@Button
                    }

                    imageUri?.let { uri ->
                        scope.launch {
                            val locationToUse = currentLocation ?: fetchCurrentLocation(fusedLocationClient).also {
                                currentLocation = it
                            }

                            resultText = "Recognizing..."
                            val (message, response) = recognizeImage(context, uri, locationToUse)
                            resultText = message
                            recognitionResult = response
                            showCatalogDialog = response != null
                        }
                    }
                },
                enabled = imageUri != null && !isSaving,
                modifier = Modifier.fillMaxWidth(0.8f)
            ) {
                Icon(Icons.Default.Search, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Recognize Animal")
            }

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

    LaunchedEffect(showCatalogDialog) {
        if (showCatalogDialog) {
            viewModel.loadCatalogs()
        }
    }

    // Show Add to Catalog dialog after a successful scan
    if (showCatalogDialog && recognitionResult != null) {
        AddToCatalogDialog(
            viewModel = viewModel,
            isSaving = isSaving,
            onSave = { catalogId ->
                if (isSaving) return@AddToCatalogDialog
                val uriToSave = imageUri
                if (uriToSave == null) {
                    resultText = "⚠️ Select an image before saving."
                    return@AddToCatalogDialog
                }
                isSaving = true
                scope.launch {
                    val locationToUse = if (hasLocationPermission(context)) {
                        currentLocation ?: fetchCurrentLocation(fusedLocationClient).also {
                            currentLocation = it
                        }
                    } else {
                        currentLocation
                    }

                    val (success, message) = saveRecognitionToCatalog(
                        context,
                        uriToSave,
                        catalogId,
                        locationToUse
                    )
                    resultText = message
                    if (success) {
                        showCatalogDialog = false
                        recognitionResult = null
                        imageUri = null
                        viewModel.loadCatalogs()
                        profileViewModel.refreshStats()
                    }
                    isSaving = false
                }
            },
            onDismiss = {
                if (!isSaving) {
                    showCatalogDialog = false
                    recognitionResult = null
                }
            },
            additionalCatalogs = additionalCatalogOptions
        )
    }
}

private fun saveBitmapToCache(context: Context, bitmap: Bitmap): Uri {
    val file = File(context.cacheDir, "captured_image.jpg")
    FileOutputStream(file).use { out ->
        bitmap.compress(Bitmap.CompressFormat.JPEG, 100, out)
    }
    return Uri.fromFile(file)
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
            if (body?.data?.species != null) {
                formatRecognitionMessage(body) to body
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
    context: Context,
    uri: Uri,
    catalogId: String,
    location: Location?
): Pair<Boolean, String> {
    var tempFile: File? = null
    return try {
        val (imagePart, file) = createImagePart(context, uri)
        tempFile = file
        val catalogIdBody = catalogId.toRequestBody("text/plain".toMediaTypeOrNull())
        val latitudeBody = location?.latitude?.toTextRequestBody()
        val longitudeBody = location?.longitude?.toTextRequestBody()

        val response = withContext(Dispatchers.IO) {
            RetrofitClient.wildlifeApi.recognizeAndSave(
                imagePart,
                catalogIdBody,
                latitudeBody,
                longitudeBody
            )
        }

        if (response.isSuccessful) {
            val body = response.body()
            if (body?.data?.entry?._id != null) {
                val speciesName = body.data.recognition?.species?.let {
                    it.commonName ?: it.scientificName
                }
                val message = speciesName?.let { "✅ Saved $it to catalog." }
                    ?: (body?.message?.takeIf { it.isNotBlank() } ?: "✅ Saved observation to catalog.")
                true to message
            } else {
                false to (body?.message ?: "Failed to save observation.")
            }
        } else {
            val errorMessage = response.errorBody()?.string()?.takeIf { it.isNotBlank() }
            false to ("❌ Error: ${errorMessage ?: response.message()}")
        }
    } catch (e: Exception) {
        false to ("⚠️ Save failed: ${e.localizedMessage ?: "Unknown error"}")
    } finally {
        tempFile?.delete()
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

private fun formatRecognitionMessage(response: ScanResponse): String {
    val species = response.data.species
    return if (species != null) {
        val displayName = species.commonName ?: species.scientificName
        val confidencePercent = String.format("%.2f", response.data.confidence * 100)
        "✅ $displayName\n(${species.scientificName})\nConfidence: $confidencePercent%"
    } else {
        "⚠️ No species identified. Try again!"
    }
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
