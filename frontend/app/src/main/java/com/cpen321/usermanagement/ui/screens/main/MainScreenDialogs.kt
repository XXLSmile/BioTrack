package com.cpen321.usermanagement.ui.screens.main

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.data.repository.EntryRecognitionUpdate
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.EntryDetailDialogCallbacks
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.screens.catalog.AddToCatalogDialog
import com.cpen321.usermanagement.ui.screens.catalog.CatalogOption
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import kotlinx.coroutines.launch

@Composable
internal fun AddEntryToCatalogDialog(
    catalogViewModel: CatalogViewModel,
    state: EntryDialogState,
    additionalCatalogOptions: List<CatalogOption>,
    onSuccess: () -> Unit
) {
    if (!state.showAddDialog || state.entry == null) return

    AddToCatalogDialog(
        viewModel = catalogViewModel,
        isSaving = state.isProcessing,
        onSave = { catalogId ->
            performAddToCatalog(catalogId, catalogViewModel, state, onSuccess)
        },
        onDismiss = {
            if (!state.isProcessing) {
                state.hideAddDialog()
            }
        },
        additionalCatalogs = additionalCatalogOptions
    )
}

@Composable
internal fun ObservationEntryDetailDialog(state: MainScreenState) {
    val dialogState = state.entryDialogState
    val entry = dialogState.entry
    if (!dialogState.showEntryDialog || entry == null) return

    EntryDetailDialog(
        entry = entry,
        isProcessing = dialogState.isProcessing,
        errorMessage = dialogState.errorMessage,
        canRemoveFromCatalog = false,
        callbacks = EntryDetailDialogCallbacks(
            onDismiss = {
                if (!dialogState.isProcessing) {
                    dialogState.dismissAll()
                }
            },
            onAddToCatalog = {
                if (!dialogState.isProcessing) {
                    dialogState.openAddDialog()
                }
            },
            onRerunRecognition = {
                if (!dialogState.isProcessing) {
                    performRerunRecognition(
                        catalogViewModel = state.catalogViewModel,
                        state = dialogState,
                        currentCatalogId = null
                    ) { update ->
                        val updatedEntry = update.observation.toCatalogEntry().copy(
                            linkedAt = entry.linkedAt,
                            addedBy = entry.addedBy
                        )
                        dialogState.updateEntry(updatedEntry)
                        state.mainViewModel.loadRecentObservations()
                        state.profileViewModel.refreshStats()
                        state.coroutineScope.launch {
                            val label = updatedEntry.entry.species ?: "observation"
                            state.snackBarHostState.showSnackbar("Recognition updated for $label")
                        }
                    }
                }
            },
            onDeleteEntry = {
                if (!dialogState.isProcessing) {
                    dialogState.scheduleDelete()
                }
            }
        )
    )
}

@Composable
internal fun ConfirmEntryDeletionDialog(
    catalogViewModel: CatalogViewModel,
    state: EntryDialogState,
    onSuccess: () -> Unit
) {
    val action = state.pendingAction
    if (state.isProcessing || action !is EntryAction.Delete) return

    ConfirmEntryActionDialog(
        action = action,
        onConfirm = {
            performDeleteEntry(catalogViewModel, state, onSuccess)
        },
        onDismiss = { state.clearPendingAction() }
    )
}

internal fun performAddToCatalog(
    catalogId: String,
    catalogViewModel: CatalogViewModel,
    state: EntryDialogState,
    onSuccess: () -> Unit
) {
    val entryId = state.entry?.entry?._id ?: return
    state.startProcessing()
    state.clearError()
    catalogViewModel.addEntryToCatalog(catalogId, entryId, null) { success, error ->
        state.stopProcessing()
        if (success) {
            state.hideAddDialog()
            onSuccess()
        } else {
            state.setError(error ?: "Failed to add observation to catalog")
        }
    }
}

internal fun performDeleteEntry(
    catalogViewModel: CatalogViewModel,
    state: EntryDialogState,
    onSuccess: () -> Unit
) {
    val entryId = state.entry?.entry?._id ?: return
    state.startProcessing()
    state.clearError()
    catalogViewModel.deleteEntry(entryId, null) { success, error ->
        state.stopProcessing()
        if (success) {
            state.clearPendingAction()
            state.dismissAll()
            onSuccess()
        } else {
            state.setError(error ?: "Failed to delete observation")
        }
    }
}

private fun performRerunRecognition(
    catalogViewModel: CatalogViewModel,
    state: EntryDialogState,
    currentCatalogId: String?,
    onSuccess: (EntryRecognitionUpdate) -> Unit
) {
    val entryId = state.entry?.entry?._id ?: return
    state.startProcessing()
    state.clearError()
    catalogViewModel.rerunEntryRecognition(entryId, currentCatalogId) { success, result, error ->
        state.stopProcessing()
        if (success && result != null) {
            onSuccess(result)
        } else {
            state.setError(error ?: "Failed to re-run recognition")
        }
    }
}

@Composable
internal fun rememberEntryDialogState(): EntryDialogState {
    return remember { EntryDialogState() }
}

internal class EntryDialogState {
    var showEntryDialog by mutableStateOf(false)
        private set
    var showAddDialog by mutableStateOf(false)
        private set
    var isProcessing by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var pendingAction by mutableStateOf<EntryAction?>(null)
        private set
    var entry by mutableStateOf<RemoteCatalogEntry?>(null)
        private set

    fun showEntry(entry: RemoteCatalogEntry) {
        this.entry = entry
        showEntryDialog = true
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

    fun hideAddDialog() {
        showAddDialog = false
    }

    fun dismissAll() {
        showEntryDialog = false
        showAddDialog = false
        entry = null
        errorMessage = null
        pendingAction = null
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

    fun updateEntry(updated: RemoteCatalogEntry) {
        entry = updated
    }

    fun scheduleDelete() {
        entry?.let { pendingAction = EntryAction.Delete(it) }
    }

    fun clearPendingAction() {
        pendingAction = null
    }
}
