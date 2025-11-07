package com.cpen321.usermanagement.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.model.CatalogEntry as RemoteCatalogEntry
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.ui.components.ObservationListItem
import com.cpen321.usermanagement.ui.components.EntryAction
import com.cpen321.usermanagement.ui.components.EntryDetailDialog
import com.cpen321.usermanagement.ui.components.EntryDetailDialogCallbacks
import com.cpen321.usermanagement.ui.components.ConfirmEntryActionDialog
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareUiState
import com.cpen321.usermanagement.ui.navigation.NavRoutes
import com.cpen321.usermanagement.ui.viewmodels.MainUiState
import com.cpen321.usermanagement.ui.viewmodels.MainViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

@Composable
fun MainScreen(
    mainViewModel: MainViewModel,
    profileViewModel: ProfileViewModel,
    navController: NavHostController
) {
    val state = rememberMainScreenState(mainViewModel, profileViewModel, navController)
    MainScreenHost(state)
}

@Composable
private fun rememberNavigateToRoute(navController: NavHostController): (String) -> Unit {
    return remember(navController) {
        { route: String ->
            navController.navigate(route) {
                popUpTo(NavRoutes.HOME) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }
}

@Composable
private fun MainScreenHost(state: MainScreenState) {
    HandleMainScreenSideEffects(state)

    val actions = MainScreenActions(
        onIdentifyClick = { state.navigateToRoute(NavRoutes.IDENTIFY) },
        onViewCatalogs = { state.navigateToRoute(NavRoutes.CATALOGS) },
        onViewAll = { state.navigateToRoute(NavRoutes.CATALOG_ENTRIES) },
        onRetry = { state.mainViewModel.loadRecentObservations() },
        onSelectObservation = { observation ->
            if (observation.hasCoordinates) {
                state.navController.navigate(NavRoutes.observationDetail(observation.id))
            } else {
                state.entryDialogState.showEntry(observation.toCatalogEntry())
            }
        }
    )

    MainScreenContent(
        snackBarHostState = state.snackBarHostState,
        summary = state.summary,
        recentUi = state.recentUi,
        actions = actions
    )

    AddEntryToCatalogDialog(
        catalogViewModel = state.catalogViewModel,
        state = state.entryDialogState,
        additionalCatalogOptions = state.additionalCatalogOptions
    ) {
        state.mainViewModel.loadRecentObservations()
        state.profileViewModel.refreshStats()
        state.coroutineScope.launch {
            state.snackBarHostState.showSnackbar("Observation added to catalog")
        }
    }

    ObservationEntryDetailDialog(state = state.entryDialogState)

    ConfirmEntryDeletionDialog(
        catalogViewModel = state.catalogViewModel,
        state = state.entryDialogState
    ) {
        state.mainViewModel.loadRecentObservations()
        state.profileViewModel.refreshStats()
        state.coroutineScope.launch {
            state.snackBarHostState.showSnackbar("Observation deleted")
        }
    }
}

@Composable
private fun HandleMainScreenSideEffects(state: MainScreenState) {
    val user = state.profileUiState.user

    LaunchedEffect(user) {
        if (user == null) {
            state.profileViewModel.loadProfile()
        }
    }

    LaunchedEffect(Unit) {
        state.catalogShareViewModel.loadSharedWithMe()
        state.mainViewModel.loadRecentObservations()
    }

    LaunchedEffect(state.mainUiState.successMessage) {
        val message = state.mainUiState.successMessage
        if (message != null) {
            state.snackBarHostState.showSnackbar(message)
            state.mainViewModel.clearSuccessMessage()
        }
    }

    LaunchedEffect(state.entryDialogState.showAddDialog) {
        if (state.entryDialogState.showAddDialog) {
            state.catalogViewModel.loadCatalogs()
        }
    }

    LaunchedEffect(state.profileUiState.user?._id) {
        if (state.profileUiState.user != null) {
            state.mainViewModel.loadRecentObservations()
        }
    }
}

@Composable
private fun MainScreenList(
    paddingValues: PaddingValues,
    summary: MainScreenSummary,
    recentUi: RecentObservationsUi,
    actions: MainScreenActions
) {
    LazyColumn(
        modifier = Modifier
            .padding(paddingValues)
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            WelcomeCard(
                name = summary.name,
                location = summary.location,
                onIdentifyClick = actions.onIdentifyClick,
                onViewCatalogs = actions.onViewCatalogs
            )
        }

        item {
            StatsRow(
                observations = summary.observations,
                friends = summary.friends
            )
        }

        item {
            MonthlyGoalCard(current = summary.observations, goal = 50)
        }

        item {
            RecentObservationsSection(
                observations = recentUi.observations,
                isLoading = recentUi.isLoading,
                errorMessage = recentUi.errorMessage,
                onRetry = actions.onRetry,
                onViewAll = actions.onViewAll,
                onSelectObservation = actions.onSelectObservation
            )
        }
    }
}

@Composable
private fun AddEntryToCatalogDialog(
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
private fun ObservationEntryDetailDialog(state: EntryDialogState) {
    val entry = state.entry
    if (!state.showEntryDialog || entry == null) return

    EntryDetailDialog(
        entry = entry,
        isProcessing = state.isProcessing,
        errorMessage = state.errorMessage,
        canRemoveFromCatalog = false,
        callbacks = EntryDetailDialogCallbacks(
            onDismiss = {
                if (!state.isProcessing) {
                    state.dismissAll()
                }
            },
            onAddToCatalog = {
                if (!state.isProcessing) {
                    state.openAddDialog()
                }
            },
            onDeleteEntry = {
                if (!state.isProcessing) {
                    state.scheduleDelete()
                }
            }
        )
    )
}

@Composable
private fun ConfirmEntryDeletionDialog(
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

private fun performAddToCatalog(
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

private fun performDeleteEntry(
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

@Composable
private fun rememberSharedCatalogOptions(
    sharedCatalogs: List<CatalogShareEntry>
): List<CatalogOption> {
    return remember(sharedCatalogs) {
        sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }
}

internal data class MainScreenSummary(
    val name: String,
    val location: String,
    val observations: Int,
    val friends: Int
)

internal data class RecentObservationsUi(
    val observations: List<RecentObservation>,
    val isLoading: Boolean,
    val errorMessage: String?
)

@Stable
private class MainScreenState(
    private val controllers: MainScreenControllers,
    private val uiSnapshots: MainScreenUiSnapshots,
    val entryDialogState: EntryDialogState,
    val navigateToRoute: (String) -> Unit,
    val additionalCatalogOptions: List<CatalogOption>,
    val summary: MainScreenSummary,
    val recentUi: RecentObservationsUi
) {
    val mainViewModel: MainViewModel get() = controllers.mainViewModel
    val profileViewModel: ProfileViewModel get() = controllers.profileViewModel
    val catalogViewModel: CatalogViewModel get() = controllers.catalogViewModel
    val catalogShareViewModel: CatalogShareViewModel get() = controllers.catalogShareViewModel
    val navController: NavHostController get() = controllers.navController
    val snackBarHostState: SnackbarHostState get() = controllers.snackBarHostState
    val coroutineScope: CoroutineScope get() = controllers.coroutineScope
    val mainUiState: MainUiState get() = uiSnapshots.mainUiState
    val profileUiState: ProfileUiState get() = uiSnapshots.profileUiState
    val shareUiState: CatalogShareUiState get() = uiSnapshots.shareUiState
}

@Composable
private fun rememberMainScreenState(
    mainViewModel: MainViewModel,
    profileViewModel: ProfileViewModel,
    navController: NavHostController
): MainScreenState {
    val catalogViewModel: CatalogViewModel = hiltViewModel()
    val catalogShareViewModel: CatalogShareViewModel = hiltViewModel()
    val mainUiState by mainViewModel.uiState.collectAsState()
    val profileUiState by profileViewModel.uiState.collectAsState()
    val shareUiState by catalogShareViewModel.uiState.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()
    val entryDialogState = rememberEntryDialogState()
    val navigateToRoute = rememberNavigateToRoute(navController)
    val additionalCatalogOptions = rememberSharedCatalogOptions(shareUiState.sharedCatalogs)
    val summary = remember(profileUiState.user, profileUiState.stats) {
        buildMainScreenSummary(profileUiState)
    }
    val recentUi = remember(mainUiState) { buildRecentObservationsUi(mainUiState) }

    val controllers = MainScreenControllers(
        mainViewModel = mainViewModel,
        profileViewModel = profileViewModel,
        catalogViewModel = catalogViewModel,
        catalogShareViewModel = catalogShareViewModel,
        navController = navController,
        snackBarHostState = snackBarHostState,
        coroutineScope = coroutineScope
    )
    val snapshots = MainScreenUiSnapshots(
        mainUiState = mainUiState,
        profileUiState = profileUiState,
        shareUiState = shareUiState
    )

    return MainScreenState(
        controllers = controllers,
        uiSnapshots = snapshots,
        entryDialogState = entryDialogState,
        navigateToRoute = navigateToRoute,
        additionalCatalogOptions = additionalCatalogOptions,
        summary = summary,
        recentUi = recentUi
    )
}

private fun buildMainScreenSummary(profileUiState: ProfileUiState): MainScreenSummary {
    val user = profileUiState.user
    val stats = profileUiState.stats
    val name = user?.name ?: "Explorer"
    val location = user?.region?.takeIf { it.isNotBlank() }
        ?: user?.location?.takeIf { it.isNotBlank() }
        ?: "Unknown location"
    val observations = stats?.observationCount ?: user?.observationCount ?: 0
    val friends = stats?.friendCount ?: user?.friendCount ?: 0
    return MainScreenSummary(
        name = name,
        location = location,
        observations = observations,
        friends = friends
    )
}

private fun buildRecentObservationsUi(mainUiState: MainUiState): RecentObservationsUi {
    return RecentObservationsUi(
        observations = mainUiState.recentObservations,
        isLoading = mainUiState.isLoadingRecent,
        errorMessage = mainUiState.recentError
    )
}

@Stable
private class EntryDialogState {
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

    fun scheduleDelete() {
        entry?.let { pendingAction = EntryAction.Delete(it) }
    }

    fun clearPendingAction() {
        pendingAction = null
    }
}

@Composable
private fun rememberEntryDialogState(): EntryDialogState {
    return remember { EntryDialogState() }
}

@Composable
private fun WelcomeCard(
    name: String,
    location: String,
    onIdentifyClick: () -> Unit,
    onViewCatalogs: () -> Unit
) {
    val gradient = Brush.verticalGradient(
        colors = listOf(
            MaterialTheme.colorScheme.primary,
            MaterialTheme.colorScheme.primaryContainer
        )
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier
                .background(gradient)
                .padding(20.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                WelcomeCardHeader(name = name, location = location)
                WelcomeCardActions(onIdentifyClick = onIdentifyClick, onViewCatalogs = onViewCatalogs)
            }
        }
    }
}

@Composable
private fun WelcomeCardHeader(
    name: String,
    location: String
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "Welcome, $name!",
            style = MaterialTheme.typography.titleLarge,
            color = Color.White
        )
        Text(
            text = location,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.8f)
        )
    }
}

@Composable
private fun WelcomeCardActions(
    onIdentifyClick: () -> Unit,
    onViewCatalogs: () -> Unit
) {
    Button(
        onClick = onIdentifyClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(
            imageVector = Icons.Outlined.CameraAlt,
            contentDescription = null,
            modifier = Modifier.padding(end = 8.dp)
        )
        Text("Identify New Species")
    }

    Button(
        onClick = onViewCatalogs,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
        )
    ) {
        Icon(
            imageVector = Icons.Outlined.Collections,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSecondaryContainer,
            modifier = Modifier.padding(end = 8.dp)
        )
        Text(text = "View Catalogs")
    }
}

@Composable
private fun StatsRow(
    observations: Int,
    friends: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatCard(title = "Observations", value = observations, modifier = Modifier.weight(1f))
        StatCard(title = "Friends", value = friends, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun StatCard(
    title: String,
    value: Int,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .height(96.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.18f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
            )
        }
    }
}

@Composable
private fun MonthlyGoalCard(
    current: Int,
    goal: Int
) {
    val progress = (current.toFloat() / goal.toFloat()).coerceIn(0f, 1f)

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
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
                Text(
                    text = "Monthly Goal",
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = "${current.coerceAtMost(goal)}/$goal",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )

            val remaining = (goal - current).coerceAtLeast(0)
            Text(
                text = if (remaining > 0) {
                    "$remaining more observations to reach your goal!"
                } else {
                    "Goal reached! Great job!"
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun RecentObservationsSection(
    observations: List<RecentObservation>,
    isLoading: Boolean,
    errorMessage: String?,
    onRetry: () -> Unit,
    onViewAll: () -> Unit,
    onSelectObservation: (RecentObservation) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            RecentObservationsHeader(onViewAll = onViewAll)
            RecentObservationsContent(
                observations = observations,
                isLoading = isLoading,
                errorMessage = errorMessage,
                onRetry = onRetry,
                onSelectObservation = onSelectObservation
            )
        }
    }
}

@Composable
private fun RecentObservationsHeader(onViewAll: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "Recent Observations",
            style = MaterialTheme.typography.titleMedium
        )
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .padding(horizontal = 4.dp)
                .clickable(onClick = onViewAll)
        ) {
            Text(
                text = "View All",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun RecentObservationsContent(
    observations: List<RecentObservation>,
    isLoading: Boolean,
    errorMessage: String?,
    onRetry: () -> Unit,
    onSelectObservation: (RecentObservation) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when {
            isLoading -> RecentObservationsLoading()
            errorMessage != null -> RecentObservationsError(errorMessage, onRetry)
            observations.isEmpty() -> RecentObservationsEmpty()
            else -> RecentObservationsList(observations, onSelectObservation)
        }
    }
}

@Composable
private fun RecentObservationsLoading() {
    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
}

@Composable
private fun RecentObservationsError(
    errorMessage: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = errorMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error
        )
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

@Composable
private fun RecentObservationsEmpty() {
    Text(
        text = "No recent observations",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

internal data class MainScreenActions(
    val onIdentifyClick: () -> Unit,
    val onViewCatalogs: () -> Unit,
    val onViewAll: () -> Unit,
    val onRetry: () -> Unit,
    val onSelectObservation: (RecentObservation) -> Unit
)

private data class MainScreenControllers(
    val mainViewModel: MainViewModel,
    val profileViewModel: ProfileViewModel,
    val catalogViewModel: CatalogViewModel,
    val catalogShareViewModel: CatalogShareViewModel,
    val navController: NavHostController,
    val snackBarHostState: SnackbarHostState,
    val coroutineScope: CoroutineScope
)

private data class MainScreenUiSnapshots(
    val mainUiState: MainUiState,
    val profileUiState: ProfileUiState,
    val shareUiState: CatalogShareUiState
)

@Composable
private fun RecentObservationsList(
    observations: List<RecentObservation>,
    onSelectObservation: (RecentObservation) -> Unit
) {
    observations.forEachIndexed { index, observation ->
        ObservationListItem(
            observation = observation,
            onClick = { onSelectObservation(observation) }
        )
        if (index != observations.lastIndex) {
            HorizontalDivider()
        }
    }
}
