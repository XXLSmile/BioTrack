@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.cpen321.usermanagement.ui.components.ObservationListItem
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogEntriesViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import kotlinx.coroutines.launch

@Composable
fun CatalogEntriesScreen(
    navController: NavController,
    viewModel: CatalogEntriesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val catalogViewModel: CatalogViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var selectedEntry by remember { mutableStateOf<RemoteCatalogEntry?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var isActionInProgress by remember { mutableStateOf(false) }
    var detailErrorMessage by remember { mutableStateOf<String?>(null) }
    var pendingAction by remember { mutableStateOf<EntryAction?>(null) }
    val additionalCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }

    LaunchedEffect(Unit) {
        catalogShareViewModel.loadSharedWithMe()
    }

    LaunchedEffect(selectedEntry) {
        detailErrorMessage = null
    }

    LaunchedEffect(showAddDialog) {
        if (showAddDialog) {
            catalogViewModel.loadCatalogs()
        }
    }

    val openImage: (String?) -> Unit = { imageUrl ->
        if (imageUrl.isNullOrBlank()) {
            Toast.makeText(context, "No image available for this observation", Toast.LENGTH_SHORT).show()
        } else {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(imageUrl))
            try {
                context.startActivity(intent)
            } catch (error: ActivityNotFoundException) {
                Toast.makeText(context, "No app available to open this image", Toast.LENGTH_SHORT).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("All Observations") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(
                            imageVector = Icons.Outlined.Refresh,
                            contentDescription = "Refresh"
                        )
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
            uiState.isLoading && uiState.entries.isEmpty() -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.errorMessage != null && uiState.entries.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = uiState.errorMessage ?: "Failed to load observations",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.error
                    )
                    Button(onClick = { viewModel.refresh() }) {
                        Text("Retry")
                    }
                }
            }

            uiState.entries.isEmpty() -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No catalog entries yet.\nScan wildlife to populate your catalog!",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (uiState.isLoading) {
                        item {
                            LinearProgressIndicator(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 4.dp)
                            )
                        }
                    }

                    uiState.errorMessage?.let { message ->
                        item {
                            Text(
                                text = message,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    itemsIndexed(uiState.entries) { index, entry ->
                        ObservationListItem(
                            observation = entry,
                            onClick = { selectedEntry = entry.toCatalogEntry() },
                            trailingContent = {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                                    contentDescription = "Open image",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.clickable { openImage(entry.imageUrl) }
                                )
                            }
                        )

                        if (index != uiState.entries.lastIndex) {
                            HorizontalDivider()
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog && selectedEntry != null) {
        AddToCatalogDialog(
            viewModel = catalogViewModel,
            isSaving = isActionInProgress,
            onSave = { catalogId ->
                val entryId = selectedEntry?.entry?._id ?: return@AddToCatalogDialog
                isActionInProgress = true
                detailErrorMessage = null
                catalogViewModel.addEntryToCatalog(catalogId, entryId, null) { success, error ->
                    isActionInProgress = false
                    if (success) {
                        showAddDialog = false
                        viewModel.refresh()
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Observation added to catalog")
                        }
                    } else {
                        detailErrorMessage = error ?: "Failed to add observation to catalog"
                    }
                }
            },
            onDismiss = {
                if (!isActionInProgress) {
                    showAddDialog = false
                }
            },
            additionalCatalogs = additionalCatalogOptions
        )
    }

    selectedEntry?.let { entry ->
        EntryDetailDialog(
            entry = entry,
            isProcessing = isActionInProgress,
            errorMessage = detailErrorMessage,
            canRemoveFromCatalog = false,
            onDismiss = {
                if (!isActionInProgress) {
                    selectedEntry = null
                    showAddDialog = false
                }
            },
            onAddToCatalog = { showAddDialog = true },
            onRemoveFromCatalog = null,
            onDeleteEntry = { pendingAction = EntryAction.Delete(entry) }
        )
    }

    val action = pendingAction
    if (action is EntryAction.Delete && !isActionInProgress) {
        ConfirmEntryActionDialog(
            action = action,
            onConfirm = {
                val entryId = action.entry.entry._id
                isActionInProgress = true
                detailErrorMessage = null
                catalogViewModel.deleteEntry(entryId, null) { success, error ->
                    isActionInProgress = false
                    pendingAction = null
                    if (success) {
                        selectedEntry = null
                        showAddDialog = false
                        viewModel.refresh()
                        profileViewModel.refreshStats()
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Observation deleted")
                        }
                    } else {
                        detailErrorMessage = error ?: "Failed to delete observation"
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
