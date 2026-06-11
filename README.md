# CollabNotes — Real-Time Collaborative Workspace

A modern, premium collaborative notes application that allows teams to seamlessly create, share, and edit documents in real-time. The application guarantees conflict-free simultaneous editing, live colored carets with cursor presence indicators, interactive activity logs, robust connection resiliency, and sleek class-based theme customization.

---

## 📖 Documentation Index

To make documentation easier to navigate, detailed guides have been split into dedicated files:

* 🗄️ **[Database Schema](file:///g:/AIP/NOTES%20APP/docs/database-schema.md)**: Details TypeORM entities, table definitions, columns, indexes, and entity relationship diagrams.
* 🔌 **[API & WebSockets Documentation](file:///g:/AIP/NOTES%20APP/docs/api-documentation.md)**: Documents REST API controllers, parameters, authorization requirements, and Socket.IO real-time event definitions.
* 🏗️ **[Architecture Overview](file:///g:/AIP/NOTES%20APP/docs/architecture.md)**: Explains the high-level 4-tier design, data-flow sequences, and Yjs synchronization details.

---

## 1. Project Features & Overview

CollabNotes is designed for teams requiring fast, zero-latency collaborative documentation. Key features include:

### 1.1 Core Collaboration & Presence
* **Real-time Collaborative Editing**: Concurrent note editing powered by conflict-free replicated data types (Yjs CRDTs).
* **Live User Presence**: View active room participants with distinct cursor positions and names.
* **Workspace Activity Feed**: Real-time event log tracking members joining, leaving, and updating workspace resources.
* **Robust Reconnection**: Automated connection fallback, retry banners, and recovery overlays for offline events.

### 1.2 Document & Workspace Management
* **Multi-Format Downloads**: Export note contents instantly as PDF, Markdown, Plain Text, or Word Document (`.docx`).
* **Note Pinning**: Pin crucial notes to the top of the sidebar, sorted chronologically by pin date.
* **Creator-led Note Locking**: Workspace creators can lock notes in real-time to make them read-only for others.
* **Workspace Archiving & Deletion**: Reversible workspace archiving (read-only mode) and creator-led permanent deletion.
* **Keyword Search**: Database-driven keyword search featuring context snippets and highlighted query terms.
* **Command Palette (Cmd+K / Ctrl+K)**: Instant search and command dialog.
* **Real-Time Notifications**: Floating bell notifying active users in real-time of workspace events.
* **Profile & Avatar Management**: Custom profiles with bios and compressed/resized avatars stored locally.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS, Shadcn/ui, Tiptap, Yjs, Socket.IO Client, `next-themes`, `cmdk` |
| **Backend** | NestJS, TypeScript, TypeORM, Passport JWT, Socket.IO, Yjs, Archiver, `@nestjs-modules/mailer`, `nodemailer`, `handlebars`, `sharp` |
| **Database** | PostgreSQL |
| **Real-time** | Socket.IO (transport layer) + Yjs CRDT (conflict resolution) |

---

## 3. Getting Started (Local Setup)

Follow these steps to configure and run CollabNotes locally:

### Prerequisites
* **Node.js**: Version 18 or higher.
* **PostgreSQL**: A local database server running on port `5432`.

### Step-by-Step Setup

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd collab-notes
   ```

2. **Configure the Backend**
   Navigate to the backend folder, copy the example environment file, and install dependencies:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   ```
   *Edit `.env` and fill in your PostgreSQL credentials and SMTP credentials (e.g. Mailtrap for development).*

3. **Initialize the Database Schema & Seed**
   Ensure PostgreSQL is running and you have created a database matching `DATABASE_NAME` (e.g., `collab_notes`).
   Run the database seed script to populate default users and workspace parameters:
   ```bash
   npm run start:dev
   # Optional: Run seed script in a separate terminal if needed
   npx ts-node src/database/seed.ts
   ```

4. **Configure the Frontend**
   Navigate to the frontend folder, copy the environment configuration, and install dependencies:
   ```bash
   cd ../frontend
   cp .env.example .env.local
   npm install
   ```

5. **Run the Applications**
   * **Start Backend Server**: In `/backend`, run:
     ```bash
     npm run start:dev
     ```
     The NestJS server will start on port `3001` (REST on `http://localhost:3001/api`).
   * **Start Frontend Dev Server**: In `/frontend`, run:
     ```bash
     npm run dev
     ```
     The Next.js client will start on port `3000`. Navigate to `http://localhost:3000` to begin collaborating.

---

## 4. Environment Variables Reference

### Backend Configurations (`backend/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | NestJS server port | `3001` |
| `DATABASE_HOST` | PostgreSQL hostname | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` |
| `DATABASE_USER` | PostgreSQL username | `postgres` |
| `DATABASE_PASSWORD`| PostgreSQL password | `yourpassword` |
| `DATABASE_NAME` | PostgreSQL database name | `collab_notes` |
| `JWT_SECRET` | Secret key for JWT signing | `a-long-random-string-used-for-auth` |
| `FRONTEND_URL` | Allowed CORS client origin | `http://localhost:3000` |
| `MAIL_HOST` | SMTP server host | `smtp.mailtrap.io` |
| `MAIL_PORT` | SMTP server port | `2525` / `587` |
| `MAIL_USER` | SMTP server username | `your_username` |
| `MAIL_PASS` | SMTP server password | `your_password` |
| `MAIL_FROM` | Sender display name and email | `"CollabNotes <no-reply@collabnotes.com>"` |

### Frontend Configurations (`frontend/.env.local`)

| Variable | Description | Example / Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend REST Base API URL | `http://localhost:3001/api` |
| `NEXT_PUBLIC_SOCKET_URL`| Real-time Socket.IO base URL | `http://localhost:3001` |

---

## 5. Design Decisions & Bugfix Refinements

* **CRDT with Yjs**: We selected Yjs over typical operational transformation (OT) or "last-write-wins" implementations. CRDTs offer mathematical consistency guarantees where document nodes resolve conflict-free on both client and server regardless of packet arrival order. The `@tiptap/extension-collaboration` package makes wiring Yjs documents into the WYSIWYG editor canvas highly robust.
* **Dual Storage Schema (`ydocState` + `content`)**: The PostgreSQL database stores both the binary Yjs snapshot (`ydocState` BYTEA) and a stringified JSON document structure (`content` TEXT). The binary represents the absolute source of truth for the real-time websocket editor. The plain text content snapshot acts as a lightweight fallback for fast loading on dashboard list views, search queries, or analytics.
* **In-Memory Server-Side Docs**: Active workspace documents are compiled in memory inside NestJS using Yjs `Y.Doc` instances. When the first user connects, the binary state is loaded from PostgreSQL. When the last user disconnects, the in-memory document is garbage-collected. This avoids loading states from the DB for every single keystroke.
* **Socket.IO for Transport**: While Yjs is transport-agnostic, Socket.IO was chosen due to its robust support for rooms, connection fallbacks, automatic reconnect retry protocols, and security authentication integrations.
* **Per-User Undo/Redo**: By isolating edit tracking to individual client history instances within the collaborative context, undoing text edits only affects the local user's keystrokes. It guarantees you never inadvertently revert work done by remote colleagues.
* **Yjs Template State Initialization (Sprint 9 Polish)**: To support note templates seamlessly with collaborative editing, the backend service was modified to populate the initial Yjs `'default'` root XML fragment directly on the server by parsing ProseMirror JSON elements (`heading`, `paragraph`, `bulletList`, `listItem`) when a note's `ydocState` is empty. This prevents new editors from overwriting database template contents with a blank document state.
* **Active Note Row Stacking Context (Popover Polish)**: Sibling note rows in the sidebar list established separate `relative` stacking contexts, resulting in later siblings rendering on top of the absolute-positioned tag popovers of preceding rows. This was resolved by applying a conditional `z-30` class to the note row whose popover is currently active, raising its layer above sibling elements.
* **Notification Bell Badge Utility (CSS Polish)**: Switched the notification unread badge to use standard Tailwind sizes (`size-5` instead of `min-w-4.5` / `h-4.5`) and standard colors (`bg-red-600` instead of `bg-red-650`) to resolve rendering issues and ensure complete visibility across light and dark modes.
* **Archiver ESModules Compatibility**: Fixed export ZIP crashes on ESModules by migrating from standard factory imports to namespace instantiations (`new (archiver as any).ZipArchive(...)`) and handling async stream emitter errors to prevent unhandled process exceptions.
* **Secure OTP Management & Email Dispatch (Sprint 10)**: Password reset OTP codes are bcrypt-hashed prior to database storage, rendering compromised tables non-threatening. Requesting a new OTP invalidates previous active OTPs for the user. Cooldown limits prevent email floods, and all password reset endpoints employ generic response text (regardless of email existence) to guard against user enumeration attacks.
* **Session Invalidation on Password Change**: Logged-in users who change their password are forced to log out immediately. This invalidates their active JWT sessions and demands a fresh authentication phase, upholding robust security practices.

---

## 6. Known Limitations

* **No Horizontal Scaling**: The server maintains active `Y.Doc` state buffers in NestJS memory. If multiple gateway instances are deployed behind a load balancer, clients in different instances will fail to sync. Resolving this requires a horizontal adapter (e.g., Redis Pub/Sub with a centralized database provider).
* **No Asset Embeds**: The WYSIWYG editor supports structured formatting (headings, lists, alignments, underlines) but does not allow direct file uploads or local image embeds, which would require cloud bucket integrations.
* **Snapshot Save Delay**: The REST-readable `content` snapshot database column is synced every 5 seconds. Although the primary `ydocState` binary is saved immediately on disconnect, the plain-text column might lag slightly behind the live cursor state during active typing sessions.
* **Unencrypted Data Storage**: Note contents and binary updates are saved in plain format inside PostgreSQL. Sensitive enterprise workspaces should be protected via column-level database encryption layers.
* **Local Avatar Storage**: Uploaded avatars are stored on the local server filesystem (`backend/uploads/avatars/`) during local development. For production deployments, this local storage should be replaced with a cloud object storage service (e.g. AWS S3, Cloudflare R2, or similar) to support horizontal scaling and containerized deployments.
