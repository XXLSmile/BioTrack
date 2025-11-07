@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.Share
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
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogData
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.EntryDetailDialogCallbacks
import com.cpen321.usermanagement.ui.components.formatIsoToPrettyDate
import com.cpen321.usermanagement.ui.components.resolveImageUrl
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareUiState
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun CatalogDetailScreen(
    catalogId: String,
    viewModel: CatalogViewModel,
    navController: NavController
) {
    val state = rememberCatalogDetailScreenState(catalogId, viewModel)
    CatalogDetailScreenContent(state = state, navController = navController)
}

@Composable
private fun CatalogDetailScreenContent(
    state: CatalogDetailScreenState,
    navController: NavController
) {
    CatalogDetailSideEffects(state)

    CatalogDetailLayout(
        ui = state.detailUi,
        snackbarHostState = state.snackbarHostState,
        navController = navController,
        onEntrySelected = state.dialogState::showEntry,
        onShareClick = { state.showShareDialog = true }
    )

    CatalogEntryDialogs(
        dialogState = state.dialogState,
        viewModel = state.catalogViewModel,
        profileViewModel = state.profileViewModel,
        snackbarHostState = state.snackbarHostState,
        coroutineScope = state.coroutineScope,
        permissions = state.permissions
    )

    CatalogShareDialogHost(
        showDialog = state.showShareDialog && state.detailUi.isOwner,
        catalogName = state.detailUi.catalog?.name,
        state = state.shareUiState,
        onInvite = { friendId, role ->
            state.catalogShareViewModel.inviteCollaborator(state.catalogId, friendId, role)
        },
        onChangeRole = { shareId, role ->
            state.catalogShareViewModel.updateCollaboratorRole(state.catalogId, shareId, role)
        },
        onRevoke = { shareId ->
            state.catalogShareViewModel.revokeCollaborator(state.catalogId, shareId)
        },
        onDismiss = {
            if (!state.shareUiState.isProcessing) {
                state.showShareDialog = false
                state.catalogShareViewModel.clearMessages()
            }
        }
    )
}

@Composable
private fun CatalogDetailLayout(
    ui: CatalogDetailUi,
    snackbarHostState: SnackbarHostState,
    navController: NavController,
    onEntrySelected: (RemoteCatalogEntry) -> Unit,
    onShareClick: () -> Unit
) {
    Scaffold(
        topBar = {
            CatalogDetailTopBar(
                title = ui.catalog?.name ?: "Catalog",
                canShare = ui.isOwner,
                onBack = { navController.popBackStack() },
                onShareClick = onShareClick
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        CatalogEntriesContent(
            ui = ui,
            paddingValues = paddingValues,
            onEntrySelected = onEntrySelected
        )
    }
}

@Composable
private fun CatalogDetailTopBar(
    title: String,
    canShare: Boolean,
    onBack: () -> Unit,
    onShareClick: () -> Unit
) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
        },
        actions = {
            if (canShare) {
                IconButton(onClick = onShareClick) {
                    Icon(Icons.Outlined.Share, contentDescription = "Share catalog")
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

@Composable
private fun CatalogEntriesContent(
    ui: CatalogDetailUi,
    paddingValues: PaddingValues,
    onEntrySelected: (RemoteCatalogEntry) -> Unit
) {
    when {
        ui.catalog == null -> CatalogLoadingState(paddingValues)
        ui.entries.isEmpty() -> CatalogEmptyState(paddingValues)
        else -> CatalogEntriesGrid(ui.entries, paddingValues, onEntrySelected)
    }
}

@Composable
private fun CatalogEntriesGrid(
    entries: List<RemoteCatalogEntry>,
    paddingValues: PaddingValues,
    onEntrySelected: (RemoteCatalogEntry) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 150.dp),
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(entries) { entry ->
            EntryCard(entry = entry, onClick = { onEntrySelected(entry) })
        }
    }
}

@Composable
private fun CatalogLoadingState(paddingValues: PaddingValues) {
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
private fun CatalogEmptyState(paddingValues: PaddingValues) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "No wildlife added yet.\nScan and save your discoveries 🌿",
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CatalogDetailSideEffects(state: CatalogDetailScreenState) {
    LaunchedEffect(state.catalogId) {
        state.catalogViewModel.loadCatalogDetail(state.catalogId)
    }

    LaunchedEffect(state.profileUiState.user) {
        if (state.profileUiState.user == null) {
            state.profileViewModel.loadProfile()
        }
    }

    LaunchedEffect(state.dialogState.showAddDialog) {
        if (state.dialogState.showAddDialog) {
            state.catalogViewModel.loadCatalogs()
        }
    }

    LaunchedEffect(state.detailUi.isOwner) {
        if (!state.detailUi.isOwner) {
            state.catalogShareViewModel.loadSharedWithMe()
        }
    }

    LaunchedEffect(state.showShareDialog, state.detailUi.isOwner) {
        if (state.showShareDialog && state.detailUi.isOwner) {
            state.catalogShareViewModel.loadCollaborators(state.catalogId)
            state.catalogShareViewModel.loadFriendsIfNeeded()
        }
    }

    LaunchedEffect(state.shareUiState.successMessage, state.shareUiState.errorMessage) {
        val message = state.shareUiState.successMessage ?: state.shareUiState.errorMessage
        if (message != null) {
            state.snackbarHostState.showSnackbar(message)
            state.catalogShareViewModel.clearMessages()
        }
    }
}

@Stable
private class CatalogDetailScreenState(
    val catalogId: String,
    private val controllers: CatalogDetailControllers,
    private val snapshots: CatalogDetailSnapshots,
    val dialogState: CatalogEntryDialogState,
    private val shareDialogState: MutableState<Boolean>
) {
    val catalogViewModel: CatalogViewModel get() = controllers.catalogViewModel
    val profileViewModel: ProfileViewModel get() = controllers.profileViewModel
    val catalogShareViewModel: CatalogShareViewModel get() = controllers.catalogShareViewModel
    val snackbarHostState: SnackbarHostState get() = controllers.snackbarHostState
    val coroutineScope: CoroutineScope get() = controllers.coroutineScope
    val detailUi: CatalogDetailUi get() = snapshots.detailUi
    val permissions: CatalogEntryPermissions get() = snapshots.permissions
    val shareUiState: CatalogShareUiState get() = snapshots.shareUiState
    val profileUiState: ProfileUiState get() = snapshots.profileUiState

    var showShareDialog: Boolean
        get() = shareDialogState.value
        set(value) {
            shareDialogState.value = value
        }
}

@Composable
private fun rememberCatalogDetailScreenState(
    catalogId: String,
    viewModel: CatalogViewModel
): CatalogDetailScreenState {
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val catalogDetailState by viewModel.catalogDetail.collectAsState()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val profileUiState by profileViewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()
    val dialogState = rememberCatalogEntryDialogState()
    val detailUi = rememberCatalogDetailUi(
        detailState = catalogDetailState,
        shareUiState = shareUiState,
        profileUiState = profileUiState
    )
    val permissions = remember(detailUi) {
        CatalogEntryPermissions(
            canAddToOtherCatalog = detailUi.isOwner,
            canRemoveFromCatalog = detailUi.isOwner || detailUi.userRole == "editor",
            canDeleteEntry = detailUi.isOwner,
            currentCatalogId = detailUi.currentCatalogId,
            additionalCatalogs = if (detailUi.isOwner) emptyList() else detailUi.editorCatalogOptions
        )
    }
    val shareDialogState = remember { mutableStateOf(false) }

    val controllers = CatalogDetailControllers(
        catalogViewModel = viewModel,
        profileViewModel = profileViewModel,
        catalogShareViewModel = catalogShareViewModel,
        snackbarHostState = snackbarHostState,
        coroutineScope = coroutineScope
    )
    val snapshots = CatalogDetailSnapshots(
        detailUi = detailUi,
        permissions = permissions,
        shareUiState = shareUiState,
        profileUiState = profileUiState
    )

    return CatalogDetailScreenState(
        catalogId = catalogId,
        controllers = controllers,
        snapshots = snapshots,
        dialogState = dialogState,
        shareDialogState = shareDialogState
    )
}

@Composable
private fun rememberCatalogDetailUi(
    detailState: CatalogData?,
    shareUiState: CatalogShareUiState,
    profileUiState: ProfileUiState
): CatalogDetailUi {
    val catalog = detailState?.catalog
    val entries = detailState?.entries ?: emptyList()
    val currentUserId = profileUiState.user?._id
    val isOwner = catalog?.owner != null && catalog.owner == currentUserId
    val userRole = when {
        isOwner -> "owner"
        else -> shareUiState.sharedCatalogs.firstOrNull { it.catalog?._id == catalog?._id }?.role
    }
    val editorOptions = shareUiState.sharedCatalogs
        .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
        .map { share -> CatalogOption(share.catalog!!._id, share.catalog.name ?: "Catalog") }

    return remember(catalog, entries, isOwner, userRole, editorOptions) {
        CatalogDetailUi(
            catalog = catalog,
            entries = entries,
            isOwner = isOwner,
            userRole = userRole,
            editorCatalogOptions = editorOptions
        )
    }
}

private data class CatalogDetailUi(
    val catalog: Catalog?,
    val entries: List<RemoteCatalogEntry>,
    val isOwner: Boolean,
    val userRole: String?,
    val editorCatalogOptions: List<CatalogOption>
) {
    val currentCatalogId: String? get() = catalog?._id
}

data class CatalogEntryPermissions(
    val canAddToOtherCatalog: Boolean,
    val canRemoveFromCatalog: Boolean,
    val canDeleteEntry: Boolean,
    val currentCatalogId: String?,
    val additionalCatalogs: List<CatalogOption>
)

private data class CatalogDetailControllers(
    val catalogViewModel: CatalogViewModel,
    val profileViewModel: ProfileViewModel,
    val catalogShareViewModel: CatalogShareViewModel,
    val snackbarHostState: SnackbarHostState,
    val coroutineScope: CoroutineScope
)

private data class CatalogDetailSnapshots(
    val detailUi: CatalogDetailUi,
    val permissions: CatalogEntryPermissions,
    val shareUiState: CatalogShareUiState,
    val profileUiState: ProfileUiState
)

@Stable
class CatalogEntryDialogState {
    var entry by mutableStateOf<RemoteCatalogEntry?>(null)
        private set
    var isDetailVisible by mutableStateOf(false)
        private set
    var showAddDialog by mutableStateOf(false)
        private set
    var isProcessing by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    var pendingAction by mutableStateOf<EntryAction?>(null)
        private set

    fun showEntry(entry: RemoteCatalogEntry) {
        this.entry = entry
        isDetailVisible = true
        showAddDialog = false
        errorMessage = null
        pendingAction = null
    }

    fun dismissDetail() {
        entry = null
        isDetailVisible = false
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

    fun scheduleAction(action: EntryAction) {
        pendingAction = action
    }

    fun clearPendingAction() {
        pendingAction = null
    }
}

@Composable
private fun rememberCatalogEntryDialogState(): CatalogEntryDialogState {
    return remember { CatalogEntryDialogState() }
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



@Composable
private fun CollaboratorRow(
    share: CatalogShareEntry,
    isProcessing: Boolean,
    onChangeRole: (String) -> Unit,
    onRevoke: () -> Unit
) {
    var menuExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            CollaboratorInfo(share)
            IconButton(onClick = { menuExpanded = true }, enabled = !isProcessing) {
                Icon(Icons.Filled.MoreVert, contentDescription = "Collaborator actions")
            }
        }

        CollaboratorMenu(
            share = share,
            menuExpanded = menuExpanded,
            onMenuDismiss = { menuExpanded = false },
            isProcessing = isProcessing,
            onChangeRole = onChangeRole,
            onRevoke = onRevoke
        )
    }
}

@Composable
private fun CollaboratorInfo(share: CatalogShareEntry) {
    val inviteeName = share.invitee?.name?.takeIf { it.isNotBlank() }
        ?: share.invitee?.username?.takeIf { it.isNotBlank() }
        ?: "Unknown user"
    val statusLabel = share.status.replaceFirstChar { it.uppercase() }
    val roleLabel = share.role.replaceFirstChar { it.uppercase() }

    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(inviteeName, style = MaterialTheme.typography.titleMedium)
        Text(
            text = "Role: $roleLabel",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "Status: $statusLabel",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CollaboratorMenu(
    share: CatalogShareEntry,
    menuExpanded: Boolean,
    onMenuDismiss: () -> Unit,
    isProcessing: Boolean,
    onChangeRole: (String) -> Unit,
    onRevoke: () -> Unit
) {
    DropdownMenu(
        expanded = menuExpanded,
        onDismissRequest = onMenuDismiss
    ) {
        CollaboratorRoleActions(share, onMenuDismiss, onChangeRole)
        DropdownMenuItem(
            text = { Text("Revoke invitation", color = MaterialTheme.colorScheme.error) },
            onClick = {
                onMenuDismiss()
                onRevoke()
            },
            enabled = !isProcessing
        )
    }
}

@Composable
private fun CollaboratorRoleActions(
    share: CatalogShareEntry,
    onMenuDismiss: () -> Unit,
    onChangeRole: (String) -> Unit
) {
    when (share.status) {
        "accepted" -> {
            if (share.role != "viewer") {
                DropdownMenuItem(
                    text = { Text("Set as viewer") },
                    onClick = {
                        onMenuDismiss()
                        onChangeRole("viewer")
                    }
                )
            }
            if (share.role != "editor") {
                DropdownMenuItem(
                    text = { Text("Set as editor") },
                    onClick = {
                        onMenuDismiss()
                        onChangeRole("editor")
                    }
                )
            }
        }

        "pending" -> {
            DropdownMenuItem(
                text = { Text("Make viewer") },
                onClick = {
                    onMenuDismiss()
                    onChangeRole("viewer")
                }
            )
            DropdownMenuItem(
                text = { Text("Make editor") },
                onClick = {
                    onMenuDismiss()
                    onChangeRole("editor")
                }
            )
        }
    }
}
