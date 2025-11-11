# Testing and Code Review

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2025-02-14 | Section 2 (Back-end Test Specification) | Documented Jest-based API testing setup and execution flow. |
| 2025-02-15 | Section 2 (Back-end Test Specification) | Added unit-test coverage details for auth layer. |
| 2025-02-15 | Section 2 (Back-end Test Specification) | Rebuilt auth test suites with mocked/unmocked coverage. |
| 2025-11-18 | Section 2 (Back-end Test Specification) | Documented current jest coverage workflow, added mocked/unmocked test runs, coverage artifacts, and updated CI/test guidance. |

---

## 2. Back-end Test Specification: APIs

### 2.1. Locations of Back-end Tests and Instructions to Run Them

#### 2.1.1. Tests

| **Interface**                 | **Describe Group Location, No Mocks**                | **Describe Group Location, With Mocks**            | **Mocked Components**              |
| ----------------------------- | ---------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| **Auth Routes** | [`backend/tests/unmock/auth/auth.routes.spec.ts`](../backend/tests/unmock/auth/auth.routes.spec.ts#L1) | [`backend/tests/mocked/auth/auth.routes.spec.ts`](../backend/tests/mocked/auth/auth.routes.spec.ts#L1) | Mocked suite overrides `authService`, Firebase messaging |
| **Auth Controller** | [`backend/tests/unmock/auth/auth.controller.spec.ts`](../backend/tests/unmock/auth/auth.controller.spec.ts#L1) | [`backend/tests/mocked/auth/auth.controller.spec.ts`](../backend/tests/mocked/auth/auth.controller.spec.ts#L1) | Mocked suite overrides `authService` dependencies |
| **Auth Middleware** | [`backend/tests/unmock/auth/auth.middleware.spec.ts`](../backend/tests/unmock/auth/auth.middleware.spec.ts#L1) | [`backend/tests/mocked/auth/auth.middleware.spec.ts`](../backend/tests/mocked/auth/auth.middleware.spec.ts#L1) | Mocked suite stubs `jsonwebtoken.verify`, `userModel.findById` |
| **Auth Service** | [`backend/tests/unmock/auth/auth.service.spec.ts`](../backend/tests/unmock/auth/auth.service.spec.ts#L1) | [`backend/tests/mocked/auth/auth.service.spec.ts`](../backend/tests/mocked/auth/auth.service.spec.ts#L1) | Mocked suite replaces OAuth2Client, `userModel`, and JWT signing |
| **Friend Controller** | [`backend/tests/unmock/friends/friend.routes.spec.ts`](../backend/tests/unmock/friends/friend.routes.spec.ts#L1) | [`backend/tests/mocked/friends/friend.controller.spec.ts`](../backend/tests/mocked/friends/friend.controller.spec.ts#L1) | Mocked suite replaces `friendshipModel`, `userModel`, `geocodingService`, `messaging`, `logger` |
| **Recognition Controller** | [`backend/tests/unmock/recognition/recognition.controller.spec.ts`](../backend/tests/unmock/recognition/recognition.controller.spec.ts#L1) | [`backend/tests/mocked/recognition/recognition.controller.spec.ts`](../backend/tests/mocked/recognition/recognition.controller.spec.ts#L1) | Mocked suite stubs `recognitionService`, `catalogRepository`, `userModel`, `logger`, `fs` |
| **Recognition Service** | [`backend/tests/unmock/recognition/recognition.service.spec.ts`](../backend/tests/unmock/recognition/recognition.service.spec.ts#L1) | [`backend/tests/mocked/recognition/recognition.service.unit.spec.ts`](../backend/tests/mocked/recognition/recognition.service.unit.spec.ts#L1) | Mocked suite fakes external ML responses, Mongo collection helpers |
| **Geocoding Service** | [`backend/tests/mocked/location/geocoding.service.spec.ts`](../backend/tests/mocked/location/geocoding.service.spec.ts#L1 - unmocked coverage is internal) | same | Mocks `axios`, inspects `logger` |
| **Socket Manager** | covered via real module in `tests/mocked/socket/socket.manager.spec.ts` (no unmocked version exists yet) | same | Mocks Socket.IO constructor, `userModel`, `catalogModel`, `catalogShareModel`, `jsonwebtoken` |
| **User Controller** | [`backend/tests/mocked/user/user.controller.spec.ts`](../backend/tests/mocked/user/user.controller.spec.ts#L1) (unmocked coverage handled via `tests/unmock/user/user.controller.spec.ts` file and route suites) | same | Mocked suite swaps `userModel`, `friendshipModel`, `catalogRepository`, `catalogModel` |

#### 2.1.2. Commit Hash Where Tests Run

`1cf0b0e7faa14b5b6453db2cc47269260c0238a4` (this is the current `main` commit hash examined before the CI run described below; rerun `git rev-parse HEAD` after future changes and update this field).

#### 2.1.3. Explanation on How to Run the Tests

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Run unmocked suites (real integrations)**
   ```bash
   npx jest --coverage tests/unmock
   ```
   - Covers controllers, services, and routes hitting real mongoose helpers and HTTP plumbing.
3. **Run mocked suites to exercise guards & error handling**
   ```bash
   npx jest --coverage tests/mocked
   ```
   - This exercises the same APIs with mocked persistence/external calls (`userModel`, `FriendshipModel`, `recognitionService`, Socket.IO, etc.).
4. **Combine everything**
   ```bash
   npm run test:coverage
   ```
   - Runs the full Jest configuration (`tests/setup` + both `mocked`/`unmocked` roots) and produces `coverage/lcov-report`.
5. **Watch mode (optional)**
   ```bash
   npm run test:watch
   ```
Notes:
   - Mocked suites redirect Firebase Admin and JWT signing to jest spies so no service account is required.
   - Some CI sandboxes block MongoMemoryServer from binding ports; rerun with `SKIP_MONGO=true` if you see `listen EPERM 0.0.0.0`.
   - The current coverage runs still log expected errors from `recognition.controller.spec.ts` (missing `MEDIA_BASE_URL`, “No species recognized,” or rate-limit errors). Those errors are emitted deliberately in the mocked tests and do not indicate regressions—they can be silenced once environment vars or mocks are configured by the reviewer.

### 2.2. Jest Configuration and CI Workflow

`backend/jest.config.ts`

GitHub Actions workflow that runs all backend tests:

```
.github/workflows/backend-tests.yml
```

That workflow executes `npm install`, `npm run test:coverage`, and publishes coverage artifacts. Any additional suites must be wired into this workflow before the release to ensure CI completeness.

### 2.3. Jest Coverage Report Screenshots for Tests Without Mocking

See `testCoverageUnmocked.png` at the repository root (generated after `npx jest --coverage tests/unmock`). This image shows per-file/overall coverage when exercising the real controllers/services.

### 2.4. Jest Coverage Report Screenshots for Tests With Mocking

See `testCoverageMocked.png` at the repository root (generated by `npx jest --coverage tests/mocked`). The mocked snapshot represents coverage of error/guard branches while persistence layers are stubbed.

### 2.5. Jest Coverage Report Screenshots for Both Tests With and Without Mocking

The combined run (`npm run test:coverage`) produces the full report (`coverage/lcov-report/index.html`); a screenshot is the same as `testCoverageAll.png` if you regenerate it today. This run still logs deliberate errors from `tests/mocked/recognition/recognition.controller.spec.ts` (missing `MEDIA_BASE_URL`, “No species recognized from image,” and rate-limit scenarios) because those describe guards we intentionally hit; they do not indicate regressions.

#### Coverage Gaps Explanation
- `src/logger.util.ts` (lines around 13–24) – the `try { JSON.stringify } catch` branch only runs when an argument cannot be stringified; the happy-path tests already cover everything we control, so hitting that branch would require intentionally malformed data.
- `src/auth/auth.middleware.ts` lines 14, 43–49 – these guard clauses are triggered when the request lacks a token/secret or when JWT verification returns an invalid payload; our positive-path tests and mocks do not force those early failures.
- `src/friends/friend.controller.ts` lines 90‑95, 117, 134‑136, 152‑163, 202, 272, 427‑428, 456‑463, 486‑502, 601‑610, 808 – these span the more complicated recommendation scoring, notification dispatch, and response formatting branches that currently require end-to-end integration data (multiple catalogs/friends plus geocoding) beyond the guard-focused unit tests.
- `src/geocoding.service.ts` lines 69 and 145 – these warn when the geocoding API omits locality/province components; our unit mocks return fully populated responses, so the fallback paths are intentionally left for future integration tests with malformed API payloads.
- `src/socket/socket.manager.ts` line 185 – covering `server.to(...).emit(...)` requires a live Socket.IO client/server handshake, so the unit tests intentionally stop at the guard/warning level.
- `src/user/user.controller.ts` lines 96, 133, 176, 206–224, 294, 354 – these correspond to advanced query/listing/badge flows that are currently exercised by broader integration suites rather than the quick unit tests we added.

---

## 3. Back-end Test Specification: Tests of Non-Functional Requirements

### 3.1. Test Locations in Git

| **Non-Functional Requirement**                  | **Location in Git**                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Recognition Latency (≤ 10 s end-to-end)**     | [`backend/tests/nonfunctional/recognitionLatency.spec.ts`](../backend/tests/nonfunctional/recognitionLatency.spec.ts#L1) |
| **Privacy & Data Protection (Account Deletion)** | [`backend/tests/nonfunctional/privacyDeletion.spec.ts`](../backend/tests/nonfunctional/privacyDeletion.spec.ts#L1)         |

### 3.2. Test Verification and Logs

- **Recognition Latency (≤ 10 s end-to-end)**

  - **Verification:** A Jest + Supertest suite hits `POST /api/recognition`, injects canned Zyla responses via `jest.spyOn(recognitionService, 'recognizeFromUrl')`, and measures the elapsed wall-clock time between request dispatch and JSON payload delivery. The test iterates through three representative payload descriptors (1 MB, 3 MB, 5 MB) and fails if any response exceeds the 10 000 ms SLA, giving us a fast regression signal that controller/middleware changes didn’t bloat latency. Execute with `npm run test:nfr-recognition`.
  - **Log Output**
    ```
    $ cd backend && npm run test:nfr-recognition
    PASS tests/nonfunctional/recognitionLatency.spec.ts
      NFR: Recognition latency
        ✓ { label: '1MB payload', body: [Object] } completes within 10 seconds (17 ms)
        ✓ { label: '3MB payload', body: [Object] } completes within 10 seconds (2 ms)
        ✓ { label: '5MB payload', body: [Object] } completes within 10 seconds (1 ms)
    ```

- **Privacy & Data Protection (Account Deletion)**
  - **Verification:** Using `mongodb-memory-server`, the suite provisions a user, catalogs, and friendships, then invokes `DELETE /api/user/profile`. It verifies that every protected route returns 401 without a JWT, 200 with a valid token, and that after deletion the `users`, `catalogs`, `entries`, and `friendships` collections contain no documents tied to the deleted user. The test also confirms that subsequent authorized requests fail with 401, proving the token is invalidated. Execute via `npm run test:nfr-privacy`.
  - **Log Output**
    ```
    $ cd backend && npm run test:nfr-privacy
    PASS tests/nonfunctional/privacyDeletion.spec.ts
      NFR: Privacy & Data Protection
        ✓ catalog endpoints reject unauthenticated access (153 ms)
        ✓ deleting a profile removes personal data and invalidates the token (449 ms)
    ```

---

## 4. Front-end Test Specification

### 4.1. Location in Git of Front-end Test Suite:

`frontend/src/androidTest/java/com/studygroupfinder/`

### 4.2. Tests

- **Use Case: Login**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user opens "Add Todo Items" screen. | Open "Add Todo Items" screen. |
    | 2. The app shows an input text field and an "Add" button. The add button is disabled. | Check that the text field is present on screen.<br>Check that the button labelled "Add" is present on screen.<br>Check that the "Add" button is disabled. |
    | 3a. The user inputs an ill-formatted string. | Input "_^_^^OQ#$" in the text field. |
    | 3a1. The app displays an error message prompting the user for the expected format. | Check that a dialog is opened with the text: "Please use only alphanumeric characters ". |
    | 3. The user inputs a new item for the list and the add button becomes enabled. | Input "buy milk" in the text field.<br>Check that the button labelled "add" is enabled. |
    | 4. The user presses the "Add" button. | Click the button labelled "add ". |
    | 5. The screen refreshes and the new item is at the bottom of the todo list. | Check that a text box with the text "buy milk" is present on screen.<br>Input "buy chocolate" in the text field.<br>Click the button labelled "add".<br>Check that two text boxes are present on the screen with "buy milk" on top and "buy chocolate" at the bottom. |
    | 5a. The list exceeds the maximum todo-list size. | Repeat steps 3 to 5 ten times.<br>Check that a dialog is opened with the text: "You have too many items, try completing one first". |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: ...**

  - **Expected Behaviors:**

    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | ...                | ...                 |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **...**

---

## 5. Automated Code Review Results

### 5.1. Commit Hash Where Codacy Ran

`527afd4`

### 5.2. Unfixed Issues per Codacy Category

![issuesCategory](images/codacyIssuesByCategories.png)

### 5.3. Unfixed Issues per Codacy Code Pattern

![issuesPattern](images/codacyIssuesByPatterns.png)

### 5.4. Justifications for Unfixed Issues

- None
