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
class CreateCatalogTest {

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
    fun createCatalogTest() {
        // --- Step 1: Wait for manual login ---
        composeRule.waitUntil(timeoutMillis = 60_000) {
            composeRule.onAllNodesWithText("Identify").fetchSemanticsNodes().isNotEmpty()
        }

        // ==== STEP 4: Go to Catalogs screen ====
        composeRule.onNodeWithText("View Catalogs").performClick()

        // Wait for Catalogs screen to load
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("My Catalogs").fetchSemanticsNodes().isNotEmpty()
        }

        // ==== STEP 5: Click the "+" FAB to open new catalog dialog ====
        composeRule.onNodeWithContentDescription("Add Catalog").performClick()

        // Wait for dialog to appear
        composeRule.waitUntil(timeoutMillis = 5_000) {
            composeRule.onAllNodesWithText("Catalog Name").fetchSemanticsNodes().isNotEmpty()
        }

        // ==== STEP 6: Type name TEST ====
        composeRule.onNodeWithText("Catalog Name").performTextInput("TEST")

        // ==== STEP 7: Click "Create" ====
        composeRule.onNodeWithText("Create").performClick()

        // ==== STEP 8: Verify catalog appears ====
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("TEST").fetchSemanticsNodes().isNotEmpty()
        }

        composeRule.onNodeWithText("TEST").assertIsDisplayed()
    }
}
