@file:OptIn(ExperimentalMaterial3Api::class)
package com.cpen321.usermanagement.ui.screens

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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.List
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.ui.navigation.NavRoutes
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel




@Composable
fun CatalogListScreen(
    viewModel: CatalogViewModel,
    navController: NavController,
    showNavigationIcon: Boolean = true
) {
    val catalogs by viewModel.catalogs.collectAsState()
    val shareViewModel: CatalogShareViewModel = hiltViewModel()
    val shareUiState by shareViewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var showDialog by remember { mutableStateOf(false) }
    var newCatalogName by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        viewModel.loadCatalogs()
        shareViewModel.loadPendingInvitations()
        shareViewModel.loadSharedWithMe()
    }

    LaunchedEffect(shareUiState.successMessage, shareUiState.errorMessage) {
        val message = shareUiState.successMessage ?: shareUiState.errorMessage
        if (message != null) {
            snackbarHostState.showSnackbar(message)
            shareViewModel.clearMessages()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("My Catalogs") },
                navigationIcon = {
                    if (showNavigationIcon) {
                        IconButton(onClick = { navController.popBackStack() }) {
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
                onClick = { showDialog = true },
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(
                    Icons.Outlined.Add,
                    contentDescription = "Add Catalog",
                    tint = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.Top
        ) {
            ManageAllEntriesCard(
                onManageAll = { navController.navigate(NavRoutes.CATALOG_ENTRIES) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (shareUiState.pendingInvitations.isNotEmpty()) {
                CatalogInvitationsSection(
                    invitations = shareUiState.pendingInvitations,
                    isProcessing = shareUiState.isProcessing,
                    onRespond = { shareId, action -> shareViewModel.respondToInvitation(shareId, action) }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (shareUiState.sharedCatalogs.isNotEmpty()) {
                SharedCatalogsSection(
                    shares = shareUiState.sharedCatalogs,
                    onOpenCatalog = { catalogId ->
                        val route = NavRoutes.CATALOG_DETAIL.replace("{catalogId}", catalogId)
                        navController.navigate(route)
                    }
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (catalogs.isEmpty()) {
                Box(
                    modifier = Modifier
                        .weight(1f, fill = true)
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
                    modifier = Modifier
                        .weight(1f, fill = true)
                        .fillMaxWidth()
                ) {
                    items(catalogs) { catalog ->
                        CatalogCard(
                            catalogName = catalog.name,
                            description = catalog.description,
                            onOpen = {
                                val route = NavRoutes.CATALOG_DETAIL.replace("{catalogId}", catalog._id)
                                navController.navigate(route)
                            },
                            onDelete = { viewModel.deleteCatalog(catalog._id) }
                        )
                    }
                }
            }
        }
    }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    if (newCatalogName.isNotBlank()) {
                        viewModel.createCatalog(newCatalogName)
                        newCatalogName = ""
                    }
                    showDialog = false
                }) {
                    Text("Create")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel")
                }
            },
            title = { Text("New Catalog") },
            text = {
                OutlinedTextField(
                    value = newCatalogName,
                    onValueChange = { newCatalogName = it },
                    label = { Text("Catalog Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        )
    }
}

@Composable
private fun CatalogInvitationsSection(
    invitations: List<CatalogShareEntry>,
    isProcessing: Boolean,
    onRespond: (String, String) -> Unit
) {
    ElevatedCard(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Catalog invitations",
                style = MaterialTheme.typography.titleMedium
            )
            invitations.forEach { invitation ->
                val catalogName = invitation.catalog?.name?.takeIf { it.isNotBlank() }
                    ?: "Catalog"
                val inviterName = invitation.invitedBy?.name?.takeIf { it.isNotBlank() }
                    ?: invitation.invitedBy?.username?.takeIf { it.isNotBlank() }
                    ?: "Unknown"
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
                        Button(
                            onClick = { onRespond(invitation._id, "accept") },
                            enabled = !isProcessing,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Accept")
                        }
                        OutlinedButton(
                            onClick = { onRespond(invitation._id, "decline") },
                            enabled = !isProcessing,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        ) {
                            Text("Decline")
                        }
                    }
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun SharedCatalogsSection(
    shares: List<CatalogShareEntry>,
    onOpenCatalog: (String) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "Catalogs shared with you",
            style = MaterialTheme.typography.titleMedium
        )
        shares.forEach { share ->
            val catalogId = share.catalog?._id
            if (catalogId != null) {
                val catalogName = share.catalog?.name?.takeIf { it.isNotBlank() } ?: "Catalog"
                val roleLabel = share.role.replaceFirstChar { it.uppercase() }

                ElevatedCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onOpenCatalog(catalogId) }
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
                        share.invitedBy?.let { inviter ->
                            val inviterName = inviter.name?.takeIf { it.isNotBlank() }
                                ?: inviter.username?.takeIf { it.isNotBlank() }
                            if (!inviterName.isNullOrBlank()) {
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
        }
    }
}

@Composable
private fun ManageAllEntriesCard(
    onManageAll: () -> Unit
) {
    ElevatedCard(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp),
        onClick = onManageAll
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.List,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(48.dp)
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "All Observations",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "Browse every observation you have saved, regardless of catalog.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
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
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp),
        onClick = onOpen
    ) {
        val gradient = Brush.verticalGradient(
            colors = listOf(
                MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.18f)
            )
        )

        Box(
            modifier = Modifier
                .background(gradient)
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = catalogName,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!description.isNullOrBlank()) {
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    IconButton(onClick = onDelete) {
                        Icon(
                            imageVector = Icons.Outlined.Delete,
                            contentDescription = "Delete catalog",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }
        }
    }
}
