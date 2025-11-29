@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens.catalog

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
import androidx.compose.runtime.Stable
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
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.EntryDetailDialogCallbacks
import com.cpen321.usermanagement.ui.components.ObservationListItem
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogEntriesUiState
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogEntriesViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun CatalogEntriesScreen(
    navController: NavController,
    viewModel: CatalogEntriesViewModel = hiltViewModel()
) {
    val state = rememberCatalogEntriesScreenState(viewModel)
    CatalogEntriesScreenHost(
        state = state,
        onBack = { navController.popBackStack() },
        onRefresh = { viewModel.refresh() }
    )
}

@Composable
private fun CatalogEntriesScreenHost(
    state: CatalogEntriesScreenState,
    onBack: () -> Unit,
    onRefresh: () -> Unit
) {
    CatalogEntriesScreenLayout(
        uiState = state.uiState,
        snackbarHostState = state.snackbarHostState,
        onBack = onBack,
        onRefresh = onRefresh,
        onSelectEntry = state.dialogState::selectEntry,
        onOpenImage = state.openImage
    )

    CatalogEntriesDialogs(
        dialogState = state.dialogState,
        catalogViewModel = state.catalogViewModel,
        profileViewModel = state.profileViewModel,
        snackbarHostState = state.snackbarHostState,
        coroutineScope = state.coroutineScope,
        additionalCatalogOptions = state.additionalCatalogOptions,
        onEntryAdded = {
            onRefresh()
            state.coroutineScope.launch {
                state.snackbarHostState.showSnackbar("Observation added to catalog")
            }
        },
        onEntryDeleted = {
            onRefresh()
            state.profileViewModel.refreshStats()
            state.coroutineScope.launch {
                state.snackbarHostState.showSnackbar("Observation deleted")
            }
        },
        onEntryUpdated = { label ->
            onRefresh()
            state.profileViewModel.refreshStats()
            state.coroutineScope.launch {
                val message = if (label.isNotBlank()) {
                    "Recognition updated for $label"
                } else {
                    "Recognition updated"
                }
                state.snackbarHostState.showSnackbar(message)
            }
        }
    )
}

@Composable
private fun CatalogEntriesScreenLayout(
    uiState: CatalogEntriesUiState,
    snackbarHostState: SnackbarHostState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onSelectEntry: (RemoteCatalogEntry) -> Unit,
    onOpenImage: (String?) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("All Observations") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Outlined.Refresh, contentDescription = "Refresh")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        CatalogEntriesContent(
            uiState = uiState,
            paddingValues = paddingValues,
            onRefresh = onRefresh,
            onSelectEntry = onSelectEntry,
            onOpenImage = onOpenImage
        )
    }
}

@Composable
private fun CatalogEntriesContent(
    uiState: CatalogEntriesUiState,
    paddingValues: PaddingValues,
    onRefresh: () -> Unit,
    onSelectEntry: (RemoteCatalogEntry) -> Unit,
    onOpenImage: (String?) -> Unit
) {
    when {
        uiState.isLoading && uiState.entries.isEmpty() -> CatalogEntriesLoading(paddingValues)
        uiState.errorMessage != null && uiState.entries.isEmpty() -> CatalogEntriesErrorState(
            message = uiState.errorMessage ?: "Failed to load observations",
            paddingValues = paddingValues,
            onRetry = onRefresh
        )
        uiState.entries.isEmpty() -> CatalogEntriesEmptyState(paddingValues)
        else -> CatalogEntriesList(
            uiState = uiState,
            paddingValues = paddingValues,
            onSelectEntry = onSelectEntry,
            onOpenImage = onOpenImage
        )
    }
}

@Composable
private fun CatalogEntriesLoading(paddingValues: PaddingValues) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun CatalogEntriesErrorState(
    message: String,
    paddingValues: PaddingValues,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = message,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.error
        )
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

@Composable
private fun CatalogEntriesEmptyState(paddingValues: PaddingValues) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
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

@Composable
private fun CatalogEntriesList(
    uiState: CatalogEntriesUiState,
    paddingValues: PaddingValues,
    onSelectEntry: (RemoteCatalogEntry) -> Unit,
    onOpenImage: (String?) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
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
                onClick = { onSelectEntry(entry.toCatalogEntry()) },
                trailingContent = {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.OpenInNew,
                        contentDescription = "Open image",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.clickable { onOpenImage(entry.imageUrl) }
                    )
                }
            )

            if (index != uiState.entries.lastIndex) {
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun CatalogEntriesDialogs(
    dialogState: CatalogEntriesDialogState,
    catalogViewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    additionalCatalogOptions: List<CatalogOption>,
    onEntryAdded: () -> Unit,
    onEntryDeleted: () -> Unit,
    onEntryUpdated: (String) -> Unit
) {
    val entry = dialogState.entry

    if (dialogState.showAddDialog && entry != null) {
        AddToCatalogDialog(
            viewModel = catalogViewModel,
            isSaving = dialogState.isProcessing,
            onSave = { catalogId ->
                handleAddToCatalog(catalogId, dialogState, catalogViewModel, onEntryAdded)
            },
            onDismiss = {
                if (!dialogState.isProcessing) {
                    dialogState.closeAddDialog()
                }
            },
            additionalCatalogs = additionalCatalogOptions
        )
    }

    if (entry != null) {
        EntryDetailDialog(
            entry = entry,
            isProcessing = dialogState.isProcessing,
            errorMessage = dialogState.errorMessage,
            canRemoveFromCatalog = false,
            callbacks = EntryDetailDialogCallbacks(
                onDismiss = {
                    if (!dialogState.isProcessing) {
                        dialogState.dismissDetail()
                    }
                },
                onAddToCatalog = { dialogState.openAddDialog() },
                onDeleteEntry = { dialogState.scheduleDelete() },
                onRerunRecognition = {
                    if (!dialogState.isProcessing) {
                        handleRerunRecognition(
                            dialogState = dialogState,
                            catalogViewModel = catalogViewModel,
                            profileViewModel = profileViewModel,
                            snackbarHostState = snackbarHostState,
                            coroutineScope = coroutineScope,
                            onEntryUpdated = onEntryUpdated
                        )
                    }
                }
            )
        )
    }

    val pendingAction = dialogState.pendingAction
    if (pendingAction is EntryAction.Delete && !dialogState.isProcessing) {
        ConfirmEntryActionDialog(
            action = pendingAction,
            onConfirm = {
                handleDeleteEntry(
                    dialogState = dialogState,
                    catalogViewModel = catalogViewModel,
                    profileViewModel = profileViewModel,
                    onEntryDeleted = onEntryDeleted
                )
            },
            onDismiss = { dialogState.clearPendingAction() }
        )
    }
}

@Composable
private fun CatalogEntriesSideEffects(
    catalogShareViewModel: CatalogShareViewModel,
    catalogViewModel: CatalogViewModel,
    dialogState: CatalogEntriesDialogState
) {
    LaunchedEffect(Unit) {
        catalogShareViewModel.loadSharedWithMe()
    }

    LaunchedEffect(dialogState.showAddDialog) {
        if (dialogState.showAddDialog) {
            catalogViewModel.loadCatalogs()
        }
    }
}

private fun handleAddToCatalog(
    catalogId: String,
    dialogState: CatalogEntriesDialogState,
    catalogViewModel: CatalogViewModel,
    onEntryAdded: () -> Unit
) {
    val entryId = dialogState.entry?.entry?._id
    if (entryId == null) {
        dialogState.setError("Entry unavailable")
        return
    }

    dialogState.startProcessing()
    dialogState.clearError()
    catalogViewModel.addEntryToCatalog(catalogId, entryId, null) { success, error ->
        dialogState.stopProcessing()
        if (success) {
            dialogState.closeAddDialog()
            onEntryAdded()
        } else {
            dialogState.setError(error ?: "Failed to add observation to catalog")
        }
    }
}

private fun handleDeleteEntry(
    dialogState: CatalogEntriesDialogState,
    catalogViewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    onEntryDeleted: () -> Unit
) {
    val entryId = dialogState.entry?.entry?._id
    if (entryId == null) {
        dialogState.setError("Entry unavailable")
        dialogState.clearPendingAction()
        return
    }

    dialogState.startProcessing()
    dialogState.clearError()
    catalogViewModel.deleteEntry(entryId, null) { success, error ->
        dialogState.stopProcessing()
        dialogState.clearPendingAction()
        if (success) {
            profileViewModel.refreshStats()
            dialogState.dismissDetail()
            onEntryDeleted()
        } else {
            dialogState.setError(error ?: "Failed to delete observation")
        }
    }
}

private fun handleRerunRecognition(
    dialogState: CatalogEntriesDialogState,
    catalogViewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    onEntryUpdated: (String) -> Unit
) {
    val entryId = dialogState.entry?.entry?._id ?: return
    dialogState.startProcessing()
    dialogState.clearError()
    catalogViewModel.rerunEntryRecognition(entryId, null) { success, result, error ->
        dialogState.stopProcessing()
        if (success && result != null) {
            val updatedEntry = result.observation.toCatalogEntry()
            dialogState.updateEntry(updatedEntry)
            profileViewModel.refreshStats()
            val label = updatedEntry.entry.species ?: "observation"
            onEntryUpdated(label)
        } else {
            val message = error ?: "Failed to re-run recognition"
            dialogState.setError(message)
            coroutineScope.launch {
                snackbarHostState.showSnackbar(message)
            }
        }
    }
}

@Composable
private fun rememberOpenImageAction(context: android.content.Context): (String?) -> Unit {
    return remember(context) {
        { imageUrl: String? ->
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
    }
}

@Stable
private class CatalogEntriesDialogState {
    var entry by androidx.compose.runtime.mutableStateOf<RemoteCatalogEntry?>(null)
        private set
    var showAddDialog by androidx.compose.runtime.mutableStateOf(false)
        private set
    var isProcessing by androidx.compose.runtime.mutableStateOf(false)
        private set
    var errorMessage by androidx.compose.runtime.mutableStateOf<String?>(null)
        private set
    var pendingAction by androidx.compose.runtime.mutableStateOf<EntryAction?>(null)
        private set

    fun selectEntry(entry: RemoteCatalogEntry) {
        this.entry = entry
        showAddDialog = false
        errorMessage = null
        pendingAction = null
    }

    fun dismissDetail() {
        entry = null
        showAddDialog = false
        errorMessage = null
        pendingAction = null
    }

    fun openAddDialog() {
        if (entry != null) {
            showAddDialog = true
            errorMessage = null
        }
    }

    fun closeAddDialog() {
        showAddDialog = false
    }

    fun startProcessing() {
        isProcessing = true
    }

    fun stopProcessing() {
        isProcessing = false
    }

    fun setError(message: String?) {
        errorMessage = message
    }

    fun clearError() {
        errorMessage = null
    }

    fun scheduleDelete() {
        entry?.let { pendingAction = EntryAction.Delete(it) }
    }

    fun clearPendingAction() {
        pendingAction = null
    }

    fun updateEntry(updated: RemoteCatalogEntry) {
        entry = updated
    }
}

@Composable
private fun rememberCatalogEntriesDialogState(): CatalogEntriesDialogState {
    return remember { CatalogEntriesDialogState() }
}

@Stable
private class CatalogEntriesScreenState(
    val uiState: CatalogEntriesUiState,
    val dialogState: CatalogEntriesDialogState,
    val catalogViewModel: CatalogViewModel,
    val profileViewModel: ProfileViewModel,
    val snackbarHostState: SnackbarHostState,
    val coroutineScope: CoroutineScope,
    val openImage: (String?) -> Unit,
    val additionalCatalogOptions: List<CatalogOption>
)

@Composable
private fun rememberCatalogEntriesScreenState(
    viewModel: CatalogEntriesViewModel
): CatalogEntriesScreenState {
    val catalogViewModel: CatalogViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val uiState by viewModel.uiState.collectAsState()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()
    val dialogState = rememberCatalogEntriesDialogState()
    val openImage = rememberOpenImageAction(context)
    val additionalCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }

    CatalogEntriesSideEffects(
        catalogShareViewModel = catalogShareViewModel,
        catalogViewModel = catalogViewModel,
        dialogState = dialogState
    )

    return CatalogEntriesScreenState(
        uiState = uiState,
        dialogState = dialogState,
        catalogViewModel = catalogViewModel,
        profileViewModel = profileViewModel,
        snackbarHostState = snackbarHostState,
        coroutineScope = coroutineScope,
        openImage = openImage,
        additionalCatalogOptions = additionalCatalogOptions
    )
}
