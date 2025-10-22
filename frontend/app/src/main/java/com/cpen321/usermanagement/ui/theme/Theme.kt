package com.cpen321.usermanagement.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.ui.viewmodels.ThemeViewModel

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = Secondary,
    onSecondary = OnSecondary,
    secondaryContainer = SecondaryContainer,
    onSecondaryContainer = OnSecondaryContainer,
    tertiary = Tertiary,
    onTertiary = OnTertiary,
    tertiaryContainer = TertiaryContainer,
    onTertiaryContainer = OnTertiaryContainer,
    background = Background,
    onBackground = OnBackground,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariant,
    outline = Outline
)

data class Spacing(
    val none: Dp = 0.dp,
    val extraSmall: Dp = 4.dp,
    val small: Dp = 8.dp,
    val medium: Dp = 16.dp,
    val large: Dp = 24.dp,
    val extraLarge: Dp = 32.dp,
    val extraLarge2: Dp = 48.dp,
    val extraLarge3: Dp = 64.dp,
    val extraLarge4: Dp = 96.dp,
    val extraLarge5: Dp = 120.dp,
)

data class FontSizes(
    val extraSmall: androidx.compose.ui.unit.TextUnit = 10.sp,
    val small: androidx.compose.ui.unit.TextUnit = 12.sp,
    val medium: androidx.compose.ui.unit.TextUnit = 14.sp,
    val regular: androidx.compose.ui.unit.TextUnit = 16.sp,
    val large: androidx.compose.ui.unit.TextUnit = 18.sp,
    val extraLarge: androidx.compose.ui.unit.TextUnit = 20.sp,
    val extraLarge2: androidx.compose.ui.unit.TextUnit = 24.sp,
    val extraLarge3: androidx.compose.ui.unit.TextUnit = 32.sp,
    val extraLarge4: androidx.compose.ui.unit.TextUnit = 48.sp,
)

val LocalSpacing = staticCompositionLocalOf { Spacing() }
val LocalFontSizes = staticCompositionLocalOf { FontSizes() }

@Composable
fun ProvideSpacing(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalSpacing provides Spacing()) {
        content()
    }
}

@Composable
fun ProvideFontSizes(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalFontSizes provides FontSizes()) {
        content()
    }
}

@Composable
fun UserManagementTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    themeViewModel: ThemeViewModel = hiltViewModel(),
    content: @Composable () -> Unit
) {
    val themeColors by themeViewModel.themeColors.collectAsState()

    val colorScheme = if (themeColors.isNotEmpty()) {
        lightColorScheme(
            primary = themeColors[0],
            secondary = themeColors[1],
            tertiary = themeColors[2],
            background = themeColors[3],
            surface = themeColors[4]
        )
    } else {
        LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val insetsController = WindowCompat.getInsetsController(window, view)

            WindowCompat.setDecorFitsSystemWindows(window, false)

            insetsController.isAppearanceLightStatusBars = !darkTheme

            if (Build.VERSION.SDK_INT < 35) {
                @Suppress("DEPRECATION")
                window.statusBarColor = android.graphics.Color.TRANSPARENT
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
