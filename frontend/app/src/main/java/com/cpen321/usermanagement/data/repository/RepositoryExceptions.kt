package com.cpen321.usermanagement.data.repository

open class RepositoryException(
    message: String,
    cause: Throwable? = null
) : RuntimeException(message, cause)

class FriendRepositoryException(
    message: String,
    cause: Throwable? = null
) : RepositoryException(message, cause)

class CatalogRepositoryException(
    message: String,
    cause: Throwable? = null
) : RepositoryException(message, cause)

class RecognitionRepositoryException(
    message: String,
    cause: Throwable? = null
) : RepositoryException(message, cause)
