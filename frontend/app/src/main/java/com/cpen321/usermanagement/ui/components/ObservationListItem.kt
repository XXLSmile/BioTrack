package com.cpen321.usermanagement.ui.components
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.cpen321.usermanagement.data.model.RecentObservation

/**
 * Shared row for displaying catalog observations. Accepts optional click and trailing content.
 */
@Composable
fun ObservationListItem(
    observation: RecentObservation,
    modifier: Modifier = Modifier,
    trailingContent: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ObservationThumbnail(imageUrl = observation.imageUrl)
        Box(modifier = Modifier.weight(1f)) {
            ObservationMetadataContent(observation = observation)
        }
        ObservationTrailing(trailingContent = trailingContent)
    }
}

@Composable
private fun ObservationThumbnail(imageUrl: String?) {
    val shape = RoundedCornerShape(12.dp)
    if (!imageUrl.isNullOrBlank()) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(imageUrl)
                .crossfade(true)
                .build(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(56.dp)
                .clip(shape)
        )
    } else {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(shape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.Image,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ObservationMetadataContent(observation: RecentObservation) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = observation.title,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
        )
        observation.subtitle.takeIf { it.isNotBlank() }?.let {
            ObservationMetadataRow(it)
        }
        observation.displayLocation.takeIf { it.isNotBlank() }?.let {
            ObservationMetadataRow(it)
        }
        observation.createdAt?.let { createdAt ->
            ObservationMetadataRow(
                "Observed ${createdAt.toLocalDate()} at ${createdAt.toLocalTime().withNano(0)}"
            )
        }
        observation.notes?.takeIf { it.isNotBlank() }?.let { notes ->
            ObservationMetadataRow(notes)
        }
    }
}

@Composable
private fun ObservationMetadataRow(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun ObservationTrailing(trailingContent: @Composable (() -> Unit)?) {
    val content = trailingContent ?: {
        Icon(
            imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
    content()
}
