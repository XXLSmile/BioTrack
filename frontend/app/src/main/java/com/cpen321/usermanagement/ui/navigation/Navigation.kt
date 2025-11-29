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
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.ui.screens.auth.AuthScreen
import com.cpen321.usermanagement.ui.screens.camera.CameraScreen
import com.cpen321.usermanagement.ui.screens.catalog.CatalogDetailScreen
import com.cpen321.usermanagement.ui.screens.catalog.CatalogEntriesScreen
import com.cpen321.usermanagement.ui.screens.catalog.CatalogListScreen
import com.cpen321.usermanagement.ui.screens.common.LoadingScreen
import com.cpen321.usermanagement.ui.screens.friends.FriendsScreen
import com.cpen321.usermanagement.ui.screens.identify.IdentifyScreen
import com.cpen321.usermanagement.ui.screens.main.MainScreen
import com.cpen321.usermanagement.ui.screens.observation.ObservationDetailScreen
import com.cpen321.usermanagement.ui.screens.profile.ManageProfileScreen
import com.cpen321.usermanagement.ui.screens.profile.ProfileScreen
import com.cpen321.usermanagement.ui.screens.profile.ProfileScreenActions
import com.cpen321.usermanagement.ui.screens.profile.PublicProfileScreen
import com.cpen321.usermanagement.ui.viewmodels.auth.AuthViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogEntriesViewModel
import com.cpen321.usermanagement.ui.viewmodels.catalog.CatalogViewModel
import com.cpen321.usermanagement.ui.viewmodels.friends.FriendViewModel
import com.cpen321.usermanagement.ui.viewmodels.main.MainViewModel
import com.cpen321.usermanagement.ui.viewmodels.navigation.NavigationViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.ProfileViewModel
import com.cpen321.usermanagement.ui.viewmodels.profile.PublicProfileViewModel

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

    val dependencies = rememberNavigationDependencies()
    val bottomNavState = rememberBottomNavState()

    HandleNavigationEvents(
        navigationEvent = navigationEvent,
        navController = navController,
        navigationStateManager = navigationStateManager,
        dependencies = dependencies
    )

    AppNavigationScaffold(
        navController = navController,
        bottomNavState = bottomNavState,
        dependencies = dependencies,
        navigationStateManager = navigationStateManager
    )
}

@Composable
private fun HandleNavigationEvents(
    navigationEvent: NavigationEvent,
    navController: NavHostController,
    navigationStateManager: NavigationStateManager,
    dependencies: NavigationDependencies
) {
    LaunchedEffect(navigationEvent) {
        handleNavigationEvent(
            navigationEvent = navigationEvent,
            navController = navController,
            navigationStateManager = navigationStateManager,
            authViewModel = dependencies.authViewModel,
            mainViewModel = dependencies.mainViewModel,
            friendViewModel = dependencies.friendViewModel
        )
    }
}

@Composable
private fun AppNavigationScaffold(
    navController: NavHostController,
    bottomNavState: BottomNavigationState,
    dependencies: NavigationDependencies,
    navigationStateManager: NavigationStateManager
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val showBottomBar = currentRoute != null && currentRoute in bottomNavState.routes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                BottomNavigationBar(
                    items = bottomNavState.items,
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
            dependencies = dependencies,
            navigationStateManager = navigationStateManager,
            modifier = Modifier.padding(innerPadding)
        )
    }
}

@Composable
private fun rememberNavigationDependencies(): NavigationDependencies {
    val authViewModel: AuthViewModel = hiltViewModel()
    val profileViewModel: ProfileViewModel = hiltViewModel()
    val mainViewModel: MainViewModel = hiltViewModel()
    val friendViewModel: FriendViewModel = hiltViewModel()
    return remember(authViewModel, profileViewModel, mainViewModel, friendViewModel) {
        NavigationDependencies(
            authViewModel = authViewModel,
            profileViewModel = profileViewModel,
            mainViewModel = mainViewModel,
            friendViewModel = friendViewModel
        )
    }
}

@Composable
private fun rememberBottomNavState(): BottomNavigationState {
    val items = remember {
        listOf(
            BottomNavItem(NavRoutes.HOME, R.string.bottom_nav_home, Icons.Outlined.Home),
            BottomNavItem(NavRoutes.CATALOGS, R.string.bottom_nav_catalogs, Icons.Outlined.Collections),
            BottomNavItem(NavRoutes.IDENTIFY, R.string.bottom_nav_identify, Icons.Outlined.CameraAlt),
            BottomNavItem(NavRoutes.FRIENDS, R.string.bottom_nav_friends, Icons.Outlined.Group),
            BottomNavItem(NavRoutes.PROFILE, R.string.bottom_nav_profile, Icons.Outlined.Person)
        )
    }
    val routes = remember(items) { items.map(BottomNavItem::route).toSet() }
    return remember(items, routes) { BottomNavigationState(items = items, routes = routes) }
}

private data class NavigationDependencies(
    val authViewModel: AuthViewModel,
    val profileViewModel: ProfileViewModel,
    val mainViewModel: MainViewModel,
    val friendViewModel: FriendViewModel
)

private data class BottomNavigationState(
    val items: List<BottomNavItem>,
    val routes: Set<String>
)

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
    dependencies: NavigationDependencies,
    navigationStateManager: NavigationStateManager,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = NavRoutes.LOADING,
        modifier = modifier
    ) {
        addAuthenticationRoutes(
            authViewModel = dependencies.authViewModel,
            profileViewModel = dependencies.profileViewModel
        )
        addHomeRoutes(
            navController = navController,
            mainViewModel = dependencies.mainViewModel,
            profileViewModel = dependencies.profileViewModel
        )
        addCatalogRoutes(navController)
        addIdentifyAndCameraRoutes(navController)
        addFriendRoutes(navController, dependencies.friendViewModel, dependencies.profileViewModel)
        addProfileRoutes(dependencies, navigationStateManager)
        addObservationRoutes(navController, dependencies.mainViewModel)
    }
}

private fun NavGraphBuilder.addAuthenticationRoutes(
    authViewModel: AuthViewModel,
    profileViewModel: ProfileViewModel
) {
    composable(NavRoutes.LOADING) {
        LoadingScreen(message = stringResource(R.string.checking_authentication))
    }

    composable(NavRoutes.AUTH) {
        AuthScreen(authViewModel = authViewModel, profileViewModel = profileViewModel)
    }
}

private fun NavGraphBuilder.addHomeRoutes(
    navController: NavHostController,
    mainViewModel: MainViewModel,
    profileViewModel: ProfileViewModel
) {
    composable(NavRoutes.HOME) {
        MainScreen(
            mainViewModel = mainViewModel,
            profileViewModel = profileViewModel,
            navController = navController
        )
    }
}

private fun NavGraphBuilder.addCatalogRoutes(navController: NavHostController) {
    composable(NavRoutes.CATALOGS) {
        val catalogViewModel: CatalogViewModel = hiltViewModel()
        CatalogListScreen(
            viewModel = catalogViewModel,
            navController = navController,
            showNavigationIcon = false
        )
    }

    composable(NavRoutes.CATALOG_ENTRIES) {
        val viewModel: CatalogEntriesViewModel = hiltViewModel()
        CatalogEntriesScreen(navController = navController, viewModel = viewModel)
    }

    composable(NavRoutes.CATALOG_DETAIL) { backStackEntry ->
        val catalogId = backStackEntry.arguments?.getString("catalogId")
        if (catalogId != null) {
            val catalogViewModel: CatalogViewModel = hiltViewModel()
            CatalogDetailScreen(
                catalogId = catalogId,
                viewModel = catalogViewModel,
                navController = navController
            )
        }
    }
}

private fun NavGraphBuilder.addIdentifyAndCameraRoutes(navController: NavHostController) {
    composable(NavRoutes.IDENTIFY) {
        IdentifyScreen(onOpenCamera = { navController.navigate(NavRoutes.CAMERA) })
    }

    composable(NavRoutes.CAMERA) {
        CameraScreen(onBack = { navController.popBackStack() })
    }
}

private fun NavGraphBuilder.addFriendRoutes(
    navController: NavHostController,
    friendViewModel: FriendViewModel,
    profileViewModel: ProfileViewModel
) {
    composable(NavRoutes.FRIENDS) {
        FriendsScreen(
            viewModel = friendViewModel,
            profileViewModel = profileViewModel,
            onUserSelected = { user ->
                user.username?.let { username ->
                    navController.navigate(NavRoutes.publicProfile(Uri.encode(username)))
                }
            }
        )
    }

    composable(NavRoutes.PUBLIC_PROFILE) { backStackEntry ->
        val usernameParam = backStackEntry.arguments?.getString("username")
        if (usernameParam != null) {
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

private fun NavGraphBuilder.addProfileRoutes(
    dependencies: NavigationDependencies,
    navigationStateManager: NavigationStateManager
) {
    composable(NavRoutes.PROFILE) {
        ProfileScreen(
            authViewModel = dependencies.authViewModel,
            profileViewModel = dependencies.profileViewModel,
            actions = ProfileScreenActions(
                onManageProfileClick = { navigationStateManager.navigateToManageProfile() },
                onAccountDeleted = { navigationStateManager.handleAccountDeletion() },
                onLogoutClick = { dependencies.authViewModel.logout() }
            )
        )
    }

    composable(NavRoutes.MANAGE_PROFILE) {
        ManageProfileScreen(
            profileViewModel = dependencies.profileViewModel,
            onBackClick = { navigationStateManager.navigateBack() }
        )
    }
}

private fun NavGraphBuilder.addObservationRoutes(
    navController: NavHostController,
    mainViewModel: MainViewModel
) {
    composable(NavRoutes.OBSERVATION_DETAIL) { backStackEntry ->
        val entryId = backStackEntry.arguments?.getString("entryId")
        if (entryId != null) {
            ObservationDetailScreen(
                observationId = entryId,
                mainViewModel = mainViewModel,
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
