package com.cpen321.usermanagement.ui.screens.main

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.navigation.NavHostController
import com.cpen321.usermanagement.data.model.RecentObservation
import com.cpen321.usermanagement.ui.components.toCatalogEntry
import com.cpen321.usermanagement.ui.navigation.NavRoutes
import com.cpen321.usermanagement.ui.viewmodels.main.MainViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel
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
internal fun rememberNavigateToRoute(navController: NavHostController): (String) -> Unit {
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
            handleObservationSelection(state, observation)
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
        state.mainUiState.successMessage?.let { message ->
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

private fun handleObservationSelection(state: MainScreenState, observation: RecentObservation) {
    if (observation.hasCoordinates) {
        state.navController.navigate(NavRoutes.observationDetail(observation.id))
    } else {
        state.entryDialogState.showEntry(observation.toCatalogEntry())
    }
}
