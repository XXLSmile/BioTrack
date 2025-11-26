@file:OptIn(ExperimentalMaterial3Api::class)

package com.cpen321.usermanagement.ui.screens.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary
import com.cpen321.usermanagement.ui.navigation.NavRoutes
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogShareUiState
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel

@Composable
fun CatalogListScreen(
    viewModel: CatalogViewModel,
    navController: NavController,
    showNavigationIcon: Boolean = true
) {
    val state = rememberCatalogListState(viewModel, navController, showNavigationIcon)
    CatalogListScreenHost(state)
}

@Composable
private fun CatalogListScreenHost(state: CatalogListScreenState) {
    CatalogListSideEffects(state)

    CatalogListScreenLayout(
        catalogs = state.catalogs,
        shareUiState = state.shareUiState,
        showNavigationIcon = state.showNavigationIcon,
        snackbarHostState = state.snackbarHostState,
        callbacks = CatalogListCallbacks(
            onBack = state::navigateBack,
            onOpenCatalogEntries = state::openCatalogEntries,
            onOpenCatalog = state::openCatalog,
            onCreateCatalogClick = { state.creationDialogState.open() },
            onRespondToInvitation = { id, action -> state.shareViewModel.respondToInvitation(id, action) },
            onDeleteCatalog = { state.viewModel.deleteCatalog(it) }
        )
    )

    CatalogCreationDialog(
        state = state.creationDialogState,
        onCreate = { name ->
            state.viewModel.createCatalog(name)
            state.creationDialogState.close(resetName = true)
        },
        onDismiss = { state.creationDialogState.close(resetName = false) }
    )
}

@Composable
private fun CatalogListScreenLayout(
    catalogs: List<Catalog>,
    shareUiState: CatalogShareUiState,
    showNavigationIcon: Boolean,
    snackbarHostState: SnackbarHostState,
    callbacks: CatalogListCallbacks
) {
    CatalogListScaffold(
        snackbarHostState = snackbarHostState,
        showNavigationIcon = showNavigationIcon,
        callbacks = callbacks
    ) { paddingValues ->
        CatalogListBody(
            paddingValues = paddingValues,
            catalogs = catalogs,
            shareUiState = shareUiState,
            callbacks = callbacks
        )
    }
}

@Composable
private fun CatalogListScaffold(
    snackbarHostState: SnackbarHostState,
    showNavigationIcon: Boolean,
    callbacks: CatalogListCallbacks,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("My Catalogs") },
                navigationIcon = {
                    if (showNavigationIcon) {
                        IconButton(onClick = callbacks.onBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back"
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = callbacks.onCreateCatalogClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    Icons.Outlined.Add,
                    contentDescription = "Add Catalog",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { paddingValues -> content(paddingValues) }
}

@Composable
private fun CatalogListBody(
    paddingValues: PaddingValues,
    catalogs: List<Catalog>,
    shareUiState: CatalogShareUiState,
    callbacks: CatalogListCallbacks
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(16.dp),
        verticalArrangement = Arrangement.Top
    ) {
        ManageAllEntriesCard(onManageAll = callbacks.onOpenCatalogEntries)
        Spacer(modifier = Modifier.height(16.dp))

        CatalogInvitationsSection(
            invitations = shareUiState.pendingInvitations,
            isProcessing = shareUiState.isProcessing,
            onRespond = callbacks.onRespondToInvitation
        )

        SharedCatalogsSection(
            shares = shareUiState.sharedCatalogs,
            onOpenCatalog = callbacks.onOpenCatalog
        )

        Box(modifier = Modifier.weight(1f, fill = true)) {
            CatalogGrid(
                catalogs = catalogs,
                onOpenCatalog = callbacks.onOpenCatalog,
                onDeleteCatalog = callbacks.onDeleteCatalog,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
private fun CatalogInvitationsSection(
    invitations: List<CatalogShareEntry>,
    isProcessing: Boolean,
    onRespond: (String, String) -> Unit
) {
    if (invitations.isEmpty()) return

    ElevatedCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(text = "Catalog invitations", style = MaterialTheme.typography.titleMedium)
            invitations.forEach { invitation ->
                CatalogInvitationRow(
                    invitation = invitation,
                    isProcessing = isProcessing,
                    onRespond = onRespond
                )
            }
        }
    }
    Spacer(modifier = Modifier.height(16.dp))
}

@Composable
private fun CatalogInvitationRow(
    invitation: CatalogShareEntry,
    isProcessing: Boolean,
    onRespond: (String, String) -> Unit
) {
    val catalogName = invitation.catalog?.name?.takeIf { it.isNotBlank() } ?: "Catalog"
    val inviterName = resolveUserName(invitation.invitedBy)

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(catalogName, style = MaterialTheme.typography.titleMedium)
        Text(
            text = "Invited by $inviterName",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = { onRespond(invitation._id, "accept") },
                enabled = !isProcessing,
                modifier = Modifier.weight(1f)
            ) {
                Text("Accept")
            }
            OutlinedButton(
                onClick = { onRespond(invitation._id, "decline") },
                enabled = !isProcessing,
                modifier = Modifier.weight(1f)
            ) {
                Text("Decline")
            }
        }
    }
    Spacer(modifier = Modifier.height(12.dp))
}

@Composable
private fun SharedCatalogsSection(
    shares: List<CatalogShareEntry>,
    onOpenCatalog: (String) -> Unit
) {
    if (shares.isEmpty()) return

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(text = "Catalogs shared with you", style = MaterialTheme.typography.titleMedium)
        shares.forEach { share ->
            val catalogId = share.catalog?._id
            if (catalogId != null) {
                SharedCatalogCard(
                    catalogName = share.catalog.name ?: "Catalog",
                    roleLabel = share.role.replaceFirstChar { it.uppercase() },
                    inviter = share.invitedBy,
                    onClick = { onOpenCatalog(catalogId) }
                )
            }
        }
    }
    Spacer(modifier = Modifier.height(16.dp))
}

private fun resolveUserName(user: PublicUserSummary?): String {
    if (user == null) return "Unknown"
    return user.name?.takeIf { it.isNotBlank() }
        ?: user.username?.takeIf { it.isNotBlank() }
        ?: "Unknown"
}

@Composable
private fun SharedCatalogCard(
    catalogName: String,
    roleLabel: String,
    inviter: PublicUserSummary?,
    onClick: () -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(catalogName, style = MaterialTheme.typography.titleMedium)
            Text(
                text = "Role: $roleLabel",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            inviter?.let { invitedBy ->
                val inviterName = resolveUserName(invitedBy)
                if (inviterName.isNotBlank()) {
                    Text(
                        text = "Shared by $inviterName",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun CatalogGrid(
    catalogs: List<Catalog>,
    onOpenCatalog: (String) -> Unit,
    onDeleteCatalog: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (catalogs.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "No catalogs yet. Tap + to create one.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
            )
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 180.dp),
            contentPadding = PaddingValues(bottom = 80.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = modifier.fillMaxWidth()
        ) {
            items(catalogs) { catalog ->
                CatalogCard(
                    catalogName = catalog.name,
                    description = catalog.description,
                    onOpen = { onOpenCatalog(catalog._id) },
                    onDelete = { onDeleteCatalog(catalog._id) }
                )
            }
        }
    }
}

@Composable
private fun CatalogCard(
    catalogName: String,
    description: String?,
    onOpen: () -> Unit,
    onDelete: () -> Unit
) {
    ElevatedCard(
        onClick = onOpen,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = catalogName,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!description.isNullOrBlank()) {
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                IconButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Outlined.Delete,
                        contentDescription = "Delete catalog"
                    )
                }
            }

            OutlinedButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.List,
                    contentDescription = null
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Open catalog")
            }
        }
    }
}

@Composable
private fun ManageAllEntriesCard(onManageAll: () -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onManageAll
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary,
                            MaterialTheme.colorScheme.primaryContainer
                        )
                    )
                )
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Manage all entries",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimary
                )
                Text(
                    text = "View and edit every observation across catalogs.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f)
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.List,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}

@Composable
private fun CatalogCreationDialog(
    state: CatalogCreationDialogState,
    onCreate: (String) -> Unit,
    onDismiss: () -> Unit
) {
    if (!state.isVisible) return

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    if (state.name.isNotBlank()) {
                        onCreate(state.name.trim())
                    } else {
                        onDismiss()
                    }
                }
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        title = { Text("New Catalog") },
        text = {
            OutlinedTextField(
                value = state.name,
                onValueChange = { state.updateName(it) },
                label = { Text("Catalog Name") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
    )
}

@Composable
private fun CatalogListSideEffects(state: CatalogListScreenState) {
    LaunchedEffect(Unit) {
        state.viewModel.loadCatalogs()
        state.shareViewModel.loadPendingInvitations()
        state.shareViewModel.loadSharedWithMe()
    }

    LaunchedEffect(state.shareUiState.successMessage, state.shareUiState.errorMessage) {
        val message = state.shareUiState.successMessage ?: state.shareUiState.errorMessage
        if (message != null) {
            state.snackbarHostState.showSnackbar(message)
            state.shareViewModel.clearMessages()
        }
    }
}

@Stable
private class CatalogCreationDialogState {
    var isVisible by mutableStateOf(false)
        private set
    var name by mutableStateOf("")
        private set

    fun open() {
        isVisible = true
    }

    fun close(resetName: Boolean) {
        isVisible = false
        if (resetName) {
            name = ""
        }
    }

    fun updateName(value: String) {
        name = value
    }
}

@Composable
private fun rememberCatalogCreationDialogState(): CatalogCreationDialogState {
    return remember { CatalogCreationDialogState() }
}

@Stable
private class CatalogListScreenState(
    val viewModel: CatalogViewModel,
    val shareViewModel: CatalogShareViewModel,
    val navController: NavController,
    val catalogs: List<Catalog>,
    val shareUiState: CatalogShareUiState,
    val snackbarHostState: SnackbarHostState,
    val creationDialogState: CatalogCreationDialogState,
    val showNavigationIcon: Boolean
) {
    fun navigateBack() {
        if (showNavigationIcon) {
            navController.popBackStack()
        }
    }

    fun openCatalogEntries() {
        navController.navigate(NavRoutes.CATALOG_ENTRIES)
    }

    fun openCatalog(catalogId: String) {
        val route = NavRoutes.CATALOG_DETAIL.replace("{catalogId}", catalogId)
        navController.navigate(route)
    }
}

@Composable
private fun rememberCatalogListState(
    viewModel: CatalogViewModel,
    navController: NavController,
    showNavigationIcon: Boolean
): CatalogListScreenState {
    val shareViewModel: CatalogShareViewModel = hiltViewModel()
    val catalogs by viewModel.catalogs.collectAsState()
    val shareUiState by shareViewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val creationDialogState = rememberCatalogCreationDialogState()

    return CatalogListScreenState(
        viewModel = viewModel,
        shareViewModel = shareViewModel,
        navController = navController,
        catalogs = catalogs,
        shareUiState = shareUiState,
        snackbarHostState = snackbarHostState,
        creationDialogState = creationDialogState,
        showNavigationIcon = showNavigationIcon
    )
}

private data class CatalogListCallbacks(
    val onBack: () -> Unit,
    val onOpenCatalogEntries: () -> Unit,
    val onOpenCatalog: (String) -> Unit,
    val onCreateCatalogClick: () -> Unit,
    val onRespondToInvitation: (String, String) -> Unit,
    val onDeleteCatalog: (String) -> Unit
)
