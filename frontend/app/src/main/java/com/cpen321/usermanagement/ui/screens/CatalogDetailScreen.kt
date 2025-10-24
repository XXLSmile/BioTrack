@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import java.text.SimpleDateFormat
import java.util.*
import com.cpen321.usermanagement.BuildConfig

@Composable
fun CatalogDetailScreen(
    catalogId: String,
    viewModel: CatalogViewModel,
    navController: NavController
) {
    // Load detail when composable enters composition
    LaunchedEffect(catalogId) {
        viewModel.loadCatalogDetail(catalogId)
    }

    val catalogDetailState by viewModel.catalogDetail.collectAsState()
    val catalog = catalogDetailState?.catalog
    val entries = catalogDetailState?.entries ?: emptyList()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(catalog?.name ?: "Catalog") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { padding ->
        when {
            catalog == null -> {
                // Catalog not found or still loading
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            entries.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No wildlife added yet.\nScan and save your discoveries 🌿",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            else -> {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 150.dp),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(entries) { entry -> // entry: RemoteCatalogEntry
                        EntryCard(entry = entry)
                    }
                }
            }
        }
    }
}

@Composable
private fun EntryCard(entry: RemoteCatalogEntry) {
    // RemoteCatalogEntry has shape: { entry: Entry, linkedAt: String?, addedBy: String? }
    val item = entry.entry
    val speciesName = item.species ?: (item._id ?: "Unknown")
    val imageUrl = item.imageUrl
    val resolvedImageUrl = remember(imageUrl) { resolveImageUrl(imageUrl) }
    val linkedAt = entry.linkedAt

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = {
            // TODO: Navigate to a detailed animal info screen later
        }
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(8.dp)
        ) {
            if (!resolvedImageUrl.isNullOrBlank()) {
                Image(
                    painter = rememberAsyncImagePainter(resolvedImageUrl),
                    contentDescription = speciesName,
                    modifier = Modifier
                        .size(100.dp)
                        .background(Color.LightGray, shape = MaterialTheme.shapes.medium),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .background(MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium),
                    contentAlignment = Alignment.Center
                ) {
                    Text("🐾", fontSize = MaterialTheme.typography.headlineMedium.fontSize)
                }
            }

            Text(
                speciesName,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                maxLines = 1
            )

            Text(
                linkedAt?.let { formatIsoToPrettyDate(it) } ?: "Unknown Date",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatIsoToPrettyDate(iso: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
        val date = sdf.parse(iso)
        val out = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
        out.format(date!!)
    } catch (e: Exception) {
        iso.take(10)
    }
}

private fun resolveImageUrl(rawUrl: String?): String? {
    if (rawUrl.isNullOrBlank()) return null

    val baseUrl = BuildConfig.IMAGE_BASE_URL.trimEnd('/')

    return try {
        val uri = Uri.parse(rawUrl)
        val host = uri.host?.lowercase(Locale.ROOT)
        when {
            uri.scheme.isNullOrBlank() -> {
                "$baseUrl/${rawUrl.trimStart('/')}"
            }
            host == "localhost" || host == "127.0.0.1" -> {
                val path = uri.path ?: ""
                val fullPath = if (path.startsWith("/")) path else "/$path"
                "$baseUrl$fullPath"
            }
            else -> rawUrl
        }
    } catch (e: Exception) {
        "$baseUrl/${rawUrl.trimStart('/')}"
    }
}
