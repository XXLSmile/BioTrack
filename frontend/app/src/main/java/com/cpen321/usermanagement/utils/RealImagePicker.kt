package com.cpen321.usermanagement.util

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.io.File
import java.io.FileOutputStream
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width


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

    private fun saveBitmapToCache(context: Context, bitmap: Bitmap): Uri {
        val file = File(context.cacheDir, "captured_image.jpg")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 100, it) }
        return Uri.fromFile(file)
    }
}
