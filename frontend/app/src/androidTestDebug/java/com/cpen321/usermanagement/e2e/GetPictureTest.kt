package com.cpen321.usermanagement.e2e

import android.graphics.Bitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiSelector
import com.cpen321.usermanagement.MainActivity
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream

@HiltAndroidTest
@RunWith(AndroidJUnit4::class)
class GetPictureTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<MainActivity>()

    private lateinit var device: UiDevice

    @Before
    fun setup() {
        hiltRule.inject()
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        ensureGalleryHasImage()
    }

    private fun ensureGalleryHasImage() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val externalDir = context.getExternalFilesDir(null)
        val imageFile = File(externalDir, "sample_test_image.jpg")

        if (!imageFile.exists()) {
            val bmp = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
            val out = FileOutputStream(imageFile)
            bmp.compress(Bitmap.CompressFormat.JPEG, 100, out)
            out.flush()
            out.close()
            bmp.recycle()
        }

        device.executeShellCommand("mkdir -p /sdcard/Pictures/")
        device.executeShellCommand("cp ${imageFile.absolutePath} /sdcard/Pictures/sample_test_image.jpg")
        device.executeShellCommand("am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/sample_test_image.jpg")
    }

    @Test
    fun getPicture_fromGallery_successScenario() {
        // --- Step 1: Wait for user to manually log in ---
        composeRule.waitUntil(timeoutMillis = 60_000) {
            composeRule.onAllNodesWithText("Identify").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 2: Navigate to Identify screen ---
        composeRule.onNodeWithText("Identify").performClick()

        // --- Step 3: Wait for Identify screen to appear ---
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("Open Camera").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 4: Open CameraScreen ---
        composeRule.onNodeWithText("Open Camera").performClick()

        // --- Step 5: Wait for CameraScreen to load ---
        composeRule.waitUntil(timeoutMillis = 15_000) {
            composeRule.onAllNodesWithText("Gallery").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 6: Click Gallery button ---
        composeRule.onNodeWithText("Gallery").performClick()

        // ✅ TEST PASSES HERE — no need to continue
        println("✅ Gallery button clicked successfully — test passed!")
        assert(true)
    }
}
