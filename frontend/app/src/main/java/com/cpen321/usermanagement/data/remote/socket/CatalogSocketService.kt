package com.cpen321.usermanagement.data.remote.socket

import android.util.Log
import com.cpen321.usermanagement.BuildConfig
import com.cpen321.usermanagement.data.model.Catalog
import com.cpen321.usermanagement.data.model.CatalogEntry
import com.google.gson.Gson
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.engineio.client.transports.WebSocket
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import org.json.JSONObject
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class CatalogSocketService @Inject constructor() {

    companion object {
        private const val TAG = "CatalogSocketService"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private val gson = Gson()

    private var socket: Socket? = null
    private var authToken: String? = null
    private val joinedCatalogs = mutableSetOf<String>()

    private val _events = MutableSharedFlow<CatalogSocketEvent>(
        replay = 0,
        extraBufferCapacity = 32,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val events: SharedFlow<CatalogSocketEvent> = _events.asSharedFlow()

    fun updateAuthToken(token: String?) {
        scope.launch {
            mutex.withLock {
                if (token == authToken) {
                    return@withLock
                }

                authToken = token
                joinedCatalogs.clear()
                disconnectLocked()
            }
        }
    }

    fun disconnect() {
        scope.launch {
            mutex.withLock {
                joinedCatalogs.clear()
                disconnectLocked()
                authToken = null
            }
        }
    }

    suspend fun joinCatalog(catalogId: String): Result<Unit> {
        return runCatching {
            val activeSocket = ensureSocket()
            suspendCancellableCoroutine { continuation ->
                val ack = Ack { args ->
                    val response = args.firstOrNull()
                    val ok = when (response) {
                        null -> true
                        is JSONObject -> response.optBoolean("ok", false)
                        is Map<*, *> -> ((response as Map<*, *>)["ok"] as? Boolean) == true
                        is Boolean -> response
                        else -> false
                    }

                    if (ok) {
                        scope.launch {
                            mutex.withLock {
                                joinedCatalogs.add(catalogId)
                            }
                        }
                        if (!continuation.isCompleted) {
                            continuation.resume(Unit)
                        }
                    } else {
                        val message = when (response) {
                            is JSONObject -> response.optString("error", "Failed to join catalog")
                            is Map<*, *> -> ((response as Map<*, *>)["error"] as? String) ?: "Failed to join catalog"
                            is String -> response
                            else -> "Failed to join catalog"
                        }
                        if (!continuation.isCompleted) {
                            continuation.resumeWithException(IllegalStateException(message))
                        }
                    }
                }

                activeSocket.emit("catalog:join", catalogId, ack)
            }
        }
    }

    fun leaveCatalog(catalogId: String) {
        scope.launch {
            mutex.withLock {
                joinedCatalogs.remove(catalogId)
                socket?.emit("catalog:leave", catalogId)
            }
        }
    }

    private suspend fun ensureSocket(): Socket {
        val token = mutex.withLock { authToken }
        require(!token.isNullOrBlank()) {
            "Socket token not set. Ensure user is authenticated."
        }

        return mutex.withLock {
            val existing = socket
            if (existing != null) {
                if (!existing.connected()) {
                    existing.connect()
                }
                return@withLock existing
            }

            val options = IO.Options().apply {
                reconnection = true
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 2_000
                timeout = 10_000
                transports = arrayOf(WebSocket.NAME, "polling")
                val encoded = URLEncoder.encode(token, StandardCharsets.UTF_8.toString())
                query = "token=$encoded"
                extraHeaders = mapOf(
                    "Authorization" to listOf("Bearer $token")
                )
            }

            val socketUrl = resolveSocketBaseUrl()
            val newSocket = IO.socket(socketUrl, options)
            configureListeners(newSocket)
            socket = newSocket
            newSocket.connect()
            newSocket
        }
    }

    private fun disconnectLocked() {
        socket?.let {
            it.off()
            if (it.connected()) {
                it.disconnect()
            }
            it.close()
        }
        socket = null
    }

    private fun configureListeners(socket: Socket) {
        setupConnectListener(socket)
        setupDisconnectListener(socket)
        setupErrorListener(socket)
        setupEntriesUpdatedListener(socket)
        setupMetadataUpdatedListener(socket)
        setupDeletionListener(socket)
    }

    private fun setupConnectListener(socket: Socket) {
        socket.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected")
            scope.launch {
                val catalogs = mutex.withLock { joinedCatalogs.toList() }
                catalogs.forEach { catalogId ->
                    socket.emit("catalog:join", catalogId)
                }
            }
        }
    }

    private fun setupDisconnectListener(socket: Socket) {
        socket.on(Socket.EVENT_DISCONNECT) { args ->
            Log.d(TAG, "Socket disconnected: ${args?.joinToString()}")
        }
    }

    private fun setupErrorListener(socket: Socket) {
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val message = args?.joinToString() ?: "Unknown error"
            Log.e(TAG, "Socket connect error: $message")
            _events.tryEmit(CatalogSocketEvent.Error("Socket connection error"))
        }
    }

    private fun setupEntriesUpdatedListener(socket: Socket) {
        socket.on("catalog:entries-updated") { args ->
            parseEntriesPayload(args)?.let { payload ->
                val catalogId = payload.catalogId ?: return@let
                val entries = payload.entries ?: return@let
                _events.tryEmit(
                    CatalogSocketEvent.EntriesUpdated(
                        catalogId = catalogId,
                        entries = entries,
                        updatedAt = payload.updatedAt
                    )
                )
            }
        }
    }

    private fun setupMetadataUpdatedListener(socket: Socket) {
        socket.on("catalog:metadata-updated") { args ->
            parseCatalogPayload(args)?.let { payload ->
                val catalogId = payload.catalogId ?: return@let
                val catalog = payload.catalog ?: return@let
                _events.tryEmit(
                    CatalogSocketEvent.MetadataUpdated(
                        catalogId = catalogId,
                        catalog = catalog,
                        updatedAt = payload.updatedAt
                    )
                )
            }
        }
    }

    private fun setupDeletionListener(socket: Socket) {
        socket.on("catalog:deleted") { args ->
            parseDeletionPayload(args)?.let { payload ->
                val catalogId = payload.catalogId ?: return@let
                scope.launch {
                    mutex.withLock {
                        joinedCatalogs.remove(catalogId)
                    }
                }
                _events.tryEmit(
                    CatalogSocketEvent.CatalogDeleted(
                        catalogId = catalogId,
                        timestamp = payload.timestamp
                    )
                )
            }
        }
    }

    private fun resolveSocketBaseUrl(): String {
        var base = BuildConfig.API_BASE_URL.trim()

        if (base.endsWith("/")) {
            base = base.dropLast(1)
        }

        if (base.endsWith("/api")) {
            base = base.substring(0, base.length - 4)
        }

        return base.ifEmpty { BuildConfig.API_BASE_URL }
    }

    private fun parseEntriesPayload(args: Array<out Any>?): EntriesPayload? {
        val json = args?.firstOrNull() ?: return null
        return runCatching {
            val payload = gson.fromJson(json.toString(), EntriesPayload::class.java)
            if (payload.catalogId.isNullOrBlank() || payload.entries.isNullOrEmpty()) {
                null
            } else {
                payload
            }
        }.getOrNull()
    }

    private fun parseCatalogPayload(args: Array<out Any>?): CatalogPayload? {
        val json = args?.firstOrNull() ?: return null
        return runCatching {
            val payload = gson.fromJson(json.toString(), CatalogPayload::class.java)
            if (payload.catalogId.isNullOrBlank() || payload.catalog == null) {
                null
            } else {
                payload
            }
        }.getOrNull()
    }

    private fun parseDeletionPayload(args: Array<out Any>?): DeletionPayload? {
        val json = args?.firstOrNull() ?: return null
        return runCatching {
            val payload = gson.fromJson(json.toString(), DeletionPayload::class.java)
            if (payload.catalogId.isNullOrBlank()) {
                null
            } else {
                payload
            }
        }.getOrNull()
    }

    private data class EntriesPayload(
        val catalogId: String?,
        val entries: List<CatalogEntry>?,
        val triggeredBy: String?,
        val updatedAt: String?
    )

    private data class CatalogPayload(
        val catalogId: String?,
        val catalog: Catalog?,
        val triggeredBy: String?,
        val updatedAt: String?
    )

    private data class DeletionPayload(
        val catalogId: String?,
        val triggeredBy: String?,
        val timestamp: String?
    )
}
