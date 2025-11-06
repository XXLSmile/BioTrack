package com.cpen321.usermanagement.e2e

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
    }

    @Test
    fun getPicture_successScenario() {
        // --- Step 1: Handle runtime permissions ---
        val allowPermissionButton = device.findObject(UiSelector().textMatches("(?i)allow"))
        if (allowPermissionButton.exists()) {
            allowPermissionButton.click()
        }

        // Optional: repeat for multiple permissions
        Thread.sleep(500) // small delay in case multiple dialogs
        if (allowPermissionButton.exists()) {
            allowPermissionButton.click()
        }

        // --- Step 2: Wait for splash screen to disappear ---
        composeRule.waitUntil(timeoutMillis = 10_000) {
            // Assuming SplashScreen is gone when "Camera" button appears
            composeRule.onAllNodesWithText("Camera").fetchSemanticsNodes().isNotEmpty()
        }

        // --- Step 3: Interact with main UI ---
        composeRule.onNodeWithText("Camera").performClick()

        // --- Step 4: Take picture using system camera UI ---
        val shutterBtn = device.findObject(UiSelector().descriptionContains("Shutter"))
        if (shutterBtn.exists()) shutterBtn.click()

        val okBtn = device.findObject(UiSelector().textMatches("(?i)ok|done"))
        if (okBtn.exists()) okBtn.click()

        // --- Step 5: Assert the photo is shown in app ---
        composeRule.onNodeWithContentDescription("Selected image").assertExists()
    }
}
