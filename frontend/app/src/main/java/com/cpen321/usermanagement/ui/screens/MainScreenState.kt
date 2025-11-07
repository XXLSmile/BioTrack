package com.cpen321.usermanagement.ui.screens

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.navigation.NavHostController
import androidx.hilt.navigation.compose.hiltViewModel
import com.cpen321.usermanagement.data.model.CatalogShareEntry
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareUiState
import com.cpen321.usermanagement.ui.viewmodels.CatalogShareViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.MainUiState
import com.cpen321.usermanagement.ui.viewmodels.MainViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileUiState
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import kotlinx.coroutines.CoroutineScope

@Stable
internal class MainScreenState(
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

internal data class MainScreenActions(
    val onIdentifyClick: () -> Unit,
    val onViewCatalogs: () -> Unit,
    val onViewAll: () -> Unit,
    val onRetry: () -> Unit,
    val onSelectObservation: (RecentObservation) -> Unit
)

internal data class MainScreenControllers(
    val mainViewModel: MainViewModel,
    val profileViewModel: ProfileViewModel,
    val catalogViewModel: CatalogViewModel,
    val catalogShareViewModel: CatalogShareViewModel,
    val navController: NavHostController,
    val snackBarHostState: SnackbarHostState,
    val coroutineScope: CoroutineScope
)

internal data class MainScreenUiSnapshots(
    val mainUiState: MainUiState,
    val profileUiState: ProfileUiState,
    val shareUiState: CatalogShareUiState
)

@Composable
internal fun rememberMainScreenState(
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

@Composable
internal fun rememberSharedCatalogOptions(
    sharedCatalogs: List<CatalogShareEntry>
): List<CatalogOption> {
    return remember(sharedCatalogs) {
        sharedCatalogs
            .filter { it.status == "accepted" && it.role == "editor" && it.catalog?._id != null }
            .map { CatalogOption(it.catalog!!._id, it.catalog.name ?: "Catalog") }
    }
}

internal fun buildMainScreenSummary(profileUiState: ProfileUiState): MainScreenSummary {
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

internal fun buildRecentObservationsUi(mainUiState: MainUiState): RecentObservationsUi {
    return RecentObservationsUi(
        observations = mainUiState.recentObservations,
        isLoading = mainUiState.isLoadingRecent,
        errorMessage = mainUiState.recentError
    )
}
