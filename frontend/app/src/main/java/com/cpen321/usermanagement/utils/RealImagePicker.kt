package com.cpen321.usermanagement.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cpen321.usermanagement.ui.screens.camera.ImageCompression


class RealImagePicker : ImagePicker {

    @Composable
    override fun CameraButton(onResult: (Uri) -> Unit) {
        val context = LocalContext.current
        val launcher = rememberLauncherForActivityResult(
            ActivityResultContracts.TakePicturePreview()
        ) { bitmap ->
            bitmap?.let { onResult(saveBitmapToCache(context, it)) }
        }

        ElevatedButton(onClick = { launcher.launch(null) }) {
            Icon(Icons.Default.CameraAlt, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Take Photo")
        }
    }

    @Composable
    override fun GalleryButton(onResult: (Uri) -> Unit) {
        val launcher = rememberLauncherForActivityResult(
            ActivityResultContracts.GetContent()
        ) { uri -> uri?.let { onResult(it) } }

        OutlinedButton(onClick = { launcher.launch("image/*") }) {
            Icon(Icons.Default.Image, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Gallery")
        }
    }

    private fun saveBitmapToCache(context: Context, bitmap: Bitmap): Uri =
        ImageCompression.saveBitmapToCache(context, bitmap)
}
