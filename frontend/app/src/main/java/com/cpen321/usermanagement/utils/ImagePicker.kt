package com.cpen321.usermanagement.util

import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.runtime.Composable

interface ImagePicker {
    @Composable
    fun CameraButton(onResult: (Uri) -> Unit)

    @Composable
    fun GalleryButton(onResult: (Uri) -> Unit)
}
