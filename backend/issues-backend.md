# Backend Issues & Improvement Suggestions

This document outlines identified functional bugs, structural flaws, and design issues within the backend codebase, along with recommended solutions.

---

## 🚨 Functional Bugs

### 1. Synchronous File Operations Block the Server

-   **Issue:** The `media.service.ts` uses synchronous functions (`fs.renameSync`, `fs.unlinkSync`) for saving and deleting images. Node.js is single-threaded; any synchronous I/O operation blocks the entire event loop, making the server unresponsive to all other users until the operation completes.
-   **Impact:** Under load, or when handling larger files, the server will freeze, leading to poor performance and high latency.
-   **Affected Files:** `src/media.service.ts`
-   **Suggestion:** Replace all synchronous file system calls with their asynchronous counterparts using `fs.promises`.

```typescript
// src/media.service.ts

// Instead of this:
fs.renameSync(filePath, newPath);

// Use this:
await fs.promises.rename(filePath, newPath);
```

### 2. Brittle Error Handling in Controllers

-   **Issue:** The `auth.controller.ts` checks for specific error messages using string comparison (e.g., `error.message === 'User not found'`). This is fragile because any change to the error message text in the service layer will break the controller's logic.
-   **Impact:** Error handling is not robust and can easily fail, leading to incorrect HTTP responses (e.g., sending a 500 Internal Server Error instead of a 404 Not Found).
-   **Affected Files:** `src/auth.controller.ts`
-   **Suggestion:** Implement custom error classes (e.g., `NotFoundError`, `UnauthorizedError`, `ConflictError`) in the service layer. The controller can then check the error type using `instanceof`, which is much more reliable.

### 3. Unsafe Non-Null Assertions (`!`)

-   **Issue:** Code in `media.controller.ts` and `user.controller.ts` uses the non-null assertion operator (`!`) on `req.user` (e.g., `const user = req.user!`). This assumes the `authenticateToken` middleware has successfully run and attached the user object.
-   **Impact:** If the middleware fails or is accidentally removed from a route, `req.user` will be undefined, and the `!` operator will cause the server to crash.
-   **Affected Files:** `src/media.controller.ts`, `src/user.controller.ts`
-   **Suggestion:** Always check for the existence of `req.user` and return a proper error response if it's missing.

```typescript
// src/media.controller.ts

// Instead of this:
const user = req.user!;

// Use this:
const user = req.user;
if (!user) {
  return res.status(401).json({ message: 'Authentication required' });
}
```

### 4. Missing Environment Variable Checks at Startup

-   **Issue:** The application uses environment variables like `MONGODB_URI`, `JWT_SECRET`, and `GOOGLE_CLIENT_ID` directly, often with a non-null assertion (`!`).
-   **Impact:** If any of these critical variables are not defined in the environment, the application will crash at runtime when the variable is first accessed.
-   **Affected Files:** `src/database.ts`, `src/auth.service.ts`
-   **Suggestion:** Create a startup script or a configuration module that validates all required environment variables when the application starts. If any are missing, log a clear error message and exit the process gracefully.

---

## 🏗️ Structural Flaws

### 1. Inconsistent Logging

-   **Issue:** The codebase mixes the custom `logger` utility (`src/logger.util.ts`) with the standard `console.log`, `console.error`, etc.
-   **Impact:** This leads to inconsistent log formats, making it harder to parse, filter, and monitor logs effectively. The custom logger also includes input sanitization, which is bypassed when using `console`.
-   **Affected Files:** `src/database.ts`, `src/user.model.ts`, `src/index.ts`
-   **Suggestion:** Exclusively use the `logger` utility for all application logging to ensure consistency and security.

### 2. Repetitive Error Handling Logic in Controllers

-   **Issue:** The error handling logic inside the `catch` blocks of the `auth.controller.ts` is highly repetitive. Each `async` function has a large `try...catch` block with multiple `if` statements to handle different error types.
-   **Impact:** This violates the DRY (Don't Repeat Yourself) principle, making the code harder to read and maintain.
-   **Affected Files:** `src/auth.controller.ts`
-   **Suggestion:** Refactor the error handling into a dedicated error-handling middleware. Controllers should just pass errors to `next(error)`. The middleware can then inspect the error (ideally a custom error class) and determine the appropriate status code and response.

### 3. Path Resolution is Fragile

-   **Issue:** The `storage.ts` and `media.service.ts` files use relative paths (e.g., `'uploads/images'`) and `process.cwd()` to construct file paths. This can be unreliable as it depends on the directory from which the application is launched.
-   **Impact:** The application may fail to find or save files if it's not started from the project's root directory.
-   **Affected Files:** `src/storage.ts`, `src/media.service.ts`, `src/index.ts`
-   **Suggestion:** Use absolute paths by resolving them from the current file's location. Define a root project directory constant and base all paths on it.

```typescript
// e.g., in src/index.ts
export const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Then use UPLOADS_DIR elsewhere
```

---

## 🎨 Design Issues & Missing Features

### 1. Risky User Deletion Logic

-   **Issue:** In `user.controller.ts`, when a user is deleted, their images are deleted from the file system *before* their record is deleted from the database.
-   **Impact:** If deleting the user from the database fails for any reason, their images will be gone, but their user record will remain, leading to a broken state (orphaned user record).
-   **Affected Files:** `src/user.controller.ts`
-   **Suggestion:** Reverse the order of operations. First, delete the user from the database. If that is successful, then proceed to delete their associated images. This way, if image deletion fails, you are left with orphaned *files*, which are generally easier to deal with (e.g., via a cleanup script) than an orphaned user record in the database.

### 2. Lack of Refresh Tokens in Authentication

-   **Issue:** The authentication system only issues a single, long-lived JWT (19 hours). Storing a long-lived JWT in client-side storage (like `localStorage`) is a security risk, as it's vulnerable to XSS attacks.
-   **Impact:** If an access token is stolen, an attacker has a very long window (19 hours) to impersonate the user.
-   **Affected Files:** `src/auth.service.ts`
-   **Suggestion:** Implement a refresh token strategy:
    1.  Issue a short-lived access token (e.g., 15 minutes).
    2.  Issue a long-lived, single-use refresh token that is stored securely (e.g., in an `HttpOnly` cookie).
    3.  When the access token expires, the client uses the refresh token to get a new access token without requiring the user to log in again.

### 3. Missing API for User Discovery

-   **Issue:** The application provides no way for users to find or see each other. A key part of a profile-based application is being able to view other users' profiles.
-   **Impact:** The application lacks a core social feature.
-   **Suggestion:** Add a new set of endpoints, for example:
    -   `GET /api/users`: To list all users (with pagination).
    -   `GET /api/users/:userId`: To view a specific user's public profile.
    -   This would likely require a new `users.controller.ts` and `users.service.ts`.

### 4. Hobbies are a Static, Unmanaged List

-   **Issue:** The list of hobbies is hardcoded in `src/hobbies.ts`.
-   **Impact:** To add, remove, or edit a hobby, a developer must change the code and redeploy the entire application.
-   **Suggestion:** Store the hobbies in their own collection in the database. Create a new set of (admin-only) endpoints for managing this list (`POST`, `PUT`, `DELETE /api/hobbies`). This makes the application more flexible and manageable.
