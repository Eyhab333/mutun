<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Firestore Security Guardrails
Important Firestore Rules constraint for all future tasks:

The current `firestore.rules` file contains deliberate security decisions that MUST be preserved unless the user explicitly asks to change them.

Do NOT relax, broaden, rewrite, or reinterpret Firestore access rules as part of unrelated feature work.

## Shared scientific content

These collections are shared scientific content:

- levels
- sciences
- matn
- maqasid
- chapters
- sections
- passages
- passageResources

Current rule policy:

- READ: owner only
- CREATE: owner only
- UPDATE: owner only
- DELETE: always denied

The current owner UID is:

`ptQwoqUEzygvsm4BpfdvGruJnvj1`

The existing helper:

`isContentOwner()`

must remain the access gate for both reading and writing shared scientific content.

Do NOT change:

`allow read: if isContentOwner();`

into:

`allow read: if isSignedIn();`

or any broader rule.

The application is currently personal-use only.

If multi-user content reading is introduced later, that will be a separate explicit architectural decision.

---

## Hard delete

Hard delete of shared scientific content must remain denied:

`allow delete: if false;`

Content removal is handled through:

`isArchived = true`

Do not enable delete permissions for shared scientific content.

Do not add cascading deletes.

---

## Immutable content relationships

Existing identity and parent relationships must remain protected.

Examples:

- document data `id` must continue matching the Firestore document ID where currently enforced
- Science `levelId` must not change after creation
- Matn `levelId` and `scienceId` must not change after creation
- Maqsad `matnId` must not change
- Chapter `matnId` and optional `maqsadId` must not change
- Section `matnId`, optional `maqsadId`, and optional `chapterId` must not change
- Passage parent relationships must not be silently reassigned when safeguards are added
- PassageResource `passageId` must not change

Do not weaken existing immutable-relation helpers.

---

## User-owned collections

These collections are private per-user data:

- userPassageStates
- userActivePassages
- dailyRepetitions
- userPassageStats
- reviewGroups
- reviewRecords
- repairRecords
- userSettings

The fundamental rule must remain:

A user may only access documents owned by their own Firebase Auth UID.

For user-owned documents:

- CREATE must require incoming `userId == request.auth.uid`
- READ must require existing `userId == request.auth.uid`
- UPDATE must verify both existing and incoming ownership
- ownership must never be transferable by changing `userId`
- DELETE may only be allowed to the owning user where currently permitted

Do not replace these checks with a generic `isSignedIn()` rule.

---

## userSettings

`userSettings` uses exactly one document per user:

`userSettings/{uid}`

The document ID must correspond to the authenticated user's UID.

Do not change it to randomly generated document IDs.

---

## Default deny

The final default-deny rule must remain:

`allow read, write: if false;`

Do not add a broad fallback such as:

`allow read, write: if request.auth != null;`

---

## Rules changes during future tasks

If a future feature genuinely requires a Firestore Rules change:

1. Make only the smallest required change.
2. Preserve all existing security invariants above.
3. Do not broaden unrelated collection access.
4. Report exactly which rule was changed and why.
5. Do not deploy Firestore Rules automatically.
6. Do not change the owner UID.
7. Do not change personal-app access policy unless explicitly instructed by the user.

If the feature can be implemented without changing `firestore.rules`, leave the file untouched.

When in doubt, preserve the existing rules and report the concern instead of loosening security.
