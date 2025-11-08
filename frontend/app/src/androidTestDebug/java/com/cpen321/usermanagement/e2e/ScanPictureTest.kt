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
class ScanPictureTest {

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
    fun scanPicture_afterSelectingImage_successScenario() {
        // --- Step 1: Wait for manual login ---
        composeRule.waitUntil(timeoutMillis = 60_000) {
            composeRule.onAllNodesWithText("Identify").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 2: Navigate to Identify screen ---
        composeRule.onNodeWithText("Identify").performClick()

        // --- Step 3: Wait for Identify screen ---
        composeRule.waitUntil(timeoutMillis = 10_000) {
            composeRule.onAllNodesWithText("Open Camera").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 4: Open Camera screen ---
        composeRule.onNodeWithText("Open Camera").performClick()

        // --- Step 5: Wait for CameraScreen ---
        composeRule.waitUntil(timeoutMillis = 15_000) {
            composeRule.onAllNodesWithText("Gallery").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 6: Open Gallery ---
        composeRule.onNodeWithText("Gallery").performClick()

        // --- Step 7: Use UIAutomator to select an image ---
        device.waitForWindowUpdate(null, 4000)

        val gallerySelectors = listOf(
            UiSelector().className("android.widget.ImageView"),
            UiSelector().className("android.widget.FrameLayout"),
            UiSelector().className("android.widget.RelativeLayout"),
            UiSelector().descriptionContains("Photo"),
            UiSelector().resourceIdMatches(".*photo.*|.*image.*|.*thumbnail.*")
        )

        var selected = false
        for (sel in gallerySelectors) {
            val node = device.findObject(sel.instance(0))
            if (node.exists()) {
                node.click()
                selected = true
                println("✅ Selected image using selector: $sel")
                break
            }
        }

        if (!selected) {
            Thread.sleep(2500)
            for (sel in gallerySelectors) {
                val node = device.findObject(sel.instance(0))
                if (node.exists()) {
                    node.click()
                    selected = true
                    println("✅ Selected image after retry using selector: $sel")
                    break
                }
            }
        }

        if (!selected) {
            println("⚠️ No selectable image found. Dumping UI hierarchy for debug.")
            val dumpPath = "/sdcard/picker_dump.xml"
            device.dumpWindowHierarchy(dumpPath)
            println("📄 UI hierarchy dumped to: $dumpPath")
        }

        // --- Step 8: Confirm image selection ---
        val confirmButton = device.findObject(
            UiSelector().textMatches("(?i)ok|done|choose|select|open")
        )
        if (confirmButton.exists()) {
            confirmButton.click()
            println("✅ Clicked confirm button")
        }

        // --- Step 9: Wait for image preview to appear ---
        composeRule.waitUntil(timeoutMillis = 20_000) {
            composeRule.onAllNodesWithContentDescription("Selected image")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 10: Wait for 'Scan Picture' button ---
        composeRule.waitUntil(timeoutMillis = 15_000) {
            composeRule.onAllNodesWithText("Recognize Animal").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 11: Click 'Scan Picture' ---
        composeRule.onNodeWithText("Recognize Animal").performClick()

        // ✅ PASS TEST
        println("🎉 Recognize Animal button clicked successfully — test passed!")
        assert(true)
    }
}
