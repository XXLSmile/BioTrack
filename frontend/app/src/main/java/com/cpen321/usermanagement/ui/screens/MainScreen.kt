@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import com.cpen321.usermanagement.ui.navigation.NavRoutes
import kotlinx.coroutines.delay
import androidx.compose.ui.res.painterResource

@Composable
fun MainScreen(
    mainViewModel: com.cpen321.usermanagement.ui.viewmodels.MainViewModel,
    themeViewModel: com.cpen321.usermanagement.ui.viewmodels.ThemeViewModel,
    onProfileClick: () -> Unit,
    navController: NavHostController
) {
    val uiState by mainViewModel.uiState.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Bio-Track",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ),
                actions = {
                    IconButton(onClick = onProfileClick) {
                        Icon(
                            painter = painterResource(id = com.cpen321.usermanagement.R.drawable.ic_account_circle),
                            contentDescription = "Profile"
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackBarHostState) },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { navController.navigate(NavRoutes.CAMERA) },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    imageVector = Icons.Outlined.CameraAlt,
                    contentDescription = "Open Camera",
                    tint = Color.White
                )
            }
        }
    ) { paddingValues ->
        BioTrackBody(
            modifier = Modifier.padding(paddingValues),
            navController = navController
        )
    }
}

@Composable
private fun BioTrackBody(
    modifier: Modifier = Modifier,
    navController: NavHostController
) {
    // gradient green background
    val gradient = Brush.verticalGradient(
        listOf(Color(0xFFa8e063), Color(0xFF56ab2f))
    )

    var alpha by remember { mutableStateOf(0f) }

    // fade-in animation for the text
    LaunchedEffect(Unit) {
        delay(200)
        alpha = 1f
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(gradient)
            .padding(32.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            Text(
                text = "Bio-Track",
                fontSize = 48.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White.copy(alpha = alpha),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Discover the wildlife around you 🌿",
                fontSize = 18.sp,
                color = Color.White.copy(alpha = alpha),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(40.dp))

            Button(
                onClick = { navController.navigate(NavRoutes.CATALOG_LIST) },
                colors = ButtonDefaults.buttonColors(containerColor = Color.White.copy(alpha = 0.9f))
            ) {
                Text(
                    "View My Catalogs",
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
