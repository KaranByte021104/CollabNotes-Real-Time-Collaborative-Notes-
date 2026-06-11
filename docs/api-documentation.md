# API & WebSocket Documentation

This document describes all REST API endpoints and Socket.IO real-time events supported by the CollabNotes backend.

---

## REST API Specifications

All API routes are prefixed with `/api`. Unless noted otherwise, routes require a valid JSON Web Token (JWT) provided in the request headers:
`Authorization: Bearer <your_access_token>`

### 1. Authentication Endpoints (`/api/auth`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **POST** | `/register` | No | Create a new user profile. | `{"name": "...", "email": "...", "password": "..."}` | `{"access_token": "...", "user": {...}}` |
| **POST** | `/login` | No | Authenticate user credentials. | `{"email": "...", "password": "..."}` | `{"access_token": "...", "user": {...}}` |
| **POST** | `/forgot-password` | No | Request a 6-digit password reset OTP sent via SMTP. | `{"email": "..."}` | `{"message": "..."}` |
| **POST** | `/reset-password` | No | Verify OTP code and set new password. | `{"email": "...", "otp": "...", "newPassword": "...", "confirmPassword": "..."}` | `{"message": "..."}` |
| **PATCH** | `/change-password` | Yes | Change password while authenticated. Logs out other sessions. | `{"currentPassword": "...", "newPassword": "..."}` | `{"message": "..."}` |

---

### 2. Workspace Endpoints (`/api/workspaces`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **POST** | `/` | Yes | Create a fresh workspace. | `{"name": "Design Notes"}` | `{"id": "uuid", "name": "...", "code": "..."}` |
| **POST** | `/join` | Yes | Join an existing workspace using an invite code. | `{"code": "ocean-lamp-74"}` | `{"id": "uuid", "name": "...", "note": {...}}` |
| **GET** | `/` | Yes | List workspaces the user belongs to. | None | `[{"id": "uuid", "name": "...", "joinedAt": "..."}]` |
| **GET** | `/:id` | Yes | Fetch details, notes, and activity logs of a workspace. | None | `{"id": "...", "name": "...", "notes": [...], "activityLogs": [...]}` |
| **PATCH** | `/:id/archive` | Yes (Creator) | Archive a workspace (sets read-only). | None | `{"id": "uuid", "isArchived": true}` |
| **PATCH** | `/:id/unarchive` | Yes (Creator) | Restore/unarchive a workspace. | None | `{"id": "uuid", "isArchived": false}` |
| **DELETE** | `/:id` | Yes (Creator) | Permanently delete workspace and all nested resources. | None | `{"success": true, "membersAffected": 2}` |
| **POST** | `/:id/leave` | Yes | Leave a joined workspace. | None | `{"success": true}` |
| **GET** | `/:id/export` | Yes | Stream a zipped folder of all notes in plain text. | None | *(Streams binary ZIP payload)* |
| **GET** | `/:id/search` | Yes | Perform database search on workspace notes. | None (Query: `?q=keyword`) | `[{"id": "...", "title": "...", "snippet": "..."}]` |

---

### 3. Note Endpoints (`/api/workspaces/:id/notes`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **POST** | `/` | Yes | Create a new note inside the workspace. Supports template selections. | `{"title": "Note Title", "content": "..."}` | `{"id": "...", "title": "...", "content": "..."}` |
| **PATCH** | `/:noteId` | Yes | Rename a note title. | `{"title": "New Title"}` | `{"id": "...", "title": "..."}` |
| **PATCH** | `/:noteId/lock` | Yes (Creator) | Force-lock a note (disables remote edits). | None | `{"id": "...", "isLocked": true}` |
| **PATCH** | `/:noteId/unlock` | Yes (Creator) | Unlock a note. | None | `{"id": "...", "isLocked": false}` |
| **PATCH** | `/:noteId/pin` | Yes | Pin note to top of sidebar. | None | `{"id": "...", "isPinned": true}` |
| **PATCH** | `/:noteId/unpin` | Yes | Unpin note from sidebar. | None | `{"id": "...", "isPinned": false}` |
| **DELETE** | `/:noteId` | Yes | Delete a note. | None | `{"success": true}` |

---

### 4. Tag Endpoints (`/api/workspaces/:id/tags`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **GET** | `/` | Yes | List all tags created inside the workspace. | None | `[{"id": "...", "name": "test", "color": "#color"}]` |
| **POST** | `/` | Yes | Define a workspace-wide tag. | `{"name": "test", "color": "#6366f1"}` | `{"id": "...", "name": "test", "color": "..."}` |
| **DELETE** | `/:tagId` | Yes (Creator) | Delete tag from the workspace (detaches from notes). | None | `{"success": true}` |
| **POST** | `/notes/:noteId/tags/:tagId` | Yes | Attach tag to a note. | None | `{"id": "...", "tags": [...]}` |
| **DELETE** | `/notes/:noteId/tags/:tagId` | Yes | Detach tag from a note. | None | `{"id": "...", "tags": [...]}` |

---

### 5. Member Endpoints (`/api/workspaces/:id/members`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **GET** | `/` | Yes | Get listing of participants in the workspace. | None | `[{"userId": "...", "name": "...", "joinedAt": "..."}]` |
| **DELETE** | `/:targetUserId` | Yes (Creator) | Evict/remove member from the workspace. | None | `{"success": true}` |

---

### 6. Notification Endpoints (`/api/notifications`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **GET** | `/` | Yes | Fetch active notifications for the logged-in user. | None | `[{"id": "...", "message": "...", "isRead": false}]` |
| **GET** | `/unread-count` | Yes | Count unread notifications. | None | `{"count": 5}` |
| **PATCH** | `/read-all` | Yes | Mark all notifications as read. | None | `{"success": true}` |
| **PATCH** | `/:id/read` | Yes | Mark a single notification as read. | None | `{"id": "uuid", "isRead": true}` |

---

### 7. Profile Endpoints (`/api/profile`)

| Method | Path | Auth Required | Description | Request Body | Response Shape |
|---|---|---|---|---|---|
| **GET** | `/` | Yes | Fetch user's profile details. | None | `{"id": "...", "name": "...", "email": "...", "avatarUrl": "...", "bio": "..."}` |
| **PATCH** | `/` | Yes | Update profile name, email, and bio. | `{"name": "...", "email": "...", "bio": "..."}` | `{"id": "...", "name": "...", "email": "...", "avatarUrl": "...", "bio": "..."}` |
| **POST** | `/avatar` | Yes | Upload avatar image (multipart/form-data). | *(avatar file)* | `{"id": "...", "name": "...", "avatarUrl": "..."}` |
| **DELETE** | `/avatar` | Yes | Remove custom avatar, resetting to default initials. | None | `{"id": "...", "avatarUrl": null}` |

---

## WebSocket Events (Socket.IO Gateway)

Real-time synchronization and activity tracking operate on a Socket.IO transport layer. Custom namespace events route binary updates and presence awareness.

| Event | Origin | Payload Shape | Description |
|---|---|---|---|
| `join_workspace` | Client $\rightarrow$ Server | `{"workspaceId": "uuid", "noteId": "uuid"}` | Enters the socket room representing the active note/workspace. |
| `sync_step1` | Server $\rightarrow$ Client | `{"workspaceId": "uuid", "stateVector": number[]}` | Transmits server's Yjs state vector so client can resolve differences. |
| `sync_step2` | Client $\rightarrow$ Server | `{"workspaceId": "uuid", "update": number[], "clientStateVector": number[]}` | Client returns updates missing on the server, plus client's state vector. |
| `sync_complete` | Server $\rightarrow$ Client | `{"workspaceId": "uuid", "update": number[]}` | Server finishes sync by sending any outstanding binary deltas to client. |
| `workspace_meta` | Server $\rightarrow$ Client | `{"onlineUsers": [...], "activityLogs": [...]}` | Transmits participant statuses and historical logs right after sync. |
| `doc_update` | Client $\rightarrow$ Server | `{"workspaceId": "uuid", "update": number[]}` | Client pushes live keystroke editor deltas to the server. |
| `doc_update` | Server $\rightarrow$ Client | `{"workspaceId": "uuid", "update": number[], "updatedBy": {...}}` | Broadcasts edit deltas from one writer to all other participants. |
| `awareness_update`| Client $\rightarrow$ Server | `{"workspaceId": "uuid", "update": number[]}` | Client transmits local cursor locations, selections, and username. |
| `awareness_update`| Server $\rightarrow$ Client | `{"workspaceId": "uuid", "update": number[]}` | Broadcasts cursor presence updates of another user. |
| `content_snapshot`| Client $\rightarrow$ Server | `{"workspaceId": "uuid", "content": "string"}` | Pushes ProseMirror-structured text snapshot for dashboard rendering. |
| `user_joined` | Server $\rightarrow$ Client | `{"user": User, "onlineUsers": User[]}` | Broadcasts a new member joining, updating the online roster. |
| `user_left` | Server $\rightarrow$ Client | `{"user": User, "onlineUsers": User[]}` | Broadcasts a member disconnecting, cleaning up their carets. |
| `note_locked` | Server $\rightarrow$ Client | `{"noteId": "uuid", "lockedBy": {...}}` | Warns that the note is locked. Editor transitions to read-only. |
| `note_unlocked` | Server $\rightarrow$ Client | `{"noteId": "uuid"}` | Notifies that the note has unlocked. Editor becomes interactive. |
| `note_tags_updated` | Server $\rightarrow$ Client | `{"noteId": "uuid", "tags": [...]}` | Propagates updated tags on a note. |
| `tag_created` | Server $\rightarrow$ Client | `{"tag": Tag}` | Broadcasts workspace-wide tag creation. |
| `tag_deleted` | Server $\rightarrow$ Client | `{"tagId": "uuid"}` | Broadcasts workspace-wide tag deletion. |
| `workspace_archived`| Server $\rightarrow$ Client | `{"workspaceId": "uuid"}` | Informs client workspace was archived (disables interactive inputs). |
| `workspace_unarchived`| Server $\rightarrow$ Client | `{"workspaceId": "uuid"}` | Restores editing functionality on client. |
| `new_notification`| Server $\rightarrow$ Client | `{"notification": Notification}` | Sends a targeted notification payload to a specific user's socket room. |
| `error` | Server $\rightarrow$ Client | `{"message": "string"}` | Emitted on validation errors (e.g. workspace membership checks). |
