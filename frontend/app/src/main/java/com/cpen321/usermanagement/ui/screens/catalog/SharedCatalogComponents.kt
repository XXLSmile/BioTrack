package com.cpen321.usermanagement.ui.screens.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import androidx.compose.ui.layout.ContentScale
import com.cpen321.usermanagement.data.remote.dto.PublicUserSummary

internal fun resolveUserName(user: PublicUserSummary?): String {
    if (user == null) return "Unknown"
    return user.name?.takeIf { it.isNotBlank() }
        ?: user.username?.takeIf { it.isNotBlank() }
        ?: "Unknown"
}

@Composable
internal fun SharedCatalogCard(
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
        SharedCatalogCardBackground(previewUrl) {
            SharedCatalogCardContent(
                catalogName = catalogName,
                roleLabel = roleLabel,
                ownerLabel = ownerLabel
            )
        }
    }
}

@Composable
private fun SharedCatalogCardBackground(
    previewUrl: String?,
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        if (previewUrl != null) {
            AsyncImage(
                model = previewUrl,
                contentDescription = null,
                modifier = Modifier
                    .fillMaxSize()
                    .blur(25.dp),
                contentScale = ContentScale.Crop
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
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
                    .fillMaxSize()
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

        content()
    }
}

@Composable
private fun SharedCatalogCardContent(
    catalogName: String,
    roleLabel: String,
    ownerLabel: String
) {
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
