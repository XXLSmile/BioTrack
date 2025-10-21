@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.remote.dto.ScanResponse


@Composable
fun CameraScreen(
    onBack: () -> Unit,
    viewModel: CatalogViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var imageUri by remember { mutableStateOf<Uri?>(null) }
    var resultText by remember { mutableStateOf<String?>(null) }
    var showCatalogDialog by remember { mutableStateOf(false) }

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
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
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
                    imageUri?.let { uri ->
                        scope.launch {
                            resultText = "Recognizing..."
                            val result = uploadImageToApi(context, uri)
                            resultText = result
                            // Always show catalog dialog, even on failure
                            showCatalogDialog = true
                        }
                    }
                },
                enabled = imageUri != null,
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

    // Show Add to Catalog dialog after scan
    if (showCatalogDialog) {
        AddToCatalogDialog(
            viewModel = viewModel,
            onSave = { catalogId ->
                // Here you would save the result + photo to catalog
                showCatalogDialog = false
                imageUri = null
                resultText = null
            },
            onDismiss = {
                showCatalogDialog = false
                imageUri = null
                resultText = null
            }
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

private suspend fun uploadImageToApi(context: Context, uri: Uri): String {
    return try {
        val inputStream = context.contentResolver.openInputStream(uri)
        val file = File(context.cacheDir, "upload.jpg")
        val outputStream = FileOutputStream(file)
        inputStream?.copyTo(outputStream)
        outputStream.close()

        val requestFile = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
        val body = MultipartBody.Part.createFormData("image", file.name, requestFile)

        // Call your backend API now
        val response = RetrofitClient.wildlifeApi.recognizeAnimal(body)

        if (response.isSuccessful && response.body() != null) {
            val result = response.body()!!
            val species = result.data.species
            val confidence = String.format("%.2f", result.data.confidence * 100)

            if (species != null) {
                "✅ ${species.commonName ?: species.scientificName}\n" +
                        "(${species.scientificName})\n" +
                        "Confidence: $confidence%"
            } else {
                "⚠️ No species identified. Try again!"
            }
        } else {
            "❌ Error: ${response.message()}"
        }
    } catch (e: Exception) {
        "⚠️ Upload failed: ${e.localizedMessage}"
    }
}




