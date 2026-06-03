"use client";

import React, { useEffect } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { EditorToolbar } from './editor-toolbar';
import { AlertTriangle } from 'lucide-react';

interface RichTextEditorProps {
  ydoc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  currentUser: {
    name: string;
    color: string;
  };
  editable?: boolean;
  setSnapshotCallback?: (fn: () => string) => void;
}

/**
 * Build a custom Tiptap Extension that wraps yCursorPlugin from @tiptap/y-tiptap.
 * 
 * Why not use @tiptap/extension-collaboration-cursor?
 * That package is stuck at v2 semantics and uses y-prosemirror's ySyncPluginKey.
 * Tiptap v3's Collaboration extension uses @tiptap/y-tiptap's ySyncPluginKey (a different
 * object). The cursor plugin must use the SAME key, otherwise getState() returns undefined
 * and createDecorations() throws "Cannot read properties of undefined (reading 'doc')".
 *
 * By importing yCursorPlugin directly from @tiptap/y-tiptap we guarantee the same key.
 */
function buildCursorExtension(
  awareness: awarenessProtocol.Awareness,
  user: { name: string; color: string },
) {
  return Extension.create({
    name: 'collaborationCursor',

    addProseMirrorPlugins() {
      // Thin caret-style cursor — name label only appears on hover via CSS
      const cursorBuilder = (u: { name: string; color: string }) => {
        const cursor = document.createElement('span');
        cursor.classList.add('collab-cursor');
        cursor.style.setProperty('--cursor-color', u.color);

        // Name label — hidden by default, visible on cursor hover
        const label = document.createElement('span');
        label.classList.add('collab-cursor__label');
        label.textContent = u.name;
        cursor.appendChild(label);

        return cursor;
      };

      // Very subtle selection highlight (15% opacity) instead of a solid block
      const selectionBuilder = (u: { name: string; color: string }) => ({
        style: `background-color: ${u.color}26`,
      });

      // Broadcast our identity so remote users see our name + color
      awareness.setLocalStateField('user', {
        name: user.name,
        color: user.color,
      });

      return [yCursorPlugin(awareness, { cursorBuilder, selectionBuilder })];
    },
  });
}

export function RichTextEditor({
  ydoc,
  awareness,
  currentUser,
  editable = true,
  setSnapshotCallback,
}: RichTextEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // CRITICAL: Disable built-in history/undo-redo — Yjs (via Collaboration) provides
          // its own per-client undo/redo. Having both causes conflicts.
          history: false,    // Tiptap v2 compat
          undoRedo: false,   // Tiptap v3: StarterKit now bundles UndoRedo extension
          // Disable StarterKit's built-in Underline since we add it separately with its own config
          underline: false,
        } as any),

        Collaboration.configure({
          document: ydoc,
        }),

        // Cursor extension using @tiptap/y-tiptap's yCursorPlugin (v3-compatible)
        buildCursorExtension(awareness, currentUser),

        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Highlight.configure({
          multicolor: true,
        }),
        Placeholder.configure({
          placeholder: 'Start writing your note… Use the toolbar above to format your text.',
        }),
        CharacterCount,
      ],
      editable,
      immediatelyRender: false, // Avoids Next.js SSR hydration mismatch warning
    },
    // Empty dep array — stable initialization.
    // Parent page guards `!ydoc || !awareness` so both are always ready at first render.
    [],
  );

  // Sync editability with live socket connection state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Register the snapshot callback so the hook can periodically serialize content to DB
  useEffect(() => {
    if (editor && setSnapshotCallback) {
      setSnapshotCallback(() => JSON.stringify(editor.getJSON()));
    }
  }, [editor, setSnapshotCallback]);

  if (!editor) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Initializing collaborative editor…</p>
      </div>
    );
  }

  const wordCount = editor.storage.characterCount?.words() ?? 0;
  const charCount = editor.storage.characterCount?.characters() ?? 0;

  return (
    <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm relative group">

      {/* Formatting Controls */}
      <EditorToolbar editor={editor} editable={editable} />

      {/* Offline Warning Banner */}
      {!editable && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 p-3 text-amber-800 dark:text-amber-300 flex items-center gap-2 text-xs font-semibold">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-500" />
          <span>⚠️ Connection lost. Your changes will sync when reconnected.</span>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="flex-1 min-h-[450px] p-6 lg:p-8 cursor-text">
        <EditorContent
          editor={editor}
          className="prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[400px]"
        />
      </div>

      {/* Footer — word/character count */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex justify-end text-[10px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20 rounded-b-xl">
        <span>
          {wordCount} {wordCount === 1 ? 'word' : 'words'} · {charCount} {charCount === 1 ? 'character' : 'characters'}
        </span>
      </div>
    </div>
  );
}
