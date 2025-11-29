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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
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
import coil.compose.AsyncImage
import androidx.compose.ui.draw.blur

private data class CatalogListLayoutState(
    val catalogs: List<Catalog>,
    val shareUiState: CatalogShareUiState,
    val selectedTab: CatalogListTab,
    val catalogPreviews: Map<String, String?>,
    val showNavigationIcon: Boolean
)

private data class CatalogListLayoutHandlers(
    val callbacks: CatalogListCallbacks,
    val onRequestDeleteCatalog: (String, String) -> Unit,
    val onRequestPreview: (String) -> Unit
)

private data class AllCatalogsContent(
    val myCatalogs: List<Catalog>,
    val sharedCatalogs: List<CatalogShareEntry>,
    val catalogPreviews: Map<String, String?>,
    val isProcessingInvites: Boolean,
    val pendingInvitations: List<CatalogShareEntry>
)

private data class AllCatalogsCallbacks(
    val onOpenCatalog: (String) -> Unit,
    val onDeleteCatalog: (String, String) -> Unit,
    val onRespondToInvitation: (String, String) -> Unit,
    val onRequestPreview: (String) -> Unit
)

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

    var selectedTab by rememberSaveable { mutableStateOf(CatalogListTab.ALL_CATALOGS) }
    var catalogPendingDeleteId by rememberSaveable { mutableStateOf<String?>(null) }
    var catalogPendingDeleteName by rememberSaveable { mutableStateOf<String?>(null) }

    val callbacks = CatalogListCallbacks(
        onBack = state::navigateBack,
        onOpenCatalogEntries = state::openCatalogEntries,
        onOpenCatalog = state::openCatalog,
        onCreateCatalogClick = { state.creationDialogState.open() },
        onSelectMyTab = { selectedTab = CatalogListTab.MY_CATALOGS },
        onSelectSharedTab = { selectedTab = CatalogListTab.SHARED_CATALOGS },
        onSelectAllTab = { selectedTab = CatalogListTab.ALL_CATALOGS },
        onRespondToInvitation = { id, action -> state.shareViewModel.respondToInvitation(id, action) },
        onDeleteCatalog = { state.viewModel.deleteCatalog(it) }
    )

    val layoutState = CatalogListLayoutState(
        catalogs = state.catalogs,
        shareUiState = state.shareUiState,
        selectedTab = selectedTab,
        catalogPreviews = state.catalogPreviews,
        showNavigationIcon = state.showNavigationIcon
    )
    val layoutHandlers = CatalogListLayoutHandlers(
        callbacks = callbacks,
        onRequestDeleteCatalog = { catalogId, catalogName ->
            catalogPendingDeleteId = catalogId
            catalogPendingDeleteName = catalogName
        },
        onRequestPreview = state::requestCatalogPreview
    )
    CatalogListScreenLayout(
        layoutState = layoutState,
        snackbarHostState = state.snackbarHostState,
        handlers = layoutHandlers
    )

    CatalogCreationDialog(
        state = state.creationDialogState,
        onCreate = { name ->
            state.viewModel.createCatalog(name)
            state.creationDialogState.close(resetName = true)
        },
        onDismiss = { state.creationDialogState.close(resetName = false) }
    )

    if (catalogPendingDeleteId != null) {
        DeleteCatalogConfirmationDialog(
            catalogName = catalogPendingDeleteName,
            onConfirm = {
                catalogPendingDeleteId?.let { callbacks.onDeleteCatalog(it) }
                catalogPendingDeleteId = null
                catalogPendingDeleteName = null
            },
            onDismiss = {
                catalogPendingDeleteId = null
                catalogPendingDeleteName = null
            }
        )
    }
}

@Composable
private fun CatalogListScreenLayout(
    layoutState: CatalogListLayoutState,
    snackbarHostState: SnackbarHostState,
    handlers: CatalogListLayoutHandlers
) {
    CatalogListScaffold(
        snackbarHostState = snackbarHostState,
        showNavigationIcon = layoutState.showNavigationIcon,
        selectedTab = layoutState.selectedTab,
        callbacks = handlers.callbacks
    ) { paddingValues ->
        CatalogListBody(
            paddingValues = paddingValues,
            layoutState = layoutState,
            handlers = handlers
        )
    }
}

@Composable
private fun CatalogListScaffold(
    snackbarHostState: SnackbarHostState,
    showNavigationIcon: Boolean,
    selectedTab: CatalogListTab,
    callbacks: CatalogListCallbacks,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {},
        floatingActionButton = {
            if (selectedTab == CatalogListTab.MY_CATALOGS || selectedTab == CatalogListTab.ALL_CATALOGS) {
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
        }
    ) { paddingValues -> content(paddingValues) }
}

@Composable
private fun CatalogListBody(
    paddingValues: PaddingValues,
    layoutState: CatalogListLayoutState,
    handlers: CatalogListLayoutHandlers
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(16.dp),
        verticalArrangement = Arrangement.Top
    ) {
        ManageAllEntriesCard(onManageAll = handlers.callbacks.onOpenCatalogEntries)
        Spacer(modifier = Modifier.height(16.dp))

        CatalogTabSelector(
            selectedTab = layoutState.selectedTab,
            onMyCatalogs = handlers.callbacks.onSelectMyTab,
            onSharedCatalogs = handlers.callbacks.onSelectSharedTab,
            onAllCatalogs = handlers.callbacks.onSelectAllTab
        )
        Spacer(modifier = Modifier.height(16.dp))

        Box(modifier = Modifier.weight(1f, fill = true)) {
            when (layoutState.selectedTab) {
                CatalogListTab.MY_CATALOGS -> {
                    MyCatalogsSection(
                        catalogs = layoutState.catalogs,
                        onOpenCatalog = handlers.callbacks.onOpenCatalog,
                        onDeleteCatalog = handlers.onRequestDeleteCatalog,
                        catalogPreviews = layoutState.catalogPreviews,
                        onRequestPreview = handlers.onRequestPreview,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                CatalogListTab.SHARED_CATALOGS -> {
                    SharedCatalogsList(
                        invitations = layoutState.shareUiState.pendingInvitations,
                        isProcessing = layoutState.shareUiState.isProcessing,
                        onRespond = handlers.callbacks.onRespondToInvitation,
                        shares = layoutState.shareUiState.sharedCatalogs,
                        onOpenCatalog = handlers.callbacks.onOpenCatalog,
                        catalogPreviews = layoutState.catalogPreviews,
                        onRequestPreview = handlers.onRequestPreview
                    )
                }
                CatalogListTab.ALL_CATALOGS -> {
                    AllCatalogsList(
                        content = AllCatalogsContent(
                            myCatalogs = layoutState.catalogs,
                            sharedCatalogs = layoutState.shareUiState.sharedCatalogs,
                            catalogPreviews = layoutState.catalogPreviews,
                            isProcessingInvites = layoutState.shareUiState.isProcessing,
                            pendingInvitations = layoutState.shareUiState.pendingInvitations
                        ),
                        actions = AllCatalogsCallbacks(
                            onOpenCatalog = handlers.callbacks.onOpenCatalog,
                            onDeleteCatalog = handlers.onRequestDeleteCatalog,
                            onRespondToInvitation = handlers.callbacks.onRespondToInvitation,
                            onRequestPreview = handlers.onRequestPreview
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun CatalogTabSelector(
    selectedTab: CatalogListTab,
    onMyCatalogs: () -> Unit,
    onSharedCatalogs: () -> Unit,
    onAllCatalogs: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        val allSelected = selectedTab == CatalogListTab.ALL_CATALOGS
        val mySelected = selectedTab == CatalogListTab.MY_CATALOGS
        val sharedSelected = selectedTab == CatalogListTab.SHARED_CATALOGS

        FilterChip(
            selected = allSelected,
            onClick = onAllCatalogs,
            label = { Text("All Catalogs") }
        )
        FilterChip(
            selected = mySelected,
            onClick = onMyCatalogs,
            label = { Text("My Catalogs") }
        )
        FilterChip(
            selected = sharedSelected,
            onClick = onSharedCatalogs,
            label = { Text("Shared Catalogs") }
        )
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
private fun SharedCatalogsList(
    invitations: List<CatalogShareEntry>,
    isProcessing: Boolean,
    onRespond: (String, String) -> Unit,
    shares: List<CatalogShareEntry>,
    onOpenCatalog: (String) -> Unit,
    catalogPreviews: Map<String, String?>,
    onRequestPreview: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (invitations.isNotEmpty()) {
            item {
                CatalogInvitationsSection(
                    invitations = invitations,
                    isProcessing = isProcessing,
                    onRespond = onRespond
                )
            }
        }

        if (shares.isNotEmpty()) {
            item {
                SharedCatalogsSection(
                    shares = shares,
                    onOpenCatalog = onOpenCatalog,
                    catalogPreviews = catalogPreviews,
                    onRequestPreview = onRequestPreview
                )
            }
        } else {
            item {
                Text(
                    text = "No shared catalogs yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun AllCatalogsList(
    content: AllCatalogsContent,
    actions: AllCatalogsCallbacks
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "All Catalogs",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (content.pendingInvitations.isNotEmpty()) {
            item {
                CatalogInvitationsSection(
                    invitations = content.pendingInvitations,
                    isProcessing = content.isProcessingInvites,
                    onRespond = actions.onRespondToInvitation
                )
            }
        }

        if (content.myCatalogs.isEmpty() && content.sharedCatalogs.isEmpty()) {
            item {
                Text(
                    text = "No catalogs available yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (content.myCatalogs.isNotEmpty()) {
            items(items = content.myCatalogs, key = { it._id }) { catalog ->
                val previewUrl = content.catalogPreviews[catalog._id]
                val hasPreview = content.catalogPreviews.containsKey(catalog._id)
                CatalogCard(
                    catalogName = catalog.name,
                    description = catalog.description,
                    onOpen = { actions.onOpenCatalog(catalog._id) },
                    onDelete = { actions.onDeleteCatalog(catalog._id, catalog.name ?: "Catalog") },
                    previewUrl = previewUrl,
                    hasPreview = hasPreview,
                    requestPreview = { actions.onRequestPreview(catalog._id) }
                )
            }
        }

        if (content.sharedCatalogs.isNotEmpty()) {
            item {
                Text(
                    text = "Shared Catalogs",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            items(items = content.sharedCatalogs, key = { it._id }) { share ->
                val catalogId = share.catalog?._id ?: return@items
                val previewUrl = content.catalogPreviews[catalogId]
                val hasPreview = content.catalogPreviews.containsKey(catalogId)
                val ownerLabel = share.invitedBy?.let { resolveUserName(it) }
                    ?.takeIf { it.isNotBlank() }
                    ?: share.owner?.takeIf { it.isNotBlank() }
                    ?: "Unknown owner"
                SharedCatalogCard(
                    catalogName = share.catalog.name ?: "Catalog",
                    roleLabel = share.role.replaceFirstChar { it.uppercase() },
                    ownerLabel = ownerLabel,
                    onClick = { actions.onOpenCatalog(catalogId) },
                    previewUrl = previewUrl,
                    hasPreview = hasPreview,
                    requestPreview = { actions.onRequestPreview(catalogId) }
                )
            }
        }
    }
}
@Composable
private fun SharedCatalogsSection(
    shares: List<CatalogShareEntry>,
    onOpenCatalog: (String) -> Unit,
    catalogPreviews: Map<String, String?>,
    onRequestPreview: (String) -> Unit
) {
    if (shares.isEmpty()) return

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(text = "Catalogs shared with you", style = MaterialTheme.typography.titleMedium)
        shares.forEach { share ->
            val catalogId = share.catalog?._id ?: return@forEach
            val previewUrl = catalogPreviews[catalogId]
            val hasPreview = catalogPreviews.containsKey(catalogId)
            val ownerLabel = share.invitedBy?.let { resolveUserName(it) }
                ?.takeIf { it.isNotBlank() }
                ?: share.owner?.takeIf { it.isNotBlank() }
                ?: "Unknown owner"
            SharedCatalogCard(
                catalogName = share.catalog.name ?: "Catalog",
                roleLabel = share.role.replaceFirstChar { it.uppercase() },
                ownerLabel = ownerLabel,
                onClick = { onOpenCatalog(catalogId) },
                previewUrl = previewUrl,
                hasPreview = hasPreview,
                requestPreview = { onRequestPreview(catalogId) }
            )
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
    ownerLabel: String,
    onClick: () -> Unit,
    previewUrl: String?,
    hasPreview: Boolean,
    requestPreview: () -> Unit
) {
    LaunchedEffect(hasPreview) {
        if (!hasPreview) {
            requestPreview()
        }
    }

    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp),
        onClick = onClick
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            if (previewUrl != null) {
                AsyncImage(
                    model = previewUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .matchParentSize()
                        .blur(25.dp),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.65f),
                                    Color.Black.copy(alpha = 0.3f),
                                    Color.Black.copy(alpha = 0.75f)
                                )
                            )
                        )
                )
            } else {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(
                                    MaterialTheme.colorScheme.primary,
                                    MaterialTheme.colorScheme.primaryContainer
                                )
                            )
                        )
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        catalogName,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = "Role: $roleLabel",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                    Text(
                        text = "Owner: $ownerLabel",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.9f)
                    )
                }

                Text(
                    text = "Tap to open",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.85f)
                )
            }
        }
    }
}

@Composable
private fun MyCatalogsSection(
    catalogs: List<Catalog>,
    onOpenCatalog: (String) -> Unit,
    onDeleteCatalog: (String, String) -> Unit,
    catalogPreviews: Map<String, String?>,
    onRequestPreview: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        item {
            Text(
                text = "My Catalogs",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        if (catalogs.isEmpty()) {
            item {
                Text(
                    "No catalogs yet. Tap + to create one.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                )
            }
        } else {
            items(
                items = catalogs,
                key = { it._id }
            ) { catalog ->
                val previewUrl = catalogPreviews[catalog._id]
                val hasPreview = catalogPreviews.containsKey(catalog._id)
                CatalogCard(
                    catalogName = catalog.name,
                    description = catalog.description,
                    onOpen = { onOpenCatalog(catalog._id) },
                    onDelete = { onDeleteCatalog(catalog._id, catalog.name ?: "Catalog") },
                    previewUrl = previewUrl,
                    hasPreview = hasPreview,
                    requestPreview = { onRequestPreview(catalog._id) }
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
    onDelete: () -> Unit,
    previewUrl: String?,
    hasPreview: Boolean,
    requestPreview: () -> Unit
) {
    LaunchedEffect(hasPreview) {
        if (!hasPreview) {
            requestPreview()
        }
    }

    ElevatedCard(
        onClick = onOpen,
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
        ) {
            if (previewUrl != null) {
                AsyncImage(
                    model = previewUrl,
                    contentDescription = null,
                    modifier = Modifier
                        .matchParentSize()
                        .blur(25.dp),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.65f),
                                    Color.Black.copy(alpha = 0.3f),
                                    Color.Black.copy(alpha = 0.75f)
                                )
                            )
                        )
                )
            } else {
                Box(
                    modifier = Modifier
                        .matchParentSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(
                                    MaterialTheme.colorScheme.primary,
                                    MaterialTheme.colorScheme.primaryContainer
                                )
                            )
                        )
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.SpaceBetween
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
                            overflow = TextOverflow.Ellipsis,
                            color = Color.White
                        )
                        if (!description.isNullOrBlank()) {
                            Text(
                                text = description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.85f),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                    IconButton(
                        onClick = onDelete,
                        colors = IconButtonDefaults.iconButtonColors(
                            contentColor = Color.White
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Delete,
                            contentDescription = "Delete catalog"
                        )
                    }
                }

                Text(
                    text = "Tap to open",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.85f)
                )
            }
        }
    }
}

@Composable
private fun ManageAllEntriesCard(onManageAll: () -> Unit) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onManageAll,
        colors = CardDefaults.elevatedCardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "Manage all Observations",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Text(
                    text = "View and edit every observation across catalogs.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.List,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(32.dp)
            )
        }
    }
}

@Composable
private fun DeleteCatalogConfirmationDialog(
    catalogName: String?,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        },
        title = { Text("Delete catalog?") },
        text = {
            val name = catalogName?.takeIf { it.isNotBlank() } ?: "this catalog"
            Text("Are you sure you want to delete $name? This cannot be undone.")
        }
    )
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
private data class CatalogListScreenData(
    val catalogs: List<Catalog>,
    val shareUiState: CatalogShareUiState,
    val catalogPreviews: Map<String, String?>,
    val showNavigationIcon: Boolean
)

@Stable
private class CatalogListScreenState(
    val viewModel: CatalogViewModel,
    val shareViewModel: CatalogShareViewModel,
    val navController: NavController,
    val snackbarHostState: SnackbarHostState,
    val creationDialogState: CatalogCreationDialogState,
    private val data: CatalogListScreenData
) {
    val catalogs: List<Catalog> get() = data.catalogs
    val shareUiState: CatalogShareUiState get() = data.shareUiState
    val catalogPreviews: Map<String, String?> get() = data.catalogPreviews
    val showNavigationIcon: Boolean get() = data.showNavigationIcon

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

    fun requestCatalogPreview(catalogId: String) {
        viewModel.loadCatalogPreview(catalogId)
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
    val catalogPreviews by viewModel.catalogPreviews.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val creationDialogState = rememberCatalogCreationDialogState()

    return CatalogListScreenState(
        viewModel = viewModel,
        shareViewModel = shareViewModel,
        navController = navController,
        snackbarHostState = snackbarHostState,
        creationDialogState = creationDialogState,
        data = CatalogListScreenData(
            catalogs = catalogs,
            shareUiState = shareUiState,
            catalogPreviews = catalogPreviews,
            showNavigationIcon = showNavigationIcon
        )
    )
}

private data class CatalogListCallbacks(
    val onBack: () -> Unit,
    val onOpenCatalogEntries: () -> Unit,
    val onOpenCatalog: (String) -> Unit,
    val onCreateCatalogClick: () -> Unit,
    val onSelectMyTab: () -> Unit,
    val onSelectSharedTab: () -> Unit,
    val onSelectAllTab: () -> Unit,
    val onRespondToInvitation: (String, String) -> Unit,
    val onDeleteCatalog: (String) -> Unit
)

private enum class CatalogListTab { MY_CATALOGS, SHARED_CATALOGS, ALL_CATALOGS }
