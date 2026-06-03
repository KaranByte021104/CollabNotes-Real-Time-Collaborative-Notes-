
# Sprint 5 — Real-Time Collaboration with Yjs CRDT + Socket.IO

## Goal
Implement the real-time layer using **Yjs** (a CRDT library) as the conflict resolution engine and Socket.IO as the transport. Multiple users in the same workspace can edit simultaneously with zero conflicts — edits are mathematically merged, cursors never jump, and offline edits sync cleanly on reconnect.

---

## How Yjs Works (Important Context)

Yjs maintains a **shared document** (`Y.Doc`) that every connected client holds a copy of. When a user makes an edit, Yjs produces a tiny **binary update** (not the full document) that encodes only what changed. This update is sent to the server, applied to the server's copy of the `Y.Doc`, and broadcast to all other clients who apply it to their own copy. Because Yjs uses CRDT math, all copies converge to the same state automatically — no "last write wins", no conflict detection needed.

The server also persists the full `Y.Doc` binary state to the database (the `ydocState` column added in Sprint 2) so that new joiners receive the complete document history.

---

## Backend — Dependencies to Install

```
npm install yjs y-protocols lib0
```

- `yjs` — the core CRDT library
- `y-protocols` — encoding/decoding helpers for sync and awareness messages
- `lib0` — low-level encoding utilities used by Yjs internally

Do **not** install `y-socket.io` server package — you will implement the sync protocol manually in the gateway for full control. It is straightforward.

---

## Backend — CollaborationModule

Create `backend/src/collaboration/collaboration.module.ts`. It should import:
- `TypeOrmModule.forFeature([Workspace, Note, ActivityLog, User, WorkspaceParticipant])`
- `JwtModule` (import from `AuthModule` or re-register using `registerAsync` with `ConfigService`)

---

## Backend — Yjs Document Store (`ydoc-store.service.ts`)

Create an injectable service that maintains an **in-memory map of live `Y.Doc` instances**, one per workspace. This is the server's authoritative copy of each document.

```
Map<workspaceId: string, Y.Doc>
```

Expose the following methods:

**`getOrCreate(workspaceId, initialState?: Buffer): Y.Doc`**
- If a `Y.Doc` already exists in the map for this `workspaceId`, return it
- If not, create a new `Y.Doc`, optionally apply `initialState` (the `ydocState` binary from the database) using `Y.applyUpdate(doc, initialState)`, store it in the map, and return it

**`applyUpdate(workspaceId, update: Uint8Array): void`**
- Get or create the `Y.Doc` for this workspace
- Apply the incoming binary update: `Y.applyUpdate(doc, update)`

**`getStateVector(workspaceId): Uint8Array`**
- Returns `Y.encodeStateVector(doc)` — used during the sync handshake so clients can tell the server what they already have

**`getUpdate(workspaceId, stateVector: Uint8Array): Uint8Array`**
- Returns `Y.encodeStateAsUpdate(doc, stateVector)` — the diff between the server's doc and what the client already has

**`encodeFullState(workspaceId): Uint8Array`**
- Returns `Y.encodeStateAsUpdate(doc)` — the complete document state, sent to new joiners

**`destroy(workspaceId): void`**
- Remove the `Y.Doc` from the map and call `doc.destroy()` — call this if a workspace has no connected users to free memory (optional optimization)

---

## Backend — Online Users Store (`online-users.store.ts`)

This is unchanged from the original design. Create an injectable class maintaining:

```
Map<workspaceId, Map<userId, OnlineUser>>
```

Where `OnlineUser` is `{ userId, name, socketId, color }`. Color is a hex string consistently derived from the user's name via a simple hash function.

Expose: `addUser`, `removeUser`, `getUsers`, `findUserBySocketId` — same as originally specified.

---

## Backend — CollaborationGateway (`collaboration.gateway.ts`)

Decorate with `@WebSocketGateway({ cors: { origin: '*', credentials: true }, namespace: '/' })`.

Inject: `YdocStoreService`, `OnlineUsersStore`, the `Note` repository, the `ActivityLog` repository, the `User` repository, and `JwtService`.

Also maintain a debounce map for database saves: `Map<workspaceId, NodeJS.Timeout>`.

---

### Connection Authentication

Override `handleConnection(client: Socket)`:
- Read JWT from `client.handshake.auth.token`
- Verify with `JwtService.verify(token, { secret })`
- On failure: `client.emit('error', { message: 'Unauthorized' })` then `client.disconnect()`
- On success: store `client.data.user = { userId, name, email }`

---

### `join_workspace` Event Handler

When a client emits `join_workspace` with payload `{ workspaceId: string }`:

1. Verify the user is a participant of this workspace (check `WorkspaceParticipant` table). If not, emit `error` and return.
2. Join the Socket.IO room: `client.join(workspaceId)`
3. Add the user to `OnlineUsersStore`
4. Load the note from the database to get `ydocState`. Pass it to `YdocStoreService.getOrCreate(workspaceId, note.ydocState)` so the server's in-memory `Y.Doc` is initialized from the persisted state
5. **Yjs Sync Step 1 — Send server state to client:**
   Emit `sync_step1` back to the joining client only, with the server's state vector:
   ```
   {
     workspaceId,
     stateVector: Array.from(YdocStoreService.getStateVector(workspaceId))
   }
   ```
   (Convert `Uint8Array` to a regular array for JSON serialization over the socket)
6. Broadcast `user_joined` to everyone else in the room:
   ```
   { user: { userId, name, color }, onlineUsers: OnlineUser[] }
   ```
7. Log a `USER_JOINED` activity entry to the database

---

### `sync_step2` Event Handler

This is the client's response to `sync_step1`. The client sends the update the server is missing based on the state vector it received.

When a client emits `sync_step2` with payload `{ workspaceId, update: number[] }`:

1. Convert the array back to `Uint8Array`: `new Uint8Array(update)`
2. Apply it to the server's doc: `YdocStoreService.applyUpdate(workspaceId, update)`
3. Broadcast the update to all **other** clients in the room (not the sender) via `doc_update` event:
   ```
   { workspaceId, update: Array.from(update), updatedBy: { userId, name } }
   ```
4. **Send the server's full diff back to the joining client** — the joining client may be behind on edits made by others while they were offline. Emit `sync_complete` to the joining client only:
   ```
   {
     workspaceId,
     update: Array.from(YdocStoreService.getUpdate(workspaceId, new Uint8Array(clientStateVector)))
   }
   ```
   (Store the client's state vector from `sync_step1` temporarily on `client.data` so you can reference it here)
5. Emit `workspace_meta` to the joining client with non-Yjs data:
   ```
   { onlineUsers: OnlineUser[], activityLogs: ActivityLog[] }
   ```
6. Debounce save the `Y.Doc` to the database (see Debounced Save section below)

---

### `doc_update` Event Handler

This is the main real-time event fired on every edit. When a client emits `doc_update` with payload `{ workspaceId, update: number[] }`:

1. Validate the client is in this room
2. Convert to `Uint8Array` and apply: `YdocStoreService.applyUpdate(workspaceId, update)`
3. Broadcast to all **other** clients in the room:
   ```
   { workspaceId, update: Array.from(update), updatedBy: { userId, name } }
   ```
4. Debounce save to database

---

### `awareness_update` Event Handler

Yjs has a separate **Awareness** protocol for ephemeral per-user state — cursor positions, selection ranges, user name/color. This data does NOT need to be persisted.

When a client emits `awareness_update` with payload `{ workspaceId, update: number[] }`:
- Simply broadcast the raw update to all **other** clients in the room:
  ```
  { workspaceId, update: Array.from(update) }
  ```
- Do nothing else — no database write, no debounce

---

### `disconnect` Event Handler

Override `handleDisconnect(client: Socket)`:

1. Find workspace and user via `OnlineUsersStore.findUserBySocketId(client.id)`
2. If found:
   - Remove from online store
   - Broadcast `user_left` to the room: `{ user, onlineUsers }`
   - Log `USER_LEFT` activity to database
3. Flush any pending debounce save for this workspace immediately if this was the last user — do not lose unsaved changes

---

### Debounced Database Save

Use a `Map<workspaceId, NodeJS.Timeout>` to debounce writes. Each time a `doc_update` or `sync_step2` is received, clear and reset the timer for that workspace. After **2000ms of inactivity**, execute the save:

1. Get the full binary state: `YdocStoreService.encodeFullState(workspaceId)`
2. Convert the `Y.Doc` content to a Tiptap JSON string for the `content` column — do this by reading the `Y.XmlFragment` named `'default'` from the doc and encoding it. If conversion is complex, store a placeholder JSON string and update `content` only from the frontend snapshot (see Sprint 6)
3. Save to the `Note` record: update both `ydocState` (the binary buffer) and `content`
4. Log a `NOTE_UPDATED` activity entry

> **Tip on content snapshot:** The simplest approach is to have the frontend send a `content_snapshot` event (Tiptap JSON string) alongside doc updates every few seconds. The gateway stores this string directly as `note.content` without parsing the Yjs binary on the server. This avoids needing a Yjs-to-Tiptap converter on the backend.

---

## Frontend — Dependencies to Install

```
npm install yjs @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor socket.io-client
```

- `yjs` — the CRDT document
- `@tiptap/extension-collaboration` — wires Yjs into Tiptap automatically
- `@tiptap/extension-collaboration-cursor` — renders other users' cursors inside the editor
- `socket.io-client` — Socket.IO transport

---

## Frontend — useCollaboration Hook (`hooks/use-collaboration.ts`)

This hook is significantly simpler than the original design because Yjs handles all document state — you no longer manage `noteContent` as React state.

**Parameters:** `workspaceId: string`

**Returns:**
```
{
  ydoc: Y.Doc,                 // The shared Yjs document — passed directly to Tiptap
  provider: SocketIOProvider,  // The sync provider — passed to CollaborationCursor
  onlineUsers: OnlineUser[],
  activityLogs: ActivityLog[],
  isConnected: boolean,
}
```

Do NOT expose `noteContent` or `updateNote` — Tiptap reads directly from the `Y.Doc` and writes back to it. The hook does not need to know about editor content at all.

---

### Hook Implementation

**Create the `Y.Doc` and Socket:**

On mount:
1. Create a new `Y.Doc`: `const ydoc = new Y.Doc()`
2. Connect socket: `const socket = io(NEXT_PUBLIC_SOCKET_URL, { auth: { token }, transports: ['websocket'] })`
3. Emit `join_workspace` with `{ workspaceId }`

**Implement the Yjs Sync Handshake:**

On `sync_step1` event from server (payload: `{ stateVector: number[] }`):
- Compute what the client has that the server doesn't:
  `const update = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector))`
- Also record the server's state vector on `client.data` for the server to use in `sync_step2`
- Emit `sync_step2`: `{ workspaceId, update: Array.from(update), clientStateVector: Array.from(Y.encodeStateVector(ydoc)) }`

On `sync_complete` event from server (payload: `{ update: number[] }`):
- Apply the server's diff to the local doc: `Y.applyUpdate(ydoc, new Uint8Array(update))`
- The editor will automatically reflect the merged content — no manual state update needed

**Listen for ongoing updates:**

On `doc_update` event (payload: `{ update: number[] }`):
- Apply to local doc: `Y.applyUpdate(ydoc, new Uint8Array(update))`
- Tiptap re-renders automatically

**Send local updates to server:**

On `ydoc.on('update', (update, origin) => { ... })`:
- If `origin` is not `'remote'` (i.e. this is a local user edit, not an applied remote update):
  `socket.emit('doc_update', { workspaceId, update: Array.from(update) })`

> **Important:** When applying remote updates to avoid an echo loop, pass `'remote'` as the origin: `Y.applyUpdate(ydoc, update, 'remote')`. Check `origin !== 'remote'` before emitting.

**Awareness (cursor positions):**

Create a Yjs `Awareness` instance: `const awareness = new awarenessProtocol.Awareness(ydoc)`

Set the local user's awareness state:
```
awareness.setLocalStateField('user', { name: currentUser.name, color: generateColorFromName(currentUser.name) })
```

On `awareness.on('update', ...)`:
- Encode the update: `const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID])`
- Emit: `socket.emit('awareness_update', { workspaceId, update: Array.from(update) })`

On `awareness_update` socket event:
- Apply: `awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote')`

**Content Snapshot (for backend `content` column):**

Every 5 seconds while the socket is connected, emit a `content_snapshot` event with the current Tiptap JSON from the editor. To do this, expose a `setSnapshotCallback(fn)` method from the hook so the editor component can register a callback that returns the current Tiptap JSON. The hook calls this callback every 5 seconds and emits the result.

Alternatively, listen to `ydoc.on('update', ...)` and debounce converting the `Y.XmlFragment` to text — but the snapshot approach is simpler.

**Non-Yjs socket events:**

On `workspace_meta`: set `onlineUsers` and `activityLogs` React state
On `user_joined`: update `onlineUsers` state, show toast
On `user_left`: update `onlineUsers` state, show toast
On `connect` / `disconnect`: set `isConnected` state

**On unmount:**
- `awareness.destroy()`
- `ydoc.destroy()`
- `socket.disconnect()`

---

## Frontend — Workspace Page Shell (`app/workspace/[id]/page.tsx`)

For this sprint, build the workspace page shell with:

- The `useCollaboration` hook initialized
- A connection status indicator (green dot "Connected" / yellow "Reconnecting...")
- A **temporary placeholder** in the editor area that just shows: `"Editor loading... (Tiptap + Yjs wires in Sprint 6)"`
- The sidebar showing the `onlineUsers` list from the hook as plain text names (full sidebar UI comes in Sprint 6)
- A disconnection warning banner above the editor area when `isConnected` is false

Fetch workspace info (name, join code) from `GET /api/workspaces/:id` on mount. Handle `403` and `404` by redirecting to `/dashboard` with appropriate toasts.

---

## Definition of Done

- [ ] Backend installs `yjs`, `y-protocols`, `lib0` without errors
- [ ] `YdocStoreService` correctly creates, updates, and encodes `Y.Doc` instances
- [ ] `join_workspace` → `sync_step1` → `sync_step2` → `sync_complete` handshake completes without errors (verify in browser console)
- [ ] Opening the workspace in Browser A and Browser B both complete the sync handshake
- [ ] The `ydocState` (binary) and `content` (JSON string) are saved to the database after 2 seconds of inactivity
- [ ] Page refresh correctly reconnects and the client receives the persisted document state
- [ ] `awareness_update` events are broadcast between clients (verify in browser network tab)
- [ ] `user_joined` and `user_left` events update `onlineUsers` state in the hook
- [ ] The connection status indicator shows correctly on the workspace page shell
- [ ] Disconnecting one browser shows the other browser's online users update correctly
