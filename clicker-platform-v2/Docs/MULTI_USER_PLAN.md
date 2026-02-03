# Multi-User Data Isolation Implementation Plan

## Goal
Implement robust data isolation where each user can only access and modify their own data. This is achieved using a **Logical Isolation** strategy within a single Firestore database.

## 1. Data Structure Strategy
We will use the **Root Collection + `ownerId`** pattern. Every document belonging to a user must have an `ownerId` field matching their Firebase Auth UID.

### Affected Collections
*   `content` (Business Profile, Site Settings)
*   `branches`
*   `forms`
*   `submissions` (Should be accessible by the form owner)

### Schema Updates
| Collection | Document | New Field | Value |
| :--- | :--- | :--- | :--- |
| `content` | `business_{uid}` (New ID format) | `ownerId` | `auth.uid` |
| `branches` | `{auto-id}` | `ownerId` | `auth.uid` |
| `forms` | `{auto-id}` | `ownerId` | `auth.uid` |

> **Note on `content` collection**: Currently, it seems to use singleton documents like `business`. For multi-user, we must change this to either:
> 1.  Use `content/{uid}` (Document ID = User ID) -> **Recommended for Profiles**
> 2.  Use `content/{auto-id}` with `ownerId` query.

**Decision**: For `business` settings, we will store them in `users/{uid}/settings/business` OR simply `content/business_{uid}`.
*   *Simpler Approach*: Keep root collections.
    *   `content` doc ID: `business_{uid}`.

## 2. Firestore Security Rules
We will update `firestore.rules` to enforce strict ownership.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: User is logged in
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: User is accessing their own data
    function isOwner(resource) {
      return resource.data.ownerId == request.auth.uid;
    }

    // Helper: User is CREATING data as themselves
    function isCreatingOwn(request) {
      return request.resource.data.ownerId == request.auth.uid;
    }

    // --- Content (Business Profile) ---
    // Assuming doc ID is 'business_{uid}'
    match /content/{docId} {
       allow read, write: if isAuthenticated() && docId == 'business_' + request.auth.uid;
       // OR if using ownerId field:
       // allow create: if isAuthenticated() && isCreatingOwn(request);
       // allow read, update, delete: if isAuthenticated() && isOwner(resource);
    }

    // --- Branches ---
    match /branches/{branchId} {
      allow create: if isAuthenticated() && isCreatingOwn(request);
      allow read, update, delete: if isAuthenticated() && isOwner(resource);
      allow list: if isAuthenticated() && request.query.limit <= 100 && request.query.ownerId == request.auth.uid; // Validate queries
    }

    // --- Forms ---
    match /forms/{formId} {
      allow create: if isAuthenticated() && isCreatingOwn(request);
      allow read, update, delete: if isAuthenticated() && isOwner(resource);
    }
  }
}
```

## 3. Code Refactoring

### A. Business Settings (`app/admin/(dashboard)/business/page.tsx`)
*   **Current**: Fetches `doc(db, 'content', 'business')`.
*   **Change**:
    *   Need to determine user UID.
    *   Fetch `doc(db, 'content', \`business_\${user.uid}\`)`.
    *   If not exists, treat as empty profile.

### B. Forms (`app/admin/(dashboard)/forms/page.tsx`)
*   **Current**: `query(collection(db, 'forms'), orderBy('createdAt', 'desc'))`. (Fetches ALL forms).
*   **Change**:
    *   Add `where('ownerId', '==', user.uid)`.
    *   Requires Composite Index (ownerId + createdAt).

### C. Create/Update Logic (`FormBuilderClient`, etc.)
*   **Current**: `addDoc(collection(db, 'forms'), data)`.
*   **Change**:
    *   Add `ownerId: user.uid` to the data payload before saving.

## 4. Migration / Backward Compatibility
*   Existing data without `ownerId` will become inaccessible to standard queries (or accessible only by admins if we add an admin rule).
*   **Action**: For development/testing, we will start fresh with new data. Old data can be manually updated or ignored.

## 5. Verification
1.  **User A** logs in -> Creates Form A.
2.  **User B** logs in -> Should NOT see Form A.
3.  **User B** creates Form B -> Should see Form B.
4.  **User A** logs in -> Should ONLY see Form A.
