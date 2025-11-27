package com.cpen321.usermanagement.ui.screens.camera

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

object ImageCompression {
    const val MAX_UPLOAD_DIMENSION_PX = 1600
    const val MAX_UPLOAD_BYTES = 1_500_000 // ~1.5 MB

    private const val INITIAL_JPEG_QUALITY = 85
    private const val MIN_JPEG_QUALITY = 60
    private const val QUALITY_STEP = 5

    fun decodeScaledBitmap(context: Context, uri: Uri): Bitmap {
        val resolver = context.contentResolver
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val boundsDecoded = decodeWithDescriptor(resolver, uri, bounds) ||
            decodeWithStream(resolver, uri, bounds)

        if (!boundsDecoded) {
            throw IllegalArgumentException("Unable to read selected image.")
        }

        val sampleSize = calculateInSampleSize(bounds, MAX_UPLOAD_DIMENSION_PX, MAX_UPLOAD_DIMENSION_PX)
        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val bitmap = decodeBitmap(resolver, uri, decodeOptions)
            ?: throw IllegalArgumentException("Unable to decode selected image.")

        return scaleBitmap(bitmap, MAX_UPLOAD_DIMENSION_PX)
    }

    fun scaleBitmap(bitmap: Bitmap, maxDimension: Int = MAX_UPLOAD_DIMENSION_PX): Bitmap {
        val largestSide = max(bitmap.width, bitmap.height)
        if (largestSide <= maxDimension) {
            return bitmap
        }

        val scale = maxDimension.toFloat() / largestSide
        val width = (bitmap.width * scale).roundToInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, width, height, true)
    }

    fun compressBitmapToFile(bitmap: Bitmap, file: File, maxBytes: Int = MAX_UPLOAD_BYTES) {
        val buffer = ByteArrayOutputStream()
        var quality = INITIAL_JPEG_QUALITY

        fun Bitmap.writeToBuffer() {
            buffer.reset()
            if (!compress(Bitmap.CompressFormat.JPEG, quality, buffer)) {
                throw IllegalStateException("Failed to compress image.")
            }
        }

        bitmap.writeToBuffer()
        while (buffer.size() > maxBytes && quality > MIN_JPEG_QUALITY) {
            quality -= QUALITY_STEP
            bitmap.writeToBuffer()
        }

        if (buffer.size() > maxBytes) {
            throw IllegalArgumentException("Selected image is too large even after compression. Please choose a smaller file.")
        }

        FileOutputStream(file).use { output ->
            output.write(buffer.toByteArray())
        }
    }

    fun saveBitmapToCache(context: Context, bitmap: Bitmap): Uri {
        val scaled = scaleBitmap(bitmap)
        val tempFile = File.createTempFile("camera_capture_", ".jpg", context.cacheDir)
        compressBitmapToFile(scaled, tempFile)
        if (scaled !== bitmap && !bitmap.isRecycled) {
            bitmap.recycle()
        }
        return Uri.fromFile(tempFile)
    }

    private fun calculateInSampleSize(
        options: BitmapFactory.Options,
        reqWidth: Int,
        reqHeight: Int
    ): Int {
        val (height: Int, width: Int) = options.run { outHeight to outWidth }
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            var halfHeight = height / 2
            var halfWidth = width / 2

            while ((halfHeight / inSampleSize) >= reqHeight && (halfWidth / inSampleSize) >= reqWidth) {
                inSampleSize *= 2
            }
        }

        return inSampleSize.coerceAtLeast(1)
    }

    private fun decodeBitmap(
        resolver: ContentResolver,
        uri: Uri,
        options: BitmapFactory.Options
    ): Bitmap? {
        resolver.openFileDescriptor(uri, "r")?.use { descriptor ->
            BitmapFactory.decodeFileDescriptor(descriptor.fileDescriptor, null, options)?.let { return it }
        }

        resolver.openInputStream(uri)?.use { stream ->
            BitmapFactory.decodeStream(stream, null, options)?.let { return it }
        }

        return null
    }

    private fun decodeWithDescriptor(
        resolver: ContentResolver,
        uri: Uri,
        options: BitmapFactory.Options
    ): Boolean {
        val descriptor = resolver.openFileDescriptor(uri, "r") ?: return false
        descriptor.use {
            BitmapFactory.decodeFileDescriptor(it.fileDescriptor, null, options)
        }
        return true
    }

    private fun decodeWithStream(
        resolver: ContentResolver,
        uri: Uri,
        options: BitmapFactory.Options
    ): Boolean {
        val stream = resolver.openInputStream(uri) ?: return false
        stream.use {
            BitmapFactory.decodeStream(it, null, options)
        }
        return true
    }
}
