package com.cpen321.usermanagement.ui.screens.camera

import android.content.Context
import android.location.Location
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.remote.dto.ScanResponse
import com.cpen321.usermanagement.ui.screens.catalog.CatalogOption
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@Stable
class CameraUiState {
    var imageUri by mutableStateOf<android.net.Uri?>(null)
        private set
    var resultText by mutableStateOf<String?>(null)
        private set
    var recognitionResult by mutableStateOf<ScanResponse?>(null)
        private set
    var showCatalogDialog by mutableStateOf(false)
        private set
    var isSaving by mutableStateOf(false)
        private set
    var isRecognizing by mutableStateOf(false)
        private set

    fun updateImage(uri: android.net.Uri?) {
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

    fun setRecognizingState(value: Boolean) {
        isRecognizing = value
    }
}

@Stable
class CameraScreenController(
    val viewModel: CatalogViewModel,
    val profileViewModel: ProfileViewModel,
    val catalogShareViewModel: CatalogShareViewModel,
    val context: Context,
    val scope: CoroutineScope,
    val fusedLocationClient: FusedLocationProviderClient,
    val uiState: CameraUiState
) {
    var currentLocation by mutableStateOf<Location?>(null)
    var additionalCatalogOptions by mutableStateOf<List<CatalogOption>>(emptyList())
}

@Composable
fun rememberCameraScreenController(
    viewModel: CatalogViewModel
): CameraScreenController {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    val uiState = remember { CameraUiState() }

    val controller = remember(viewModel, profileViewModel, catalogShareViewModel, fusedLocationClient) {
        CameraScreenController(
            viewModel = viewModel,
            profileViewModel = profileViewModel,
            catalogShareViewModel = catalogShareViewModel,
            context = context,
            scope = scope,
            fusedLocationClient = fusedLocationClient,
            uiState = uiState
        )
    }

    controller.additionalCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { entry -> entry.catalog?.let { CatalogOption(it._id, it.name ?: "Catalog") } }
            .filterNotNull()
    }

    return controller
}

fun hasLocationPermission(context: Context): Boolean {
    val fineGranted = ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.ACCESS_FINE_LOCATION
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    val coarseGranted = ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.ACCESS_COARSE_LOCATION
    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
    return fineGranted || coarseGranted
}

suspend fun fetchCurrentLocation(
    client: FusedLocationProviderClient
): Location? {
    val tokenSource = CancellationTokenSource()
    return runCatching {
        try {
            client.getCurrentLocation(
                com.google.android.gms.location.Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                tokenSource.token
            ).await()
                ?: client.lastLocation.await()
        } finally {
            tokenSource.cancel()
        }
    }.getOrNull()
}

fun CameraScreenController.updateAdditionalCatalogs(entries: List<CatalogShareEntry>) {
    additionalCatalogOptions = entries
        .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
        .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
}
