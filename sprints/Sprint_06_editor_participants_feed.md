
# Sprint 6 — Rich Text Editor (Yjs + Tiptap), Active Participants & Activity Feed

## Goal
Wire the Tiptap rich text editor directly into the Yjs `Y.Doc` from the `useCollaboration` hook. All collaboration — content sync, conflict resolution, and live cursor rendering — is handled automatically by Yjs and Tiptap together. Also build the full active participants panel and activity feed in the workspace sidebar, and assemble the complete final workspace page layout.

---

## Rich Text Editor with Yjs

### Dependencies to Install (Frontend)

All Yjs and collaboration packages were installed in Sprint 5. Install the remaining Tiptap extensions:

```
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-text-align @tiptap/extension-highlight @tiptap/extension-code-block-lowlight lowlight
```

---

### How Tiptap + Yjs Integration Works

The `@tiptap/extension-collaboration` extension replaces Tiptap's built-in history (undo/redo) with Yjs. Instead of passing a `content` string to Tiptap and listening to `onChange`, you pass the `Y.Doc` directly. Tiptap reads from and writes to the Yjs document automatically — every keystroke produces a Yjs update, and every incoming Yjs update from the socket re-renders the editor in place without disrupting the local cursor.

The `@tiptap/extension-collaboration-cursor` extension reads from the Yjs `Awareness` instance and renders other users' cursors as colored carets with name labels — this is completely automatic once the awareness object is provided.

**You do not need to:**
- Manually apply remote updates to the editor
- Worry about cursor position being lost on remote updates
- Track `noteContent` as React state
- Suppress `onChange` calls to avoid infinite loops

Yjs and Tiptap handle all of this.

---

### Editor Component (`components/editor/rich-text-editor.tsx`)

Create a component that accepts these props:
```
{
  ydoc: Y.Doc,
  awareness: Awareness,         // from the useCollaboration hook
  currentUser: { name, color }, // for the collaboration cursor label
  editable?: boolean,           // defaults to true, set false when disconnected
}
```

**Tiptap `useEditor` Configuration:**

```
useEditor({
  extensions: [
    StarterKit.configure({
      history: false,   // CRITICAL: disable built-in history — Yjs provides its own
    }),
    Collaboration.configure({
      document: ydoc,   // The Y.Doc from the hook — this is the full sync integration
    }),
    CollaborationCursor.configure({
      provider: { awareness },   // Pass the awareness object
      user: { name: currentUser.name, color: currentUser.color },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: 'Start writing your note... Use the toolbar above to format your text.' }),
    CharacterCount,
    // CodeBlockLowlight.configure({ lowlight }) — add if code block syntax highlighting is desired
  ],
  editable: editable ?? true,
})
```

**Content Snapshot for Backend:**

In Sprint 5, the hook needed a `setSnapshotCallback` to send the Tiptap JSON to the backend for the `content` column. Implement this inside the editor component:

Use a `useEffect` with a `setInterval` of 5000ms. Every 5 seconds, if the editor exists and the socket is connected:
```
const json = JSON.stringify(editor.getJSON())
socket.emit('content_snapshot', { workspaceId, content: json })
```

Import the socket from a context or pass it as a prop from the workspace page.

On the backend, add a `content_snapshot` event handler in the gateway that simply updates `note.content` in the database with the received string — no debounce needed since it's only every 5 seconds.

**Handling Disconnection:**

When `editable` is `false` (socket disconnected), Tiptap automatically prevents editing. Show a warning banner above the editor:
```
"⚠️ Connection lost. Your changes will sync when reconnected."
```
Use an amber/yellow background for this banner (`bg-amber-50 border border-amber-200 text-amber-800`). Hide it when `editable` is `true`.

---

### Editor Toolbar (`components/editor/editor-toolbar.tsx`)

Build a sticky toolbar that sits above the editor. Since Tiptap is now backed by Yjs, the toolbar works exactly the same — it reads `editor.isActive()` states and calls `editor.chain().focus()...` commands. Nothing changes about the toolbar implementation due to Yjs.

**Toolbar Design:**
- White background with a subtle bottom border (`border-b border-slate-200 dark:border-slate-700`)
- Compact height (~44px), sticky at the top of the editor container
- Icon buttons grouped by category with a thin vertical `Separator` between groups

**Button Groups (left to right):**

1. **Text Style** — Bold (`Bold`), Italic (`Italic`), Underline (`Underline`), Strikethrough (`Strikethrough`) from Lucide
2. **Separator**
3. **Headings** — `H1`, `H2`, `H3` text label buttons
4. **Separator**
5. **Lists** — Bullet List (`List`), Ordered List (`ListOrdered`)
6. **Separator**
7. **Alignment** — Left (`AlignLeft`), Center (`AlignCenter`), Right (`AlignRight`)
8. **Separator**
9. **Blocks** — Blockquote (`Quote`), Code Block (`Code2`)
10. **Separator**
11. **Extras** — Highlight (`Highlighter`), Horizontal Rule (`Minus`), Clear Formatting (`RemoveFormatting`)
12. **Right side** — Undo (`Undo2`) and Redo (`Redo2`) pushed to the far right

> **Note on Undo/Redo:** With Yjs, undo/redo is **per-user** — each user can only undo their own changes, not other users' edits. This is the correct and expected behavior with CRDT-based collaboration. The undo/redo buttons work automatically via Yjs's `UndoManager` which `@tiptap/extension-collaboration` sets up internally.

**Active State:** Use Shadcn `Toggle` components. Show visually pressed state using `editor.isActive('bold')`, `editor.isActive('heading', { level: 1 })`, etc.

**Disabled State:** All buttons disabled and greyed out when `editable` is `false`.

---

### Live Cursors Styling

`CollaborationCursor` renders other users' cursors as colored carets inside the editor with a small name label above. Add the following CSS to `globals.css` to style them properly:

```css
/* Collaboration cursor styles */
.collaboration-cursor__caret {
  border-left: 2px solid;
  border-right: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: white;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.5em;
  user-select: none;
  white-space: nowrap;
}
```

The `color` and `background` for each cursor is set automatically by `CollaborationCursor` from the `user.color` field in the awareness state.

---

### Editor Wrapper & Styling

Wrap the toolbar and editor in a container with:
- White background (`bg-white dark:bg-slate-900`)
- Rounded corners and a subtle border (`border border-slate-200 dark:border-slate-700`)
- The editor content area: generous padding (`p-8`), minimum height `calc(100vh - 220px)`
- Apply Tailwind Typography (`prose prose-slate dark:prose-invert max-w-none`) to the editor's content div for clean readable typography
- Text cursor in the editor area
- Indigo selection highlight color

Install Tailwind Typography: `npm install @tailwindcss/typography` and add `require('@tailwindcss/typography')` to the `plugins` array in `tailwind.config.ts`.

---

### Word Count Footer

Below the editor, show a muted footer:
```
"128 words · 742 characters"
```
Use `editor.storage.characterCount.words()` and `editor.storage.characterCount.characters()`. Right-align this text in small muted styling.

---

## Active Participants Panel

### Component: `components/workspace/online-users.tsx`

**Props:** `users: OnlineUser[]`, `currentUserId: string`

**Design:**
- Section heading: `"Online Now"` with a green pulsing dot (`animate-pulse` on a `bg-green-500` circle)
- Each user row:
  - Circular avatar (40px) with first letter of name, background set to `user.color`
  - Small green presence dot overlaid on bottom-right of avatar
  - User's name next to avatar
  - If `user.userId === currentUserId`, append `"(you)"` in muted text
- If only 1 user online: show muted text `"Share your workspace code to invite others"` below the list
- If more than 8 users: show the first 8 and a `"+N more"` indicator

> **Note:** Since `CollaborationCursor` already shows each user's cursor color inside the editor, the avatar colors in this panel should match — both use the same `generateColorFromName(name)` utility so they are always consistent.

---

### Toast Notifications

These are triggered inside `useCollaboration` hook (Sprint 5). Final toast designs:
- Join: Sonner toast with a green dot emoji and `"[Name] joined the workspace"`, 3s duration
- Leave: Sonner toast with a muted message `"[Name] left the workspace"`, 3s duration

Position toasts bottom-right.

---

## Activity Feed

### Data Source

`GET /api/workspaces/:id` returns the last 50 activity logs on page load. These are stored in `activityLogs` state from `useCollaboration`. New events received via socket (`user_joined`, `user_left`, `note_updated`) are prepended to this list in real time.

For `note_updated` entries: add to the activity feed at most once every 10 seconds per user to avoid flooding. Debounce in the hook: if a `doc_update` is received, set a 10-second timer — when it fires, prepend a `note_updated` activity entry to the local list.

---

### Component: `components/workspace/activity-feed.tsx`

**Props:** `logs: ActivityLog[]`

**Design:**
- Section heading: `"Activity"` with a `History` Lucide icon
- Scrollable section: `max-h-64 overflow-y-auto`
- Each log entry (compact row):
  - Colored icon by event type:
    - `user_joined` → green `UserPlus`
    - `user_left` → orange `UserMinus`
    - `note_updated` → blue `FileEdit`
  - Description: `"[Name] joined"`, `"[Name] left"`, `"[Name] updated the note"`
  - Relative timestamp (`"just now"`, `"2m ago"`) in extra-small muted text

Write a simple `formatRelativeTime(date: Date): string` utility in `lib/utils.ts`:
- < 60 seconds → `"just now"`
- < 60 minutes → `"Xm ago"`
- < 24 hours → `"Xh ago"`
- else → formatted date string

**Empty state:** `"No activity yet"` in muted text.

---

## Full Workspace Page Layout (Final)

Assemble the complete workspace page at `app/workspace/[id]/page.tsx`. Replace the Sprint 5 shell with the final layout.

### Layout:

```
┌──────────────────────────────────────────────────────────┐
│  NAVBAR                                                  │
│  [← Back]  [Workspace Name]  [Code Badge + Copy]  [User]│
├─────────────────────────────────┬────────────────────────┤
│                                 │  SIDEBAR (280px)       │
│  EDITOR AREA                    │  ┌──────────────────┐  │
│                                 │  │ 🟢 Online Now    │  │
│  [TOOLBAR - sticky]             │  │ Avatar Avatar    │  │
│  ─────────────────────────────  │  │ Avatar           │  │
│                                 │  └──────────────────┘  │
│  [Disconnection Banner if any]  │  ─────────────────────  │
│                                 │  ┌──────────────────┐  │
│  [Tiptap Editor with           │  │ Activity         │  │
│   Yjs + Live Cursors]          │  │ ○ User joined    │  │
│                                 │  │ ○ Note updated   │  │
│  ─────────────────────────────  │  └──────────────────┘  │
│  128 words · 742 characters     │                        │
└─────────────────────────────────┴────────────────────────┘
```

**Navbar for workspace page:**
- Left: `← Back to Dashboard` link with `ChevronLeft` icon
- Center: Workspace name in medium bold
- Right: Join code as indigo `Badge` (monospace, with copy button), then user avatar/dropdown

**Sidebar:**
- Fixed width 280px, `border-l border-slate-200 dark:border-slate-700`
- Full viewport height minus navbar, does not scroll with the page (`h-[calc(100vh-64px)] sticky top-16`)
- Internal padding `p-4`
- `OnlineUsers` component at the top
- `Separator` in the middle
- `ActivityFeed` component at the bottom

**Editor area:**
- Takes all remaining width
- Replace the Sprint 5 `<textarea>` placeholder with `<RichTextEditor ydoc={ydoc} awareness={awareness} currentUser={...} editable={isConnected} />`
- The `awareness` object must be extracted from the hook — add it to the hook's return value alongside `ydoc`

**Data flow summary:**
```
useCollaboration(workspaceId)
  → returns: { ydoc, awareness, onlineUsers, activityLogs, isConnected }

<RichTextEditor ydoc={ydoc} awareness={awareness} editable={isConnected} />
  → Tiptap reads/writes directly to ydoc
  → Yjs syncs ydoc via socket automatically
  → CollaborationCursor reads awareness for live cursors

<OnlineUsers users={onlineUsers} />
<ActivityFeed logs={activityLogs} />
```

---

## Definition of Done

- [ ] Tiptap editor initializes without errors using `Collaboration.configure({ document: ydoc })`
- [ ] `StarterKit` is configured with `history: false` (required for Yjs undo to work)
- [ ] Typing in Browser A appears in Browser B in real time with no cursor jumping
- [ ] Two users typing simultaneously does not cause one user's edit to be lost — both edits merge correctly (verify by typing quickly in both windows)
- [ ] Live colored cursors from other users appear inside the editor with name labels
- [ ] Cursor colors in the editor match avatar colors in the Online Users panel
- [ ] Undo in one browser only undoes that user's own edits, not the other user's
- [ ] The disconnection warning banner appears when the socket drops and disappears on reconnect
- [ ] The editor is non-editable when `isConnected` is false
- [ ] The toolbar correctly shows active states (bold button pressed when cursor is in bold text)
- [ ] Word and character count display correctly below the editor
- [ ] Online Users panel shows all connected users with correct colors and a "(you)" label
- [ ] Activity Feed updates in real time as users join, leave, and edit
- [ ] The workspace page navbar shows workspace name and a working copy-to-clipboard join code badge
- [ ] Sidebar collapses correctly on smaller screens (implemented fully in Sprint 7)
