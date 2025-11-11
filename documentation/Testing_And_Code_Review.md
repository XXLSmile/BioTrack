# Testing and Code Review

## 1. Change History

| **Change Date**   | **Modified Sections** | **Rationale** |
| ----------------- | --------------------- | ------------- |
| 2025-02-14 | Section 2 (Back-end Test Specification) | Documented Jest-based API testing setup and execution flow. |
| 2025-02-15 | Section 2 (Back-end Test Specification) | Added unit-test coverage details for auth layer. |
| 2025-02-15 | Section 2 (Back-end Test Specification) | Rebuilt auth test suites with mocked/unmocked coverage. |

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

#### 2.1.2. Commit Hash Where Tests Run

The first successful run with the current suite has not yet been recorded. After executing the tests locally (requires MongoDB binaries for `mongodb-memory-server`), capture the SHA via `git rev-parse HEAD` and record it here.

#### 2.1.3. Explanation on How to Run the Tests

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Run all tests**
   ```bash
   npm run test
   ```
   - The suites are split between `tests/unmock/**` (no dependency mocks) and `tests/mocked/**` (external collaborators mocked per requirement).
   - Firebase Admin access is stubbed via local jest mocks; no service account file is required.
   - Some environments block binding ephemeral ports; if you see `listen EPERM` locally, rerun with `SKIP_MONGO=true` to disable in-memory MongoDB hooks.
3. **Watch mode (optional)**
   ```bash
   npm run test:watch
   ```
4. **Generate coverage**
   ```bash
   npm run test:coverage
   ```

### 2.2. Jest Configuration Location

`backend/jest.config.ts`

> _Note:_ CI automation for backend tests is not yet committed. When a GitHub Actions workflow is added, document its path here as well.

### 2.3. Jest Coverage Report Screenshots for Tests Without Mocking

_(Placeholder for Jest coverage screenshot without mocking)_

### 2.4. Jest Coverage Report Screenshots for Tests With Mocking

_(Placeholder for Jest coverage screenshot with mocking)_

### 2.5. Jest Coverage Report Screenshots for Both Tests With and Without Mocking

_(Placeholder for Jest coverage screenshot both with and without mocking)_

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

frontend/app/src/androidTestDebug/java/com/cpen321/usermanagement/e2e

### 4.2. Tests

- **Use Case: Get Picture**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to the Identify screen. | Tap the bottom navigation item labelled “Identify.” |
    | 2. The user clicks “Open Camera.” | Verify the camera screen is displayed. |
    | 3. The app requests permissions if not already granted. | Accept permission dialog (Camera + Storage). |
    | 4. The user captures a photo. | Perform click on “Capture” or system camera shutter button. |
    | 5. The system confirms the picture was taken. | Verify a preview or success snackbar: “Picture captured successfully.” |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Scan Picture**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user selects “Scan Picture.” | Click the button labelled “Recognize Animal”. |
    | 2. The system sends the photo to the recognition API. | Wait for processing indicator or progress spinner. |
    | 3. The app displays identification results. | Verify text fields for species name and description appear. |
    | 4. The user can view species Name, type, and confidence interval. | Confirm labels like “Name,” “Species,” “Confidence” are visible. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Create Catalog**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to the Catalogs screen. | Tap bottom navigation item “Catalogs.”
    | 2. The app shows a button to create a catalog. | Verify “Create Catalog” button is visible. |
    | 3. The user taps “Create Catalog.” | Click the button and open the creation dialog. |
    | 4. The user enters a catalog name and confirms. | Type “My Test Catalog” and click “Save.” |
    | 5. The new catalog appears in the list. | Verify “My Test Catalog” now appears. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Delete Catalog**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to Catalogs. | Tap “Catalogs” in bottom navigation. |
    | 2. The user creates a new catalog (if none exists). | Perform create catalog flow with name “Temp Catalog.” |
    | 3. The catalog appears in the list. | Verify “Temp Catalog” is visible. |
    | 4. The user deletes the catalog. | Open catalog, click “Delete.” |
    | 5. The catalog disappears from the list. | Verify “Temp Catalog” is no longer visible. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Edit Catalog**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to Catalogs. | Tap “Catalogs” in bottom navigation. |
    | 2. The user creates a catalog. | Perform create catalog flow with name “Edit Test Catalog.” |
    | 3. The catalog appears in the list. | Verify “Edit Test Catalog” visible. |
    | 4. The user selects the catalog. | Click on “Edit Test Catalog.” |
    | 5. The catalog detail screen opens. | Verify catalog name header and empty entry list are shown. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Catalog Scanned Picture**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to the Camera screen. | Tap bottom navigation item “Identify.” |
    | 2. The user clicks the “Recognize Animal” button. | Perform click on “Recognize Animal” |
    | 3. The app requests location permission. | Accept location permission dialog. |
    | 4. The user clicks “Recognize Animal” again. | Perform second click on “Recognize Animal” |
    | 5. The system identifies the species. | Verify species result and info are displayed. |
    | 6. The dialog appears asking to save to a catalog. | Verify “Save to Catalog” dialog visible. |
    | 7. The user selects a catalog and confirms. | Select existing catalog and click “Save.” |
    | 8. The app confirms successful addition. | Verify snackbar text: “Observation added to catalog.” |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Add Friends**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to the Friends screen. | Tap the bottom navigation item labelled “Friends”. |
    | 2. The user taps on the search bar | Verify a text input and search/submit button appear. |
    | 3. The user enters a valid username and confirms. | Type a sample username and click “Search” |
    | 4. The user taps “Add Friend.” | Click the button labelled “Add Friend”. |
    | 5. The system confirms the request was sent. | Verify a snackbar or confirmation text appears: “Friend request sent.” |
    | 6. The friend is added to the list upon acceptance. | Verify “TestUser123” appears in the friends list. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

- **Use Case: Share Catalog**

  - **Expected Behaviors:**
    | **Scenario Steps** | **Test Case Steps** |
    | ------------------ | ------------------- |
    | 1. The user navigates to Catalogs. | Tap “Catalogs.” |
    | 2. The user creates a catalog. | Create “Shared Catalog.” |
    | 3. The user opens the catalog. | Tap “Shared Catalog.” |
    | 4. The catalog details screen displays. | Verify header shows catalog name. |
    | 5. The user taps the “Share” button. | Perform click on “Share.” |
    | 6. The app opens the share dialog. | Verify share intent or dialog appears. |
    | 7. The user confirms share and navigates to the Friends tab. | Click bottom navigation “Friends” and verify list. |

  - **Test Logs:**
    ```
    [Placeholder for Espresso test execution logs]
    ```

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
