# Sprint 4 — Workspace Management (Backend + Frontend)

## Goal
Build the workspace creation and joining system. Users land on a dashboard after login where they can create a new workspace or join an existing one with a code. The dashboard also shows their previously joined workspaces. Workspace data is persisted and the correct note content is loaded when entering a workspace.

---

## Backend — Workspaces Module

Create a new NestJS module at `backend/src/workspaces/`.

The module should import `TypeOrmModule.forFeature([Workspace, Note, WorkspaceParticipant, ActivityLog, User])`.

All endpoints in this module require authentication — apply `JwtAuthGuard` at the controller level.

---

### WorkspacesService (`workspaces.service.ts`)

**`createWorkspace(userId, name)`**
- Generate a unique join code using the `generateCode()` utility from Sprint 2.
- Check the database to ensure the code doesn't already exist (retry generation if it does — up to 5 attempts).
- Create and save the Workspace record with `name`, `code`, and `createdBy: userId`.
- Create and save an empty Note record linked to that workspace (default Tiptap JSON content).
- Create a `WorkspaceParticipant` record linking this user to the workspace.
- Create an `ActivityLog` entry with `eventType: USER_JOINED`, `workspaceId`, `userId`, and `metadata: { name: user.name }`.
- Return the full workspace object including the `code` and the empty note.

**`joinWorkspace(userId, code)`**
- Normalize the code to lowercase and trim whitespace before searching.
- Find the workspace by `code`. If not found, throw a `NotFoundException` with message `"No workspace found with that code. Please check and try again."`.
- Check if a `WorkspaceParticipant` record already exists for this `(workspaceId, userId)` pair.
  - If it does NOT exist: create the participant record and create a `USER_JOINED` activity log entry.
  - If it DOES exist: do nothing (the user is rejoining a workspace they've been in before — that's fine).
- Return the workspace object with `id`, `name`, `code`, and the associated `note` content.

**`getWorkspace(workspaceId, userId)`**
- Find the workspace by `id`. If not found, throw `NotFoundException`.
- Verify that a `WorkspaceParticipant` record exists for this user and workspace. If not, throw a `ForbiddenException` with message `"You are not a participant of this workspace."` — this prevents users from accessing workspaces they never joined by guessing UUIDs.
- Return the workspace with its `note` content and the last 50 `ActivityLog` entries (ordered by `createdAt` descending), each log entry should include the user's name from the `metadata` field.

**`getUserWorkspaces(userId)`**
- Find all `WorkspaceParticipant` records for this user, join with the `Workspace` table.
- Return a list of workspaces the user has ever joined, ordered by `joinedAt` descending (most recently joined first).
- Each item should include `id`, `name`, `code`, and `joinedAt`.

---

### WorkspacesController (`workspaces.controller.ts`)

**`POST /api/workspaces`** — Create a workspace
- Body: `{ name: string }` (validate: required, min 1 char, max 60 chars)
- Calls `createWorkspace(currentUser.userId, body.name)`
- Returns `201` with workspace data

**`POST /api/workspaces/join`** — Join a workspace by code
- Body: `{ code: string }` (validate: required string)
- Calls `joinWorkspace(currentUser.userId, body.code)`
- Returns `200` with workspace data including the note content

**`GET /api/workspaces`** — Get all workspaces for the current user
- Calls `getUserWorkspaces(currentUser.userId)`
- Returns `200` with array of workspaces

**`GET /api/workspaces/:id`** — Get a single workspace with its note and activity logs
- Calls `getWorkspace(params.id, currentUser.userId)`
- Returns `200` with workspace, note content, and activity logs

---

## Frontend — Dashboard Page

Create the dashboard at `app/dashboard/page.tsx`. This is the first page a user sees after logging in.

---

### Page Layout

The dashboard should have a top navigation bar and a main content area.

**Top Navigation Bar (`components/layout/navbar.tsx`):**
- Left side: App logo + name **"CollabNotes"** in indigo
- Right side: User's name displayed with a small avatar (show the first letter of their name in a colored circle — generate a consistent color from the name), and a dropdown menu with a **"Sign Out"** option

**Main Content Area:**
- A page heading: `"Welcome back, [User's Name]"` in large text
- A subheading: `"Your Workspaces"` section below the action cards

---

### Action Cards

Display two prominent action cards side by side (responsive: stack on mobile) near the top of the main content area.

**Card 1 — Create a Workspace:**
- Icon: A `+` or `FolderPlus` icon from Lucide
- Title: `"Create Workspace"`
- Description: `"Start a new collaborative space for your team"`
- Button: `"Create New"` (indigo, full width of card)
- Clicking the button opens a **Create Workspace Dialog** (see below)

**Card 2 — Join a Workspace:**
- Icon: A `LogIn` or `Users` icon
- Title: `"Join Workspace"`
- Description: `"Enter a workspace code to join an existing space"`
- Button: `"Join with Code"` (outline style, full width of card)
- Clicking the button opens a **Join Workspace Dialog** (see below)

---

### Create Workspace Dialog

Use Shadcn `Dialog` component.

Contents:
- Dialog title: `"Create a New Workspace"`
- A single input field labeled `"Workspace Name"` with placeholder `"e.g. Design Team, Sprint Planning..."`
- Validation: required, max 60 characters. Show character count below the input (e.g. `12 / 60`).
- Submit button: `"Create Workspace"` with a loading spinner while the API call is in progress
- On success: close the dialog, show a success toast `"Workspace created!"`, and navigate to `/workspace/[id]`
- On error: show the error message inside the dialog below the input field (do not close the dialog)

---

### Join Workspace Dialog

Use Shadcn `Dialog` component.

Contents:
- Dialog title: `"Join a Workspace"`
- Description text: `"Ask the workspace creator for their join code"`
- A single input field labeled `"Workspace Code"` with placeholder `"e.g. ocean-lamp-74"`
- The input should auto-convert to lowercase as the user types
- Submit button: `"Join Workspace"` with loading state
- On success: close dialog, show success toast `"Joined workspace!"`, navigate to `/workspace/[id]`
- On error (invalid code): show the error message `"No workspace found with that code. Please check and try again."` in red text below the input. Do NOT close the dialog.

---

### Workspace List

Below the action cards, display the list of workspaces the user has previously joined.

**Section heading:** `"Your Workspaces"` with a count badge showing the total number (e.g. `"3 workspaces"`)

**Each workspace card should show:**
- Workspace name in medium bold text
- The join code displayed as a styled `Badge` component (monospace font, indigo/slate colors)
- A copy button (clipboard icon) next to the code — clicking it copies the code to clipboard and shows a `"Copied!"` tooltip for 2 seconds
- The date joined in a relative format (e.g. `"Joined 3 days ago"`) in muted small text
- An **"Enter Workspace"** button on the right side

**Empty state:** If the user has no workspaces, show an illustrated empty state with a friendly message: `"No workspaces yet. Create one or join an existing workspace to get started."` and show both action buttons again.

**Loading state:** Show 3 skeleton cards (use Shadcn `Skeleton`) while the workspace list is loading.

---

### Data Fetching

Use React's `useEffect` to fetch the user's workspaces from `GET /api/workspaces` when the dashboard mounts. Store them in local state. Show a loading skeleton while fetching. Show an error message if the fetch fails.

---

## Definition of Done

- [ ] `POST /api/workspaces` creates a workspace and returns it with a unique join code
- [ ] `POST /api/workspaces/join` with a valid code returns the workspace and note content
- [ ] `POST /api/workspaces/join` with an invalid code returns a `404` with a descriptive message
- [ ] `GET /api/workspaces` returns all workspaces the logged-in user has joined
- [ ] `GET /api/workspaces/:id` returns workspace, note, and last 50 activity logs
- [ ] A user who is not a participant cannot access a workspace via `GET /api/workspaces/:id`
- [ ] Dashboard page loads the user's workspace list with skeleton loading state
- [ ] Create Workspace dialog works end-to-end and navigates to the new workspace
- [ ] Join Workspace dialog shows an inline error for invalid codes (does not close)
- [ ] Join code badge has a working copy-to-clipboard button
- [ ] Empty state shows when user has no workspaces
- [ ] Navbar shows the user's name and a working Sign Out option
