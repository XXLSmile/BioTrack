package com.cpen321.usermanagement.ui.screens.main

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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cpen321.usermanagement.data.model.RecentObservation

@Composable
internal fun MainScreenContent(
    snackBarHostState: SnackbarHostState,
    summary: MainScreenSummary,
    recentUi: RecentObservationsUi,
    actions: MainScreenActions
) {
    Scaffold(snackbarHost = { SnackbarHost(snackBarHostState) }) { paddingValues ->
        MainScreenList(
            paddingValues = paddingValues,
            summary = summary,
            recentUi = recentUi,
            actions = actions
        )
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

        item { StatsRow(summary.observations, summary.friends) }

        item { MonthlyGoalCard(current = summary.observations, goal = 50) }

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
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun MonthlyGoalCard(
    current: Int,
    goal: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Monthly Goal",
                style = MaterialTheme.typography.titleMedium,
                fontSize = 18.sp
            )
            LinearProgressIndicator(
                progress = { (current / goal.toFloat()).coerceIn(0f, 1f) },
                modifier = Modifier.fillMaxWidth(),
                trackColor = MaterialTheme.colorScheme.surface
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

@Composable
private fun RecentObservationsList(
    observations: List<RecentObservation>,
    onSelectObservation: (RecentObservation) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        observations.take(3).forEach { observation ->
            ObservationCard(observation = observation, onSelectObservation = onSelectObservation)
        }
    }
}

@Composable
private fun ObservationCard(
    observation: RecentObservation,
    onSelectObservation: (RecentObservation) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onSelectObservation(observation) }
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = observation.title,
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = observation.subtitle.takeIf { it.isNotBlank() } ?: "No details",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
