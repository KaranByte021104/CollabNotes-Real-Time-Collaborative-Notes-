
# Sprint 2 — Database Schema & Backend Data Models

## Goal
Design and implement the full PostgreSQL database schema using TypeORM entities in the NestJS backend. By the end of this sprint, all tables exist in the database, relationships are defined, and a seed script populates test data so development can begin immediately.

---

## Entities to Create

Create each entity as a separate file inside `backend/src/entities/`. Each file should export a TypeORM `@Entity()` class.

---

### 1. User Entity (`user.entity.ts`)

This stores registered user accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated with `uuid_generate_v4()` |
| `name` | VARCHAR | The user's display name, required |
| `email` | VARCHAR | Must be unique, used for login |
| `password` | VARCHAR | Stores the bcrypt-hashed password, never the plain text |
| `createdAt` | TIMESTAMP | Auto-set to current time on creation |

Relations:
- A User can **own many Workspaces** (one-to-many with Workspace)
- A User can be a **participant in many Workspaces** via the WorkspaceParticipant join table
- A User can have **many ActivityLogs**

---

### 2. Workspace Entity (`workspace.entity.ts`)

This stores each collaborative workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `name` | VARCHAR | The workspace name given by the creator |
| `code` | VARCHAR | Short unique join code (e.g. `ocean-lamp-74`), must be unique across all workspaces |
| `createdAt` | TIMESTAMP | Auto-set on creation |

Relations:
- Belongs to one **User** (the creator) via a `createdBy` foreign key column
- Has one **Note** (one-to-one, cascade delete — if workspace is deleted, note is deleted too)
- Has many **WorkspaceParticipants**
- Has many **ActivityLogs**

---

### 3. Note Entity (`note.entity.ts`)

Each workspace has exactly one shared note that all participants edit together.

> **CRDT Change:** This entity now stores TWO representations of the note — the binary Yjs document state (the source of truth for real-time sync) and a plain-text/JSON content string (a human-readable fallback used for display in the REST API and as a snapshot).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `content` | TEXT | Stores the latest Tiptap JSON snapshot as a string. Updated periodically from the Yjs doc. Default: empty Tiptap JSON |
| `ydocState` | BYTEA | Stores the full binary Yjs document state. This is the source of truth for real-time collaboration. Nullable on creation (set after first edit) |
| `updatedAt` | TIMESTAMP | Auto-updated every time the record is saved |

Relations:
- Belongs to one **Workspace** (one-to-one, with `workspaceId` as the foreign key column on this table)

The default value for `content` should be a valid empty Tiptap JSON document:
```
{"type":"doc","content":[{"type":"paragraph"}]}
```

The `ydocState` column must be typed as `bytea` in PostgreSQL. In TypeORM, declare it as:
```
@Column({ type: 'bytea', nullable: true })
ydocState: Buffer | null;
```

---

### 4. ActivityLog Entity (`activity-log.entity.ts`)

Records every significant event that happens inside a workspace.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `eventType` | ENUM | One of: `user_joined`, `user_left`, `note_updated` |
| `metadata` | JSONB | Optional extra data (e.g. the user's name for display purposes). Nullable |
| `createdAt` | TIMESTAMP | Auto-set on creation |

Create a TypeScript enum called `ActivityEventType` with values `USER_JOINED = 'user_joined'`, `USER_LEFT = 'user_left'`, `NOTE_UPDATED = 'note_updated'`. Use this enum as the column type.

Relations:
- Belongs to one **Workspace** via `workspaceId` foreign key
- Belongs to one **User** via `userId` foreign key (nullable — in case the user account is later deleted)

Add a database index on `workspaceId` so fetching logs for a workspace is fast.

---

### 5. WorkspaceParticipant Entity (`workspace-participant.entity.ts`)

A join table that records which users have ever joined which workspaces. This is for persistence — separate from who is currently online (which is tracked in memory by the socket server).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `joinedAt` | TIMESTAMP | When the user first joined this workspace |

Relations:
- Belongs to one **Workspace** via `workspaceId` foreign key
- Belongs to one **User** via `userId` foreign key

Add a **unique constraint** on the combination of `(workspaceId, userId)` so the same user cannot appear twice for the same workspace.

---

## Entity Registration

In `AppModule`, make sure `TypeOrmModule.forFeature([User, Workspace, Note, ActivityLog, WorkspaceParticipant])` is imported either in the `AppModule` directly or in a dedicated `DatabaseModule`. With `autoLoadEntities: true` already set in Sprint 1, entities just need to be imported somewhere in the module tree.

---

## Workspace Code Generation

Create a utility function at `backend/src/common/utils/generate-code.ts` that generates a unique workspace join code. The format should be two random English words joined by a hyphen, followed by a random two-digit number — for example: `ocean-lamp-74` or `swift-river-12`. Use a short list of simple, memorable words (at least 100 words in the list). This function will be called when creating a new workspace. It should return a string in all lowercase.

---

## Database Indexes

Add the following indexes explicitly for query performance:
- `Workspace.code` — unique index (for fast join-code lookups)
- `ActivityLog.workspaceId` — regular index (for fast log fetching per workspace)
- `WorkspaceParticipant.(workspaceId, userId)` — unique composite index

---

## Seed Script

Create a file at `backend/src/database/seed.ts` that can be run manually with `npx ts-node src/database/seed.ts`.

The seed script should:
1. Connect to the database using the same TypeORM config
2. Create one test user with:
   - Name: `Test User`
   - Email: `test@example.com`
   - Password: `password123` (hashed with bcrypt before saving)
3. Create one test workspace with:
   - Name: `My First Workspace`
   - Code: `test-workspace-01`
   - Creator: the test user above
4. Create the associated Note for that workspace with:
   - `content` set to the default empty Tiptap JSON string
   - `ydocState` set to `null` (no Yjs state yet — it will be created on first real edit)
5. Create one `user_joined` ActivityLog entry for the test user joining that workspace
6. Log to the console: `Seed complete. Workspace code: test-workspace-01`

---

## Definition of Done

- [ ] Running the backend with `npm run start:dev` auto-creates all 5 tables in PostgreSQL with correct columns and relationships
- [ ] The `Note` table has both a `content` (TEXT) column and a `ydocState` (BYTEA) column
- [ ] Foreign keys are correctly set (e.g. deleting a workspace cascades to delete its Note)
- [ ] The unique constraint on `Workspace.code` exists
- [ ] The unique composite constraint on `WorkspaceParticipant.(workspaceId, userId)` exists
- [ ] Running the seed script creates all test records without errors
- [ ] The `ActivityEventType` enum is usable from other modules
- [ ] The `generateCode()` utility function exists and returns a correctly formatted string
