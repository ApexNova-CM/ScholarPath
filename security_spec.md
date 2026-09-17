# Scholar Path Security Specification

## 1. Data Invariants
1. **User Identity Invariant**: A user document (`/users/{userId}`) can only be created or modified by the authenticated user whose `request.auth.uid == userId`. Users cannot elevate their own role to `admin`.
2. **Admin Privilege Invariant**: Administrative collections (`/verifications/{verificationId}`, updating verification status of scholarships) require verified administrative authorization checked via `isAdmin()`.
3. **Scholarship Listing Invariant**: Verified scholarships (`status == 'verified'`) are publicly readable by all authenticated users. Creating or modifying scholarships requires strict schema validation and cannot spoof timestamps.
4. **Application Ownership Invariant**: Applications (`/applications/{applicationId}`) belong strictly to the student (`userId == request.auth.uid`) or may be reviewed by an administrator.
5. **Document Locker Invariant**: Documents (`/documents/{documentId}`) can only be read and managed by their owning student (`userId == request.auth.uid`).
6. **Notification Invariant**: Notifications (`/notifications/{notificationId}`) are isolated to the targeted recipient (`userId == request.auth.uid`).
7. **Saved Scholarships Invariant**: Bookmarks (`/saved_scholarships/{saveId}`) are strictly bound to `userId == request.auth.uid`.
8. **ID Poisoning Guard**: All document ID path variables must satisfy `isValidId(id)`.

---

## 2. The "Dirty Dozen" Payloads (Attack Vectors)
1. **Role Escalation via Register**: Student attempts to register with `{ role: 'admin' }`. *Result: REJECTED*.
2. **Shadow Field Injection**: Student writes `{ id: 'usr-1', email: 'test@domain.com', ghostField: true }`. *Result: REJECTED*.
3. **Fake Verifier Spoof**: Non-admin attempts to verify a scholarship `{ verificationStatus: 'verified' }`. *Result: REJECTED*.
4. **Identity Spoofing in Application**: User `A` creates an application with `userId: 'user_B'`. *Result: REJECTED*.
5. **PII Snooping in Documents**: User `A` queries or reads `/documents/` of User `B`. *Result: REJECTED*.
6. **Notification Hijack**: User `A` updates a notification belonging to User `B`. *Result: REJECTED*.
7. **Path Traversal / 1KB Junk ID Injection**: Client attempts `doc('/scholarships/' + 'A'.repeat(2000))`. *Result: REJECTED*.
8. **Audit Trail Tampering**: Student attempts to delete or alter a record in `/verifications/{id}`. *Result: REJECTED*.
9. **Unbounded Array Exhaustion**: Client posts scholarship with 10,000 array items. *Result: REJECTED*.
10. **Immortal Field Mutation**: User updates `createdAt` on an existing application. *Result: REJECTED*.
11. **Client-Trusted Timestamp Injection**: Client writes a fake backdated `updatedAt`. *Result: REJECTED*.
12. **Blanket Query Scraping**: Unauthenticated or unauthorized user runs blanket query across all applications. *Result: REJECTED*.
