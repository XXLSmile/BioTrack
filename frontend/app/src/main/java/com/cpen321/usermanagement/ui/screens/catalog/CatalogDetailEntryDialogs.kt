package com.cpen321.usermanagement.ui.screens.catalog

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.EntryDetailDialogCallbacks
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun CatalogEntryDialogs(
    dialogState: CatalogEntryDialogState,
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    permissions: CatalogEntryPermissions
) {
    AddEntryDialogHost(dialogState, viewModel, snackbarHostState, coroutineScope, permissions)
    EntryDetailDialogHost(
        dialogState = dialogState,
        viewModel = viewModel,
        profileViewModel = profileViewModel,
        snackbarHostState = snackbarHostState,
        coroutineScope = coroutineScope,
        permissions = permissions
    )
    EntryActionConfirmationHost(
        dialogState = dialogState,
        viewModel = viewModel,
        profileViewModel = profileViewModel,
        snackbarHostState = snackbarHostState,
        coroutineScope = coroutineScope,
        permissions = permissions
    )
}

@Composable
private fun AddEntryDialogHost(
    dialogState: CatalogEntryDialogState,
    viewModel: CatalogViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    permissions: CatalogEntryPermissions
) {
    val entry = dialogState.entry ?: return
    if (!dialogState.showAddDialog) return

    AddToCatalogDialog(
        viewModel = viewModel,
        isSaving = dialogState.isProcessing,
        onSave = { targetCatalogId ->
            handleAddToCatalog(
                targetCatalogId = targetCatalogId,
                viewModel = viewModel,
                dialogState = dialogState,
                permissions = permissions,
                snackbarHostState = snackbarHostState,
                coroutineScope = coroutineScope
            )
        },
        onDismiss = {
            if (!dialogState.isProcessing) {
                dialogState.closeAddDialog()
            }
        },
        excludeCatalogId = permissions.currentCatalogId,
        additionalCatalogs = permissions.additionalCatalogs
    )
}

@Composable
private fun EntryDetailDialogHost(
    dialogState: CatalogEntryDialogState,
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    permissions: CatalogEntryPermissions
) {
    val entry = dialogState.entry ?: return
    if (!dialogState.isDetailVisible) return

    EntryDetailDialog(
        entry = entry,
        isProcessing = dialogState.isProcessing,
        errorMessage = dialogState.errorMessage,
        canRemoveFromCatalog = permissions.canRemoveFromCatalog && permissions.currentCatalogId != null,
        callbacks = EntryDetailDialogCallbacks(
            onDismiss = {
                if (!dialogState.isProcessing) {
                    dialogState.dismissDetail()
                }
            },
            onAddToCatalog = permissions.takeIf { it.canAddToOtherCatalog }?.let { { dialogState.openAddDialog() } },
            onRemoveFromCatalog = permissions.takeIf { it.canRemoveFromCatalog }?.let {
                { dialogState.scheduleAction(EntryAction.Remove(entry)) }
            },
            onDeleteEntry = permissions.takeIf { it.canDeleteEntry }?.let {
                { dialogState.scheduleAction(EntryAction.Delete(entry)) }
            },
            onRerunRecognition = {
                if (!dialogState.isProcessing) {
                    handleRerunRecognition(
                        viewModel = viewModel,
                        profileViewModel = profileViewModel,
                        dialogState = dialogState,
                        permissions = permissions,
                        snackbarHostState = snackbarHostState,
                        coroutineScope = coroutineScope
                    )
                }
            }
        )
    )
}

@Composable
private fun EntryActionConfirmationHost(
    dialogState: CatalogEntryDialogState,
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope,
    permissions: CatalogEntryPermissions
) {
    val action = dialogState.pendingAction ?: return
    if (dialogState.isProcessing) return

    ConfirmEntryActionDialog(
        action = action,
        onConfirm = {
            when (action) {
                is EntryAction.Remove -> handleRemoveFromCatalog(
                    viewModel = viewModel,
                    dialogState = dialogState,
                    permissions = permissions,
                    snackbarHostState = snackbarHostState,
                    coroutineScope = coroutineScope
                )
                is EntryAction.Delete -> handleDeleteEntry(
                    viewModel = viewModel,
                    profileViewModel = profileViewModel,
                    dialogState = dialogState,
                    permissions = permissions,
                    snackbarHostState = snackbarHostState,
                    coroutineScope = coroutineScope
                )
            }
        },
        onDismiss = { dialogState.clearPendingAction() }
    )
}

private fun handleAddToCatalog(
    targetCatalogId: String,
    viewModel: CatalogViewModel,
    dialogState: CatalogEntryDialogState,
    permissions: CatalogEntryPermissions,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope
) {
    val entryId = dialogState.entry?.entry?._id ?: return
    dialogState.startProcessing()
    dialogState.clearError()
    viewModel.addEntryToCatalog(targetCatalogId, entryId, permissions.currentCatalogId) { success, error ->
        dialogState.stopProcessing()
        if (success) {
            dialogState.closeAddDialog()
            coroutineScope.launch {
                snackbarHostState.showSnackbar("Observation added to catalog")
            }
        } else {
            dialogState.setError(error ?: "Failed to add observation to catalog")
        }
    }
}

private fun handleRemoveFromCatalog(
    viewModel: CatalogViewModel,
    dialogState: CatalogEntryDialogState,
    permissions: CatalogEntryPermissions,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope
) {
    val catalogId = permissions.currentCatalogId ?: run {
        dialogState.setError("Catalog unavailable")
        dialogState.clearPendingAction()
        return
    }
    val entryId = dialogState.entry?.entry?._id ?: return
    dialogState.startProcessing()
    dialogState.clearError()
    viewModel.removeEntryFromCatalog(catalogId, entryId) { success, error ->
        dialogState.stopProcessing()
        dialogState.clearPendingAction()
        if (success) {
            dialogState.dismissDetail()
            coroutineScope.launch {
                snackbarHostState.showSnackbar("Observation removed from catalog")
            }
        } else {
            dialogState.setError(error ?: "Failed to remove observation")
        }
    }
}

private fun handleDeleteEntry(
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    dialogState: CatalogEntryDialogState,
    permissions: CatalogEntryPermissions,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope
) {
    val entryId = dialogState.entry?.entry?._id ?: return
    dialogState.startProcessing()
    dialogState.clearError()
    viewModel.deleteEntry(entryId, permissions.currentCatalogId) { success, error ->
        dialogState.stopProcessing()
        dialogState.clearPendingAction()
        if (success) {
            profileViewModel.refreshStats()
            dialogState.dismissDetail()
            coroutineScope.launch {
                snackbarHostState.showSnackbar("Observation deleted")
            }
        } else {
            dialogState.setError(error ?: "Failed to delete observation")
        }
    }
}

private fun handleRerunRecognition(
    viewModel: CatalogViewModel,
    profileViewModel: ProfileViewModel,
    dialogState: CatalogEntryDialogState,
    permissions: CatalogEntryPermissions,
    snackbarHostState: SnackbarHostState,
    coroutineScope: CoroutineScope
) {
    val entryId = dialogState.entry?.entry?._id ?: return
    dialogState.startProcessing()
    dialogState.clearError()
    viewModel.rerunEntryRecognition(entryId, permissions.currentCatalogId) { success, result, error ->
        dialogState.stopProcessing()
        if (success && result != null) {
            val existing = dialogState.entry
            val updatedEntry = result.observation.toCatalogEntry().copy(
                linkedAt = existing?.linkedAt,
                addedBy = existing?.addedBy
            )
            dialogState.updateEntry(updatedEntry)
            profileViewModel.refreshStats()
            coroutineScope.launch {
                val label = updatedEntry.entry.species ?: "observation"
                snackbarHostState.showSnackbar("Recognition updated for $label")
            }
        } else {
            val message = error ?: "Failed to re-run recognition"
            dialogState.setError(message)
            coroutineScope.launch {
                snackbarHostState.showSnackbar(message)
            }
        }
    }
}
