@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import coil.compose.rememberAsyncImagePainter
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.formatIsoToPrettyDate
import com.cpen321.usermanagement.ui.components.resolveImageUrl
import kotlinx.coroutines.launch

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
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var selectedEntry by remember { mutableStateOf<RemoteCatalogEntry?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var isActionInProgress by remember { mutableStateOf(false) }
    var detailErrorMessage by remember { mutableStateOf<String?>(null) }
    var pendingAction by remember { mutableStateOf<EntryAction?>(null) }

    LaunchedEffect(selectedEntry) {
        detailErrorMessage = null
    }

    LaunchedEffect(showAddDialog) {
        if (showAddDialog) {
            viewModel.loadCatalogs()
        }
    }

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
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
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
                        EntryCard(entry = entry, onClick = { selectedEntry = entry })
                    }
                }
            }
        }
    }

    val currentCatalogId = catalog?._id

    if (showAddDialog && selectedEntry != null) {
        AddToCatalogDialog(
            viewModel = viewModel,
            isSaving = isActionInProgress,
            onSave = { targetCatalogId ->
                val entryId = selectedEntry?.entry?._id ?: return@AddToCatalogDialog
                isActionInProgress = true
                detailErrorMessage = null
                viewModel.addEntryToCatalog(targetCatalogId, entryId, currentCatalogId) { success, error ->
                    isActionInProgress = false
                    if (success) {
                        showAddDialog = false
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Entry added to catalog")
                        }
                    } else {
                        detailErrorMessage = error ?: "Failed to add entry to catalog"
                    }
                }
            },
            onDismiss = {
                if (!isActionInProgress) {
                    showAddDialog = false
                }
            },
            excludeCatalogId = currentCatalogId
        )
    }

    selectedEntry?.let { entry ->
        val canRemoveFromCatalog = currentCatalogId != null
        EntryDetailDialog(
            entry = entry,
            isProcessing = isActionInProgress,
            errorMessage = detailErrorMessage,
            canRemoveFromCatalog = canRemoveFromCatalog,
            onDismiss = {
                if (!isActionInProgress) {
                    selectedEntry = null
                    showAddDialog = false
                }
            },
            onAddToCatalog = {
                showAddDialog = true
            },
            onRemoveFromCatalog = if (canRemoveFromCatalog) {
                { pendingAction = EntryAction.Remove(entry) }
            } else null,
            onDeleteEntry = {
                pendingAction = EntryAction.Delete(entry)
            }
        )
    }

    val action = pendingAction
    if (action != null && !isActionInProgress) {
        ConfirmEntryActionDialog(
            action = action,
            onConfirm = {
                val entryId = action.entry.entry._id
                when (action) {
                    is EntryAction.Remove -> {
                        val catalogId = currentCatalogId
                        if (catalogId == null) {
                            detailErrorMessage = "Catalog unavailable"
                            pendingAction = null
                            return@ConfirmEntryActionDialog
                        }
                        isActionInProgress = true
                        detailErrorMessage = null
                        viewModel.removeEntryFromCatalog(catalogId, entryId) { success, error ->
                            isActionInProgress = false
                            pendingAction = null
                            if (success) {
                                selectedEntry = null
                                showAddDialog = false
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Entry removed from catalog")
                                }
                            } else {
                                detailErrorMessage = error ?: "Failed to remove entry"
                            }
                        }
                    }
                    is EntryAction.Delete -> {
                        isActionInProgress = true
                        detailErrorMessage = null
                        viewModel.deleteEntry(entryId, currentCatalogId) { success, error ->
                            isActionInProgress = false
                            pendingAction = null
                            if (success) {
                                selectedEntry = null
                                showAddDialog = false
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Entry deleted")
                                }
                            } else {
                                detailErrorMessage = error ?: "Failed to delete entry"
                            }
                        }
                    }
                }
            },
            onDismiss = {
                if (!isActionInProgress) {
                    pendingAction = null
                }
            }
        )
    }
}

@Composable
private fun EntryCard(
    entry: RemoteCatalogEntry,
    onClick: (RemoteCatalogEntry) -> Unit
) {
    // RemoteCatalogEntry has shape: { entry: Entry, linkedAt: String?, addedBy: String? }
    val item = entry.entry
    val speciesName = item.species ?: (item._id ?: "Unknown")
    val imageUrl = item.imageUrl
    val resolvedImageUrl = remember(imageUrl) { resolveImageUrl(imageUrl) }
    val linkedAt = entry.linkedAt

    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = { onClick(entry) }
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

