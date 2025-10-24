@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.formatIsoToPrettyDate
import com.cpen321.usermanagement.ui.components.resolveImageUrl
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareUiState
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import com.cpen321.usermanagement.data.remote.dto.FriendSummary
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
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val profileUiState by profileViewModel.uiState.collectAsState()

    val catalog = catalogDetailState?.catalog
    val entries = catalogDetailState?.entries ?: emptyList()
    val currentUserId = profileUiState.user?._id
    val isOwner = catalog?.owner != null && catalog.owner == currentUserId
    val userRole = remember(isOwner, shareUiState.sharedCatalogs, catalog) {
        when {
            isOwner -> "owner"
            else -> shareUiState.sharedCatalogs.firstOrNull { it.catalog?._id == catalog?._id }?.role
        }
    }
    val editorSharedCatalogOptions = remember(shareUiState.sharedCatalogs) {
        shareUiState.sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { share -> CatalogOption(share.catalog!!._id, share.catalog.name ?: "Catalog") }
    }
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    var selectedEntry by remember { mutableStateOf<RemoteCatalogEntry?>(null) }
    var showAddDialog by remember { mutableStateOf(false) }
    var isActionInProgress by remember { mutableStateOf(false) }
    var detailErrorMessage by remember { mutableStateOf<String?>(null) }
    var pendingAction by remember { mutableStateOf<EntryAction?>(null) }
    var showShareDialog by remember { mutableStateOf(false) }

    LaunchedEffect(profileUiState.user) {
        if (profileUiState.user == null) {
            profileViewModel.loadProfile()
        }
    }

    LaunchedEffect(selectedEntry) {
        detailErrorMessage = null
    }

    LaunchedEffect(showAddDialog) {
        if (showAddDialog) {
            viewModel.loadCatalogs()
        }
    }

    LaunchedEffect(isOwner) {
        if (!isOwner) {
            catalogShareViewModel.loadSharedWithMe()
        }
    }

    LaunchedEffect(showShareDialog) {
        if (showShareDialog && isOwner) {
            catalogShareViewModel.loadCollaborators(catalogId)
            catalogShareViewModel.loadFriendsIfNeeded()
        }
    }

    LaunchedEffect(shareUiState.successMessage, shareUiState.errorMessage) {
        val message = shareUiState.successMessage ?: shareUiState.errorMessage
        if (message != null) {
            snackbarHostState.showSnackbar(message)
            catalogShareViewModel.clearMessages()
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
                actions = {
                    if (isOwner) {
                        IconButton(onClick = {
                            showShareDialog = true
                        }) {
                            Icon(Icons.Outlined.Share, contentDescription = "Share catalog")
                        }
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
            excludeCatalogId = currentCatalogId,
            additionalCatalogs = if (isOwner) emptyList() else editorSharedCatalogOptions
        )
    }

    selectedEntry?.let { entry ->
        val canRemoveFromCatalog = currentCatalogId != null && (isOwner || userRole == "editor")
        val canAddToOtherCatalog = isOwner
        val canDeleteEntryPermanently = isOwner
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
            onAddToCatalog = if (canAddToOtherCatalog) { { showAddDialog = true } } else null,
            onRemoveFromCatalog = if (canRemoveFromCatalog) { { pendingAction = EntryAction.Remove(entry) } } else null,
            onDeleteEntry = if (canDeleteEntryPermanently) { { pendingAction = EntryAction.Delete(entry) } } else null
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
                                    snackbarHostState.showSnackbar("Observation removed from catalog")
                                }
                            } else {
                                detailErrorMessage = error ?: "Failed to remove observation"
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
                                profileViewModel.refreshStats()
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Observation deleted")
                                }
                            } else {
                                detailErrorMessage = error ?: "Failed to delete observation"
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

    if (showShareDialog && isOwner) {
        ShareCatalogDialog(
            catalogName = catalog?.name,
            state = shareUiState,
            onInvite = { friendId, role ->
                catalogShareViewModel.inviteCollaborator(catalogId, friendId, role)
            },
            onChangeRole = { shareId, role ->
                catalogShareViewModel.updateCollaboratorRole(catalogId, shareId, role)
            },
            onRevoke = { shareId ->
                catalogShareViewModel.revokeCollaborator(catalogId, shareId)
            },
            onDismiss = {
                if (!shareUiState.isProcessing) {
                    showShareDialog = false
                    catalogShareViewModel.clearMessages()
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


@Composable
private fun ShareCatalogDialog(
    catalogName: String?,
    state: CatalogShareUiState,
    onInvite: (String, String) -> Unit,
    onChangeRole: (String, String) -> Unit,
    onRevoke: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val scrollState = rememberScrollState()
    var friendMenuExpanded by remember { mutableStateOf(false) }
    var selectedFriend by remember(state.friends) { mutableStateOf(state.friends.firstOrNull()) }
    var roleMenuExpanded by remember { mutableStateOf(false) }
    var selectedRole by remember { mutableStateOf("viewer") }
    val roleOptions = listOf("viewer", "editor")

    fun friendDisplay(friend: FriendSummary?): String {
        if (friend == null) return "Select friend"
        val user = friend.user
        return user?.name?.takeIf { it.isNotBlank() }
            ?: user?.username?.takeIf { it.isNotBlank() }
            ?: "Select friend"
    }

    AlertDialog(
        onDismissRequest = { if (!state.isProcessing) onDismiss() },
        confirmButton = {
            TextButton(
                onClick = { if (!state.isProcessing) onDismiss() },
                enabled = !state.isProcessing
            ) {
                Text("Close")
            }
        },
        title = {
            Text(
                text = buildString {
                    append("Share Catalog")
                    if (!catalogName.isNullOrBlank()) {
                        append(": ")
                        append(catalogName)
                    }
                },
                style = MaterialTheme.typography.titleLarge
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(scrollState),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Invite a friend",
                        style = MaterialTheme.typography.titleMedium
                    )

                    if (state.friends.isEmpty()) {
                        Text(
                            text = "Add friends to invite them to your catalog.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { friendMenuExpanded = true },
                                enabled = !state.isProcessing,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(friendDisplay(selectedFriend))
                            }
                            DropdownMenu(
                                expanded = friendMenuExpanded,
                                onDismissRequest = { friendMenuExpanded = false }
                            ) {
                                state.friends.forEach { friend ->
                                    DropdownMenuItem(
                                        text = { Text(friendDisplay(friend)) },
                                        onClick = {
                                            selectedFriend = friend
                                            friendMenuExpanded = false
                                        }
                                    )
                                }
                            }

                            OutlinedButton(
                                onClick = { roleMenuExpanded = true },
                                enabled = !state.isProcessing,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                val roleLabel = selectedRole.replaceFirstChar { it.uppercase() }
                                Text("Role: $roleLabel")
                            }
                            DropdownMenu(
                                expanded = roleMenuExpanded,
                                onDismissRequest = { roleMenuExpanded = false }
                            ) {
                                roleOptions.forEach { role ->
                                    DropdownMenuItem(
                                        text = { Text(role.replaceFirstChar { it.uppercase() }) },
                                        onClick = {
                                            selectedRole = role
                                            roleMenuExpanded = false
                                        }
                                    )
                                }
                            }

                            Button(
                                onClick = {
                                    selectedFriend?.user?._id?.let { userId ->
                                        onInvite(userId, selectedRole)
                                    }
                                },
                                enabled = selectedFriend != null && !state.isProcessing,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Send invitation")
                            }
                        }
                    }
                }

                HorizontalDivider()

                Text(
                    text = "Collaborators",
                    style = MaterialTheme.typography.titleMedium
                )

                if (state.isLoading) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                } else if (state.collaborators.isEmpty()) {
                    Text(
                        text = "No collaborators yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    state.collaborators
                        .sortedWith(compareBy<CatalogShareEntry> { it.status != "accepted" }.thenBy { it.invitee?.name ?: "" })
                        .forEach { share ->
                            CollaboratorRow(
                                share = share,
                                isProcessing = state.isProcessing,
                                onChangeRole = { role -> onChangeRole(share._id, role) },
                                onRevoke = { onRevoke(share._id) }
                            )
                        }
                }
            }
        }
    )
}

@Composable
private fun CollaboratorRow(
    share: CatalogShareEntry,
    isProcessing: Boolean,
    onChangeRole: (String) -> Unit,
    onRevoke: () -> Unit
) {
    val inviteeName = share.invitee?.name?.takeIf { it.isNotBlank() }
        ?: share.invitee?.username?.takeIf { it.isNotBlank() }
        ?: "Unknown user"
    val statusLabel = share.status.replaceFirstChar { it.uppercase() }
    val roleLabel = share.role.replaceFirstChar { it.uppercase() }

    var menuExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(inviteeName, style = MaterialTheme.typography.titleMedium)
                Text(
                    text = "Role: ${roleLabel}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = "Status: ${statusLabel}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            IconButton(onClick = { menuExpanded = true }, enabled = !isProcessing) {
                Icon(Icons.Filled.MoreVert, contentDescription = "Collaborator actions")
            }

            DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                if (share.status == "accepted") {
                    if (share.role != "viewer") {
                        DropdownMenuItem(
                            text = { Text("Set as viewer") },
                            onClick = {
                                menuExpanded = false
                                onChangeRole("viewer")
                            }
                        )
                    }
                    if (share.role != "editor") {
                        DropdownMenuItem(
                            text = { Text("Set as editor") },
                            onClick = {
                                menuExpanded = false
                                onChangeRole("editor")
                            }
                        )
                    }
                } else if (share.status == "pending") {
                    DropdownMenuItem(
                        text = { Text("Make viewer") },
                        onClick = {
                            menuExpanded = false
                            onChangeRole("viewer")
                        }
                    )
                    DropdownMenuItem(
                        text = { Text("Make editor") },
                        onClick = {
                            menuExpanded = false
                            onChangeRole("editor")
                        }
                    )
                }

                DropdownMenuItem(
                    text = {
                        Text(
                            text = "Revoke invitation",
                            color = MaterialTheme.colorScheme.error
                        )
                    },
                    onClick = {
                        menuExpanded = false
                        onRevoke()
                    }
                )
            }
        }
    }
}
