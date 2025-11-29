@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens.camera

import android.net.Uri
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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.util.ImagePicker

@Composable
fun CameraScreenLayout(
    onBack: () -> Unit,
    imageUri: Uri?,
    resultText: String?,
    isSaving: Boolean,
    isRecognizing: Boolean,
    imagePicker: ImagePicker,
    onImageSelected: (Uri?) -> Unit,
    onRecognizeClick: () -> Unit,
    onSaveImageOnly: () -> Unit
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
            isRecognizing = isRecognizing,
            imagePicker = imagePicker,
            onImageSelected = onImageSelected,
            onRecognizeClick = onRecognizeClick,
            onSaveImageOnly = onSaveImageOnly
        )
    }
}

@Composable
private fun CameraScreenBody(
    paddingValues: PaddingValues,
    imageUri: Uri?,
    resultText: String?,
    isSaving: Boolean,
    isRecognizing: Boolean,
    imagePicker: ImagePicker,
    onImageSelected: (Uri?) -> Unit,
    onRecognizeClick: () -> Unit,
    onSaveImageOnly: () -> Unit
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
            enabled = !isSaving && !isRecognizing,
            onClick = onRecognizeClick
        )
        Spacer(modifier = Modifier.height(12.dp))
        SaveImageOnlyButton(
            enabled = !isSaving && !isRecognizing,
            onClick = onSaveImageOnly
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
private fun SaveImageOnlyButton(
    enabled: Boolean,
    onClick: () -> Unit
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(0.8f)
    ) {
        Text("Save Without Recognition")
    }
}
