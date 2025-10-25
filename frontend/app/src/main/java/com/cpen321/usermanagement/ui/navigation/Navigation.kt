package com.cpen321.usermanagement.ui.navigation

import android.net.Uri
import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.ui.screens.AuthScreen
import com.cpen321.usermanagement.ui.screens.CameraScreen
import com.cpen321.usermanagement.ui.screens.CatalogDetailScreen
import com.cpen321.usermanagement.ui.screens.CatalogEntriesScreen
import com.cpen321.usermanagement.ui.screens.CatalogListScreen
import com.cpen321.usermanagement.ui.screens.FriendsScreen
import com.cpen321.usermanagement.ui.screens.IdentifyScreen
import com.cpen321.usermanagement.ui.screens.LoadingScreen
import com.cpen321.usermanagement.ui.screens.MainScreen
import com.cpen321.usermanagement.ui.screens.ManageProfileScreen
import com.cpen321.usermanagement.ui.screens.ProfileScreen
import com.cpen321.usermanagement.ui.screens.ProfileScreenActions
import com.cpen321.usermanagement.ui.screens.PublicProfileScreen
import com.cpen321.usermanagement.ui.screens.ObservationDetailScreen
import com.cpen321.usermanagement.ui.viewmodels.AuthViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogEntriesViewModel
import com.cpen321.usermanagement.ui.viewmodels.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.FriendViewModel
import com.cpen321.usermanagement.ui.viewmodels.MainViewModel
import com.cpen321.usermanagement.ui.viewmodels.NavigationViewModel
import com.cpen321.usermanagement.ui.viewmodels.PublicProfileViewModel
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel

object NavRoutes {
    const val LOADING = "loading"
    const val AUTH = "auth"

    const val HOME = "home"
    const val CATALOGS = "catalogs"
    const val IDENTIFY = "identify"
    const val FRIENDS = "friends"
    const val PROFILE = "profile"
    const val CATALOG_ENTRIES = "catalog_entries"

    const val MANAGE_PROFILE = "manage_profile"
    const val CAMERA = "camera"
    const val CATALOG_DETAIL = "catalog_detail/{catalogId}"
    const val OBSERVATION_DETAIL = "observation_detail/{entryId}"
    const val PUBLIC_PROFILE = "public_profile/{username}"

    fun observationDetail(entryId: String) = "observation_detail/$entryId"
    fun publicProfile(username: String) = "public_profile/$username"
}

private data class BottomNavItem(
    val route: String,
    @StringRes val labelRes: Int,
    val icon: androidx.compose.ui.graphics.vector.ImageVector
)

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    val navigationViewModel: NavigationViewModel = hiltViewModel()
    val navigationStateManager = navigationViewModel.navigationStateManager
    val navigationEvent by navigationStateManager.navigationEvent.collectAsState()

    // Initialize view models required for navigation-level scope
    val authViewModel: AuthViewModel = hiltViewModel()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val mainViewModel: MainViewModel = hiltViewModel()
    val friendViewModel: FriendViewModel = hiltViewModel()

    val bottomNavItems = remember {
        listOf(
            BottomNavItem(NavRoutes.HOME, R.string.bottom_nav_home, Icons.Outlined.Home),
            BottomNavItem(NavRoutes.CATALOGS, R.string.bottom_nav_catalogs, Icons.Outlined.Collections),
            BottomNavItem(NavRoutes.IDENTIFY, R.string.bottom_nav_identify, Icons.Outlined.CameraAlt),
            BottomNavItem(NavRoutes.FRIENDS, R.string.bottom_nav_friends, Icons.Outlined.Group),
            BottomNavItem(NavRoutes.PROFILE, R.string.bottom_nav_profile, Icons.Outlined.Person)
        )
    }
    val bottomRoutes = remember(bottomNavItems) { bottomNavItems.map(BottomNavItem::route).toSet() }

    // Handle navigation events from NavigationStateManager
    LaunchedEffect(navigationEvent) {
        handleNavigationEvent(
            navigationEvent,
            navController,
            navigationStateManager,
            authViewModel,
            mainViewModel,
            friendViewModel
        )
    }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute != null && currentRoute in bottomRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                BottomNavigationBar(
                    items = bottomNavItems,
                    currentRoute = currentRoute,
                    onItemSelected = { route ->
                        navController.navigate(route) {
                            popUpTo(NavRoutes.HOME) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        AppNavHost(
            navController = navController,
            authViewModel = authViewModel,
            profileViewModel = profileViewModel,
            mainViewModel = mainViewModel,
            friendViewModel = friendViewModel,
            navigationStateManager = navigationStateManager,
            modifier = Modifier.padding(innerPadding)
        )
    }
}

private fun handleNavigationEvent(
    navigationEvent: NavigationEvent,
    navController: NavHostController,
    navigationStateManager: NavigationStateManager,
    authViewModel: AuthViewModel,
    mainViewModel: MainViewModel,
    friendViewModel: FriendViewModel
) {
    when (navigationEvent) {
        is NavigationEvent.NavigateToAuth -> {
            friendViewModel.clearSearchState()
            navController.navigate(NavRoutes.AUTH) {
                popUpTo(0) { inclusive = true }
            }
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateToAuthWithMessage -> {
            friendViewModel.clearSearchState()
            authViewModel.setSuccessMessage(navigationEvent.message)
            navController.navigate(NavRoutes.AUTH) {
                popUpTo(0) { inclusive = true }
            }
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateToMain -> {
            navController.navigate(NavRoutes.HOME) {
                popUpTo(0) { inclusive = true }
            }
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateToMainWithMessage -> {
            mainViewModel.setSuccessMessage(navigationEvent.message)
            navController.navigate(NavRoutes.HOME) {
                popUpTo(0) { inclusive = true }
            }
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateToProfile -> {
            navController.navigate(NavRoutes.PROFILE) {
                popUpTo(NavRoutes.HOME)
                launchSingleTop = true
            }
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateToManageProfile -> {
            navController.navigate(NavRoutes.MANAGE_PROFILE)
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NavigateBack -> {
            navController.popBackStack()
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.ClearBackStack -> {
            navController.popBackStack(navController.graph.startDestinationId, false)
            navigationStateManager.clearNavigationEvent()
        }

        is NavigationEvent.NoNavigation -> Unit
    }
}

@Composable
private fun AppNavHost(
    navController: NavHostController,
    authViewModel: AuthViewModel,
    profileViewModel: ProfileViewModel,
    mainViewModel: MainViewModel,
    friendViewModel: FriendViewModel,
    navigationStateManager: NavigationStateManager,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = NavRoutes.LOADING,
        modifier = modifier
    ) {
        composable(NavRoutes.LOADING) {
            LoadingScreen(message = stringResource(R.string.checking_authentication))
        }

        composable(NavRoutes.AUTH) {
            AuthScreen(authViewModel = authViewModel, profileViewModel = profileViewModel)
        }

        composable(NavRoutes.HOME) {
            MainScreen(
                mainViewModel = mainViewModel,
                profileViewModel = profileViewModel,
                navController = navController
            )
        }

        composable(NavRoutes.CATALOGS) {
            val catalogViewModel: CatalogViewModel = hiltViewModel()
            CatalogListScreen(viewModel = catalogViewModel, navController = navController, showNavigationIcon = false)
        }

        composable(NavRoutes.CATALOG_ENTRIES) {
            val viewModel: CatalogEntriesViewModel = hiltViewModel()
            CatalogEntriesScreen(navController = navController, viewModel = viewModel)
        }

        composable(NavRoutes.IDENTIFY) {
            IdentifyScreen(onOpenCamera = { navController.navigate(NavRoutes.CAMERA) })
        }

        composable(NavRoutes.FRIENDS) {
            FriendsScreen(
                viewModel = friendViewModel,
                onUserSelected = { user ->
                    user.username?.let { username ->
                        navController.navigate(NavRoutes.publicProfile(Uri.encode(username)))
                    }
                }
            )
        }

        composable(NavRoutes.PROFILE) {
            ProfileScreen(
                authViewModel = authViewModel,
                profileViewModel = profileViewModel,
                actions = ProfileScreenActions(
                    onManageProfileClick = { navigationStateManager.navigateToManageProfile() },
                    onAccountDeleted = { navigationStateManager.handleAccountDeletion() },
                    onLogoutClick = { authViewModel.logout() }
                )
            )
        }

        composable(NavRoutes.MANAGE_PROFILE) {
            ManageProfileScreen(
                profileViewModel = profileViewModel,
                onBackClick = { navigationStateManager.navigateBack() }
            )
        }

        composable(NavRoutes.CAMERA) {
            CameraScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.CATALOG_DETAIL) { backStackEntry ->
            val catalogId = backStackEntry.arguments?.getString("catalogId") ?: return@composable
            val catalogViewModel: CatalogViewModel = hiltViewModel()
            CatalogDetailScreen(catalogId = catalogId, viewModel = catalogViewModel, navController = navController)
        }

        composable(NavRoutes.OBSERVATION_DETAIL) { backStackEntry ->
            val entryId = backStackEntry.arguments?.getString("entryId") ?: return@composable
            ObservationDetailScreen(
                observationId = entryId,
                mainViewModel = mainViewModel,
                onBack = { navController.popBackStack() }
            )
        }

        composable(NavRoutes.PUBLIC_PROFILE) { backStackEntry ->
            val usernameParam = backStackEntry.arguments?.getString("username") ?: return@composable
            val username = Uri.decode(usernameParam)
            val publicProfileViewModel: PublicProfileViewModel = hiltViewModel()
            PublicProfileScreen(
                username = username,
                viewModel = publicProfileViewModel,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

@Composable
private fun BottomNavigationBar(
    items: List<BottomNavItem>,
    currentRoute: String?,
    onItemSelected: (String) -> Unit
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        items.forEach { item ->
            val selected = currentRoute != null && currentRoute == item.route
            NavigationBarItem(
                selected = selected,
                onClick = { onItemSelected(item.route) },
                icon = {
                    androidx.compose.material3.Icon(
                        imageVector = item.icon,
                        contentDescription = stringResource(item.labelRes)
                    )
                },
                label = { Text(text = stringResource(item.labelRes)) },
                alwaysShowLabel = true,
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}
