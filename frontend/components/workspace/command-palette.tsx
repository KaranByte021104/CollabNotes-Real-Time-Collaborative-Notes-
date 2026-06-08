"use client";

import React, { useEffect } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { 
  Search, LayoutDashboard, FileText, Plus, Copy, 
  Download, FileArchive, Lock, Unlock, Pin, 
  UserPlus, SunMoon, Laptop, Moon
} from 'lucide-react';
import '@/app/globals.css'; // Make sure styles are loaded

interface Note {
  id: string;
  title: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes?: Note[];
  activeNoteId?: string;
  onNoteSelect?: (noteId: string) => void;
  onCreateNote?: () => void;
  onSearchNotes?: () => void;
  onCopyCode?: () => void;
  onDownloadNote?: (format: string) => void;
  onExportWorkspace?: () => void;
  onToggleLockNote?: () => void;
  isLocked?: boolean;
  isCreator?: boolean;
  onTogglePinNote?: () => void;
  isPinned?: boolean;
  onArchiveWorkspace?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  notes = [],
  activeNoteId,
  onNoteSelect,
  onCreateNote,
  onSearchNotes,
  onCopyCode,
  onDownloadNote,
  onExportWorkspace,
  onToggleLockNote,
  isLocked = false,
  isCreator = false,
  onTogglePinNote,
  isPinned = false,
  onArchiveWorkspace,
}) => {
  const router = useRouter();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  if (!open) return null;

  const runCommand = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => onOpenChange(false)}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command Menu" className="w-full">
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-3 py-2.5">
            <Search className="size-4 text-slate-450 mr-2 shrink-0" />
            <Command.Input 
              autoFocus
              placeholder="Type a command or search..." 
              className="bg-transparent text-sm w-full font-semibold focus:outline-none text-slate-900 dark:text-white"
            />
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="text-xs text-slate-450 text-center py-6 font-semibold">
              No results found.
            </Command.Empty>

            {/* Navigation Group */}
            <Command.Group heading="Navigation" className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider px-2 py-1">
              <Command.Item 
                onSelect={() => runCommand(() => router.push('/dashboard'))}
                className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-250 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="size-4 text-indigo-500" />
                  <span>Go to Dashboard</span>
                </div>
                <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">⌥D</kbd>
              </Command.Item>

              {notes.map((note) => (
                <Command.Item 
                  key={note.id}
                  onSelect={() => runCommand(() => onNoteSelect?.(note.id))}
                  className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-indigo-500" />
                    <span className="truncate">Switch to {note.title || 'Untitled Note'}</span>
                  </div>
                  {activeNoteId === note.id && <span className="text-[10px] text-green-500 font-bold">Active</span>}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions Group */}
            <Command.Group heading="Actions" className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider px-2 py-1 mt-2">
              {onCreateNote && (
                <Command.Item 
                  onSelect={() => runCommand(onCreateNote)}
                  className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-250 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="size-4 text-indigo-500" />
                    <span>Create New Note</span>
                  </div>
                  <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">N</kbd>
                </Command.Item>
              )}

              {onSearchNotes && (
                <Command.Item 
                  onSelect={() => runCommand(onSearchNotes)}
                  className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Search className="size-4 text-indigo-500" />
                    <span>Search Notes</span>
                  </div>
                  <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">/</kbd>
                </Command.Item>
              )}

              {onCopyCode && (
                <Command.Item 
                  onSelect={() => runCommand(onCopyCode)}
                  className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Copy className="size-4 text-indigo-500" />
                    <span>Copy Workspace Code</span>
                  </div>
                  <kbd className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">⌥C</kbd>
                </Command.Item>
              )}

              {onDownloadNote && activeNoteId && (
                <>
                  <Command.Item 
                    onSelect={() => runCommand(() => onDownloadNote('pdf'))}
                    className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Download className="size-4 text-indigo-500 mr-2" />
                    <span>Download Note as PDF</span>
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => onDownloadNote('markdown'))}
                    className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Download className="size-4 text-indigo-500 mr-2" />
                    <span>Download Note as Markdown</span>
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => onDownloadNote('text'))}
                    className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Download className="size-4 text-indigo-500 mr-2" />
                    <span>Download Note as Plain Text</span>
                  </Command.Item>
                  <Command.Item 
                    onSelect={() => runCommand(() => onDownloadNote('docx'))}
                    className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <Download className="size-4 text-indigo-500 mr-2" />
                    <span>Download Note as DOCX</span>
                  </Command.Item>
                </>
              )}

              {onExportWorkspace && (
                <Command.Item 
                  onSelect={() => runCommand(onExportWorkspace)}
                  className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <FileArchive className="size-4 text-indigo-500 mr-2" />
                  <span>Export Workspace as ZIP</span>
                </Command.Item>
              )}

              {isCreator && onToggleLockNote && activeNoteId && (
                <Command.Item 
                  onSelect={() => runCommand(onToggleLockNote)}
                  className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  {isLocked ? (
                    <>
                      <Unlock className="size-4 text-red-500 mr-2" />
                      <span>Unlock Note</span>
                    </>
                  ) : (
                    <>
                      <Lock className="size-4 text-indigo-500 mr-2" />
                      <span>Lock Note</span>
                    </>
                  )}
                </Command.Item>
              )}

              {onTogglePinNote && activeNoteId && (
                <Command.Item 
                  onSelect={() => runCommand(onTogglePinNote)}
                  className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <Pin className="size-4 text-indigo-500 mr-2" />
                  <span>{isPinned ? 'Unpin Note' : 'Pin Note'}</span>
                </Command.Item>
              )}

              {isCreator && onArchiveWorkspace && (
                <Command.Item 
                  onSelect={() => runCommand(onArchiveWorkspace)}
                  className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <FileArchive className="size-4 text-indigo-500 mr-2" />
                  <span>Archive Workspace</span>
                </Command.Item>
              )}
            </Command.Group>

            {/* Settings Group */}
            <Command.Group heading="Settings" className="text-[10px] font-black text-slate-455 dark:text-slate-500 uppercase tracking-wider px-2 py-1 mt-2">
              <Command.Item 
                onSelect={() => runCommand(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
                className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <SunMoon className="size-4 text-indigo-500 mr-2" />
                <span>Toggle Dark Mode</span>
              </Command.Item>
              {onCopyCode && (
                <Command.Item 
                  onSelect={() => runCommand(onCopyCode)}
                  className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-255 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <UserPlus className="size-4 text-indigo-500 mr-2" />
                  <span>Invite Members</span>
                </Command.Item>
              )}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
