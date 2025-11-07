package com.cpen321.usermanagement.util

import android.net.Uri
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Image
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width


class FakeImagePicker : ImagePicker {
    private val fakeUri = Uri.parse("content://fake/image.jpg")

    @Composable
    override fun CameraButton(onResult: (Uri) -> Unit) {
        ElevatedButton(onClick = { onResult(fakeUri) }) {
            Icon(Icons.Default.CameraAlt, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Fake Camera")
        }
    }

    @Composable
    override fun GalleryButton(onResult: (Uri) -> Unit) {
        OutlinedButton(onClick = { onResult(fakeUri) }) {
            Icon(Icons.Default.Image, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Fake Gallery")
        }
    }
}