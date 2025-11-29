@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.ui.screens.catalog.AddToCatalogDialog
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import com.cpen321.usermanagement.util.ImagePicker
import com.cpen321.usermanagement.util.RealImagePicker
import com.google.android.gms.location.FusedLocationProviderClient
import kotlinx.coroutines.launch

@Composable
fun CameraScreen(
    onBack: () -> Unit,
    viewModel: CatalogViewModel = hiltViewModel(),
    imagePicker: ImagePicker = RealImagePicker()
) {
    val controller = rememberCameraScreenController(viewModel)
    CameraScreenHost(
        controller = controller,
        onBack = onBack,
        imagePicker = imagePicker
    )
}

@Composable
private fun CameraScreenHost(
    controller: CameraScreenController,
    onBack: () -> Unit,
    imagePicker: ImagePicker
) {
    val requestLocationPermission = rememberLocationPermissionRequest(controller)

    CameraScreenSideEffects(
        catalogShareViewModel = controller.catalogShareViewModel,
        viewModel = controller.viewModel,
        uiState = controller.uiState,
        context = controller.context,
        fusedLocationClient = controller.fusedLocationClient,
        onLocationUpdated = { controller.currentLocation = it }
    )

    val layoutState = CameraLayoutState(
        imageUri = controller.uiState.imageUri,
        resultText = controller.uiState.resultText,
        isSaving = controller.uiState.isSaving,
        isRecognizing = controller.uiState.isRecognizing
    )
    val layoutCallbacks = CameraLayoutCallbacks(
        onBack = onBack,
        onImageSelected = controller.uiState::updateImage,
        onRecognizeClick = { triggerRecognition(controller, requestLocationPermission) },
        onSaveImageOnly = {
            val context = ImageOnlySaveContext(
                appContext = controller.context,
                scope = controller.scope,
                uiState = controller.uiState,
                fusedLocationClient = controller.fusedLocationClient,
                currentLocation = controller.currentLocation,
                onLocationUpdated = { controller.currentLocation = it },
                viewModel = controller.viewModel,
                profileViewModel = controller.profileViewModel
            )
            saveImageWithoutRecognition(context)
        }
    )
    CameraScreenLayout(
        state = layoutState,
        callbacks = layoutCallbacks,
        imagePicker = imagePicker
    )

    CameraScreenCatalogDialog(controller)
}

@Composable
private fun CameraScreenSideEffects(
    catalogShareViewModel: CatalogShareViewModel,
    viewModel: CatalogViewModel,
    uiState: CameraUiState,
    context: Context,
    fusedLocationClient: FusedLocationProviderClient,
    onLocationUpdated: (android.location.Location?) -> Unit
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

@Composable
private fun rememberLocationPermissionRequest(
    controller: CameraScreenController
): () -> Unit {
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            controller.scope.launch {
                controller.currentLocation = fetchCurrentLocation(controller.fusedLocationClient)
            }
        }
    }

    return remember(launcher) {
        {
            launcher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }
}

@Composable
private fun CameraScreenCatalogDialog(controller: CameraScreenController) {
    val uiState = controller.uiState
    if (!uiState.showCatalogDialog || uiState.recognitionResult == null) return

    AddToCatalogDialog(
        viewModel = controller.viewModel,
        isSaving = uiState.isSaving,
        onSave = { catalogId ->
            val saveContext = CatalogSaveContext(
                uiState = uiState,
                hasLocationPermission = hasLocationPermission(controller.context),
                fusedLocationClient = controller.fusedLocationClient,
                currentLocation = controller.currentLocation,
                onLocationUpdated = { controller.currentLocation = it },
                viewModel = controller.viewModel,
                profileViewModel = controller.profileViewModel,
                scope = controller.scope
            )
            handleCatalogSave(catalogId = catalogId, context = saveContext)
        },
        onDismiss = {
            if (!uiState.isSaving) {
                uiState.dismissCatalogDialog()
            }
        },
        additionalCatalogs = controller.additionalCatalogOptions
    )
}

private fun triggerRecognition(
    controller: CameraScreenController,
    requestLocationPermission: () -> Unit
) {
    val recognitionContext = RecognitionContext(
        appContext = controller.context,
        scope = controller.scope,
        uiState = controller.uiState,
        fusedLocationClient = controller.fusedLocationClient,
        currentLocation = controller.currentLocation,
        onLocationUpdated = { controller.currentLocation = it },
        hasLocationPermission = { hasLocationPermission(controller.context) },
        requestLocationPermission = requestLocationPermission
    )
    performRecognition(recognitionContext)
}
