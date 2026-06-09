"use client";

import React, { useState, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Clipboard, Check, AlertTriangle, Users, Trash2, Menu, LogOut, Settings, Archive, MoreVertical, FileDown, Lock, Unlock } from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useCollaboration } from '@/hooks/use-collaboration';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { OnlineUsers } from '@/components/workspace/online-users';
import { ActivityFeed } from '@/components/workspace/activity-feed';
import { NotesSidebar } from '@/components/workspace/notes-sidebar';
import { MembersDialog } from '@/components/workspace/members-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import api from '@/lib/axios';

import { TemplatePickerDialog } from '@/components/workspace/template-picker-dialog';
import { CommandPalette } from '@/components/workspace/command-palette';
import { NoteTemplate } from '@/lib/note-templates';

interface LogItem {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: {
    name?: string;
    userName?: string;
  };
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface NoteItem {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  lockedById?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  tags?: TagItem[];
}

interface WorkspaceDetail {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string | null;
  createdBy: {
    id: string;
    name: string;
  };
  notes: NoteItem[];
  activityLogs: LogItem[];
  tags?: TagItem[];
}

const generateColorFromName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981',
    '#059669', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
    '#D946EF', '#EC4899', '#F43F5E'
  ];
  return colors[Math.abs(hash) % colors.length];
};

export default function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const workspaceId = unwrappedParams.id;
  
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryNoteId = searchParams.get('noteId');

  // Local State
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState<boolean>(false);
  
  // Dialogs & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [membersOpen, setMembersOpen] = useState<boolean>(false);
  const [workspaceDeleteOpen, setWorkspaceDeleteOpen] = useState<boolean>(false);
  const [workspaceLeaveOpen, setWorkspaceLeaveOpen] = useState<boolean>(false);

  // Sprint 9 States
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [workspaceArchiveOpen, setWorkspaceArchiveOpen] = useState<boolean>(false);
  const [isArchivingWorkspace, setIsArchivingWorkspace] = useState<boolean>(false);
  const [isWorkspaceArchived, setIsWorkspaceArchived] = useState<boolean>(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState<boolean>(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  
  // Deletion Input
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState<boolean>(false);
  const [isLeavingWorkspace, setIsLeavingWorkspace] = useState<boolean>(false);

  // Real-time lockout states
  const [isWorkspaceDeleted, setIsWorkspaceDeleted] = useState<boolean>(false);
  const [isMemberRemoved, setIsMemberRemoved] = useState<boolean>(false);

  // Call the real-time collaboration hook
  const { 
    ydoc,
    awareness,
    onlineUsers, 
    activityLogs: realTimeLogs, 
    isConnected, 
    isSynced,
    isReconnecting,
    reconnectFailed,
    setSnapshotCallback,
    socket
  } = useCollaboration(workspaceId, activeNoteId);

  // Mark initial load complete when REST details are loaded, activeNoteId is set, and Yjs sync is complete
  useEffect(() => {
    if (!isLoading && activeNoteId && ydoc && awareness && isSynced) {
      setHasLoadedInitial(true);
    }
  }, [isLoading, activeNoteId, ydoc, awareness, isSynced]);

  // Fetch initial workspace details (metadata)
  useEffect(() => {
    fetchWorkspaceDetails();
  }, [workspaceId]);

  // Real-time Socket Event Listeners for Workspace/Notes Updates
  useEffect(() => {
    if (!socket) return;

    const handleNoteCreated = (data: { note: any }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        if (prev.notes.some(n => n.id === data.note.id)) return prev;
        const newNotes = [...prev.notes, data.note].sort((a, b) => a.order - b.order);
        return { ...prev, notes: newNotes };
      });
      toast.success(`Note "${data.note.title}" was created.`);
    };

    const handleNoteRename = (data: { noteId: string; title: string }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, title: data.title } : n
        );
        return { ...prev, notes: newNotes };
      });
    };

    const handleNoteDeleted = (data: { noteId: string; fallbackNoteId: string }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.filter(n => n.id !== data.noteId);
        return { ...prev, notes: newNotes };
      });

      if (activeNoteId === data.noteId) {
        if (data.fallbackNoteId) {
          setActiveNoteId(data.fallbackNoteId);
          toast.info('Active note was deleted. Switched to another note.');
        }
      }
    };

    const handleWorkspaceDeleted = (data: { workspaceId: string; workspaceName: string }) => {
      if (data.workspaceId === workspaceId) {
        setIsWorkspaceDeleted(true);
      }
    };

    const handleMemberRemoved = (data: { removedUserId: string; workspaceId: string }) => {
      if (data.workspaceId === workspaceId && user && user.id === data.removedUserId) {
        setIsMemberRemoved(true);
      }
    };

    const handleNoteLocked = (data: { noteId: string; lockedBy: any }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, isLocked: true, lockedById: data.lockedBy.userId } : n
        );
        return { ...prev, notes: newNotes };
      });
      if (data.noteId === activeNoteId) {
        toast.warning(`This note is now locked by the creator.`);
      }
    };

    const handleNoteUnlocked = (data: { noteId: string }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, isLocked: false, lockedById: null } : n
        );
        return { ...prev, notes: newNotes };
      });
      if (data.noteId === activeNoteId) {
        toast.info(`This note is now unlocked.`);
      }
    };

    const handleNotePinned = (data: { noteId: string; isPinned: boolean }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, isPinned: true, pinnedAt: new Date().toISOString() } : n
        );
        return { ...prev, notes: newNotes };
      });
    };

    const handleNoteUnpinned = (data: { noteId: string }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, isPinned: false, pinnedAt: null } : n
        );
        return { ...prev, notes: newNotes };
      });
    };

    const handleWorkspaceArchived = (data: { workspaceId: string; workspaceName: string }) => {
      if (data.workspaceId === workspaceId) {
        setIsWorkspaceArchived(true);
      }
    };

    const handleWorkspaceUnarchived = (data: { workspaceId: string }) => {
      if (data.workspaceId === workspaceId) {
        setWorkspace(prev => prev ? { ...prev, isArchived: false, archivedAt: null } : null);
        setIsWorkspaceArchived(false);
        toast.success('Workspace unarchived by the creator');
      }
    };

    const handleTagCreated = (data: { tag: TagItem }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const currentTags = prev.tags || [];
        const exists = currentTags.some(t => t.id === data.tag.id || t.name.toLowerCase() === data.tag.name.toLowerCase());
        if (exists) return prev;
        return { ...prev, tags: [...currentTags, data.tag] };
      });
    };

    const handleTagDeleted = (data: { tagId: string }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const currentTags = (prev.tags || []).filter(t => t.id !== data.tagId);
        const newNotes = prev.notes.map(n => ({
          ...n,
          tags: (n.tags || []).filter(t => t.id !== data.tagId)
        }));
        return { ...prev, tags: currentTags, notes: newNotes };
      });
    };

    const handleNoteTagsUpdated = (data: { noteId: string; tags: TagItem[] }) => {
      setWorkspace(prev => {
        if (!prev) return null;
        const newNotes = prev.notes.map(n => 
          n.id === data.noteId ? { ...n, tags: data.tags } : n
        );
        return { ...prev, notes: newNotes };
      });
    };

    socket.on('note_created', handleNoteCreated);
    socket.on('note_rename', handleNoteRename);
    socket.on('note_deleted', handleNoteDeleted);
    socket.on('workspace_deleted', handleWorkspaceDeleted);
    socket.on('member_removed', handleMemberRemoved);
    socket.on('note_locked', handleNoteLocked);
    socket.on('note_unlocked', handleNoteUnlocked);
    socket.on('note_pinned', handleNotePinned);
    socket.on('note_unpinned', handleNoteUnpinned);
    socket.on('workspace_archived', handleWorkspaceArchived);
    socket.on('workspace_unarchived', handleWorkspaceUnarchived);
    socket.on('tag_created', handleTagCreated);
    socket.on('tag_deleted', handleTagDeleted);
    socket.on('note_tags_updated', handleNoteTagsUpdated);

    return () => {
      socket.off('note_created', handleNoteCreated);
      socket.off('note_rename', handleNoteRename);
      socket.off('note_deleted', handleNoteDeleted);
      socket.off('workspace_deleted', handleWorkspaceDeleted);
      socket.off('member_removed', handleMemberRemoved);
      socket.off('note_locked', handleNoteLocked);
      socket.off('note_unlocked', handleNoteUnlocked);
      socket.off('note_pinned', handleNotePinned);
      socket.off('note_unpinned', handleNoteUnpinned);
      socket.off('workspace_archived', handleWorkspaceArchived);
      socket.off('workspace_unarchived', handleWorkspaceUnarchived);
      socket.off('tag_created', handleTagCreated);
      socket.off('tag_deleted', handleTagDeleted);
      socket.off('note_tags_updated', handleNoteTagsUpdated);
    };
  }, [socket, activeNoteId, workspaceId, user]);

  // Close settings dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchWorkspaceDetails = async () => {
    setIsLoading(true);
    try {
      const [workspaceRes, tagsRes] = await Promise.all([
        api.get(`/workspaces/${workspaceId}`),
        api.get(`/workspaces/${workspaceId}/tags`)
      ]);
      const data = workspaceRes.data;
      data.tags = tagsRes.data;
      if (data.notes) {
        const uniqueNotesMap = new Map();
        data.notes.forEach((note: any) => {
          uniqueNotesMap.set(note.id, note);
        });
        data.notes = Array.from(uniqueNotesMap.values());
      }
      setWorkspace(data);
      if (data.isArchived) {
        setIsWorkspaceArchived(true);
      }
      if (data.notes && data.notes.length > 0) {
        const queryNoteExists = queryNoteId && data.notes.some((n: any) => n.id === queryNoteId);
        if (queryNoteExists) {
          setActiveNoteId(queryNoteId!);
        } else {
          // Find first note by display order
          const sortedNotes = [...data.notes].sort((a, b) => a.order - b.order);
          setActiveNoteId(sortedNotes[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load workspace details:', err);
      if (err.response?.status === 403) {
        toast.error("You don't have access to that workspace");
      } else if (err.response?.status === 404) {
        toast.error("Workspace not found");
      } else {
        toast.error("Workspace failed to load");
      }
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (queryNoteId && workspace?.notes.some(n => n.id === queryNoteId)) {
      setActiveNoteId(queryNoteId);
    }
  }, [queryNoteId, workspace]);

  const copyCode = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.code);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNoteCreate = async () => {
    try {
      const response = await api.post(`/workspaces/${workspaceId}/notes`, { title: 'Untitled Note' });
      const newNote = response.data;
      setWorkspace((prev) => {
        if (!prev) return null;
        if (prev.notes.some(n => n.id === newNote.id)) return prev;
        return {
          ...prev,
          notes: [...prev.notes, newNote].sort((a, b) => a.order - b.order),
        };
      });
      setActiveNoteId(newNote.id);
      toast.success('New note created');
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
    }
  };

  const handleNoteRenameAPI = async (noteId: string, title: string) => {
    try {
      await api.patch(`/workspaces/${workspaceId}/notes/${noteId}`, { title });
      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          notes: prev.notes.map(n => n.id === noteId ? { ...n, title } : n),
        };
      });
    } catch (error) {
      console.error('Failed to rename note:', error);
      toast.error('Failed to rename note');
    }
  };

  const handleNoteDeleteAPI = async (noteId: string) => {
    try {
      const response = await api.delete(`/workspaces/${workspaceId}/notes/${noteId}`);
      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          notes: prev.notes.filter(n => n.id !== noteId),
        };
      });
      if (activeNoteId === noteId) {
        const remaining = workspace?.notes.filter(n => n.id !== noteId) || [];
        if (remaining.length > 0) {
          setActiveNoteId(remaining[0].id);
        }
      }
      toast.success('Note deleted');
    } catch (error: any) {
      console.error('Failed to delete note:', error);
      toast.error(error.response?.data?.message || 'Failed to delete note');
    }
  };

  const handleWorkspaceDelete = async () => {
    if (deleteConfirmName !== workspace?.name) {
      toast.error('Workspace name does not match.');
      return;
    }
    setIsDeletingWorkspace(true);
    try {
      await api.delete(`/workspaces/${workspaceId}`);
      toast.success('Workspace deleted successfully');
      setWorkspaceDeleteOpen(false);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to delete workspace:', error);
      toast.error(error.response?.data?.message || 'Failed to delete workspace.');
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const handleWorkspaceLeave = async () => {
    setIsLeavingWorkspace(true);
    try {
      await api.post(`/workspaces/${workspaceId}/leave`);
      toast.success('Left workspace successfully');
      setWorkspaceLeaveOpen(false);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to leave workspace:', error);
      toast.error(error.response?.data?.message || 'Failed to leave workspace.');
    } finally {
      setIsLeavingWorkspace(false);
    }
  };

  const handleNoteCreateWithTemplate = async (template: NoteTemplate) => {
    try {
      const response = await api.post(`/workspaces/${workspaceId}/notes`, { 
        title: template.id === 'blank' ? 'Untitled Note' : template.name,
        content: template.content,
      });
      const newNote = response.data;
      setWorkspace((prev) => {
        if (!prev) return null;
        if (prev.notes.some(n => n.id === newNote.id)) return prev;
        return {
          ...prev,
          notes: [...prev.notes, newNote].sort((a, b) => a.order - b.order),
        };
      });
      setActiveNoteId(newNote.id);
      toast.success(`New note created using template: ${template.name}`);
    } catch (error) {
      console.error('Failed to create note with template:', error);
      toast.error('Failed to create note');
      throw error;
    }
  };

  const handleWorkspaceArchive = async () => {
    setIsArchivingWorkspace(true);
    try {
      await api.patch(`/workspaces/${workspaceId}/archive`);
      toast.success('Workspace archived');
      setWorkspaceArchiveOpen(false);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Failed to archive workspace:', error);
      toast.error(error.response?.data?.message || 'Failed to archive workspace');
    } finally {
      setIsArchivingWorkspace(false);
    }
  };

  const handleExportWorkspace = async () => {
    const toastId = toast.loading('Exporting workspace notes as ZIP...');
    try {
      const response = await api.get(`/workspaces/${workspaceId}/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${workspace?.name.replace(/\s+/g, '_') || 'workspace'}_notes.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Workspace export downloaded', { id: toastId });
    } catch (error) {
      console.error('Failed to export workspace:', error);
      toast.error('Failed to export workspace', { id: toastId });
    }
  };

  const handleToggleLock = async () => {
    if (!activeNoteId) return;
    const activeNote = workspace?.notes.find(n => n.id === activeNoteId);
    const isCurrentlyLocked = activeNote?.isLocked;
    try {
      if (isCurrentlyLocked) {
        await api.patch(`/workspaces/${workspaceId}/notes/${activeNoteId}/unlock`);
        toast.success('Note unlocked');
      } else {
        await api.patch(`/workspaces/${workspaceId}/notes/${activeNoteId}/lock`);
        toast.success('Note locked');
      }
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          notes: prev.notes.map(n => n.id === activeNoteId ? { ...n, isLocked: !isCurrentlyLocked } : n)
        };
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to toggle note lock');
    }
  };

  const handleTogglePin = async (noteId: string) => {
    const note = workspace?.notes.find(n => n.id === noteId);
    if (!note) return;
    try {
      if (note.isPinned) {
        await api.patch(`/workspaces/${workspaceId}/notes/${noteId}/unpin`);
        toast.success('Note unpinned');
      } else {
        await api.patch(`/workspaces/${workspaceId}/notes/${noteId}/pin`);
        toast.success('Note pinned');
      }
      setWorkspace(prev => {
        if (!prev) return null;
        return {
          ...prev,
          notes: prev.notes.map(n => n.id === noteId ? { ...n, isPinned: !note.isPinned, pinnedAt: new Date().toISOString() } : n)
        };
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to toggle pin');
    }
  };

  const handleDownloadNote = async (format: string) => {
    const editorEl = document.querySelector('.tiptap') as HTMLElement;
    if (!editorEl) {
      toast.error('No editor active or content found.');
      return;
    }
    const noteTitle = workspace?.notes.find(n => n.id === activeNoteId)?.title || 'Untitled Note';
    try {
      if (format === 'pdf') {
        const { downloadAsPDF } = await import('@/lib/download-note');
        await downloadAsPDF(editorEl, noteTitle);
        toast.success('Note downloaded as PDF');
      } else if (format === 'markdown') {
        const html = editorEl.innerHTML;
        const { downloadAsMarkdown } = await import('@/lib/download-note');
        downloadAsMarkdown(html, noteTitle);
        toast.success('Note downloaded as Markdown');
      } else if (format === 'text') {
        const text = editorEl.innerText || editorEl.textContent || '';
        const { downloadAsPlainText } = await import('@/lib/download-note');
        downloadAsPlainText(text, noteTitle);
        toast.success('Note downloaded as Plain Text');
      } else if (format === 'docx') {
        const html = editorEl.innerHTML;
        const { downloadAsDOCX } = await import('@/lib/download-note');
        await downloadAsDOCX(html, noteTitle);
        toast.success('Note downloaded as Word Document');
      }
    } catch (err) {
      console.error(err);
      toast.error('Download failed.');
    }
  };

  if (isWorkspaceDeleted) {
    return (
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="size-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="size-8 text-red-650 dark:text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Workspace Deleted</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This workspace was permanently deleted by the owner. You can no longer access its content.
            </p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 cursor-pointer border-none"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isMemberRemoved) {
    return (
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6">
          <div className="size-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto">
            <LogOut className="size-8 text-red-650 dark:text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Access Revoked</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You have been removed from this workspace by the creator.
            </p>
          </div>
          <Button 
            onClick={() => router.push('/dashboard')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 cursor-pointer border-none"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!hasLoadedInitial || !ydoc || !awareness || !workspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-8 w-1/4" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Skeleton className="h-[400px] w-full rounded-2xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-[200px] w-full rounded-2xl" />
              <Skeleton className="h-[200px] w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mergedLogs = realTimeLogs.length > 0 ? realTimeLogs : workspace.activityLogs;
  
  const currentUserColor = generateColorFromName(user?.name || 'Anonymous');
  const currentUser = {
    name: user?.name || 'Anonymous User',
    color: currentUserColor,
    avatarUrl: user?.avatarUrl || null,
  };

  const isCreator = workspace.createdBy.id === user?.id;
  const activeNoteTitle = workspace.notes.find(n => n.id === activeNoteId)?.title || 'Untitled Note';
  const activeNote = workspace.notes.find(n => n.id === activeNoteId);
  const isLockedForCurrentUser = activeNote?.isLocked && !isCreator;
  const isWorkspaceArchivedForEveryone = workspace.isArchived || isWorkspaceArchived;
  const isEditable = isConnected && !isWorkspaceArchivedForEveryone && !isLockedForCurrentUser;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar socket={socket} />

      <div className="flex-1 flex flex-row max-w-8xl w-full mx-auto items-stretch">
        
        {/* Left Notes Sidebar (Desktop) */}
        <div className="hidden lg:block shrink-0">
          <NotesSidebar
            notes={workspace.notes}
            activeNoteId={activeNoteId}
            workspaceId={workspaceId}
            isCreator={isCreator}
            onNoteSelect={setActiveNoteId}
            onNoteCreate={() => setIsTemplatePickerOpen(true)}
            onNoteRename={handleNoteRenameAPI}
            onNoteDelete={handleNoteDeleteAPI}
            tags={workspace.tags || []}
            onTagCreated={(tag) => setWorkspace(prev => {
              if (!prev) return null;
              const currentTags = prev.tags || [];
              const exists = currentTags.some(t => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase());
              if (exists) return prev;
              return { ...prev, tags: [...currentTags, tag] };
            })}
            onTagDeleted={(tagId) => setWorkspace(prev => {
              if (!prev) return null;
              return {
                ...prev,
                tags: (prev.tags || []).filter(t => t.id !== tagId),
                notes: prev.notes.map(n => ({
                  ...n,
                  tags: (n.tags || []).filter(t => t.id !== tagId)
                }))
              };
            })}
            onNoteTagsUpdated={(noteId, tags) => setWorkspace(prev => {
              if (!prev) return null;
              return {
                ...prev,
                notes: prev.notes.map(n => n.id === noteId ? { ...n, tags } : n)
              };
            })}
          />
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 md:p-8 gap-6 items-stretch min-w-0">
          
          {/* Main Editor Canvas Column */}
          <div className="flex-1 flex flex-col space-y-6 min-w-0">
            
            {/* Header section inside the workspace */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => router.push('/dashboard')}
                  className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-sm"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                
                {/* Mobile Notes Toggle Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsLeftDrawerOpen(true)}
                  className="lg:hidden border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-sm"
                  title="Show Notes Sidebar"
                >
                  <Menu className="size-4" />
                </Button>

                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight truncate max-w-[150px] sm:max-w-xs">{workspace.name}</h1>
                    <Badge 
                      variant="secondary" 
                      className={`flex items-center gap-1.5 font-semibold text-xs px-2.5 py-0.5 rounded-full ${
                        isConnected 
                           ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200/50 dark:border-green-900/30' 
                          : reconnectFailed
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/30'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30'
                      }`}
                    >
                      <span className={`size-1.5 rounded-full ${
                        isConnected 
                          ? 'bg-green-500' 
                          : reconnectFailed
                            ? 'bg-red-500'
                            : 'bg-amber-500 animate-pulse'
                      }`} />
                      <span>
                        {isConnected 
                          ? 'Connected' 
                          : reconnectFailed
                            ? 'Disconnected'
                            : 'Reconnecting...'}
                      </span>
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                    Created by {workspace.createdBy.name} on {new Date(workspace.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Badge variant="outline" className="font-mono text-sm border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 py-1 px-3">
                  Code: {workspace.code}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyCode}
                  className="border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 size-9 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Copy join code"
                >
                  {copied ? <Check className="size-4 text-green-500" /> : <Clipboard className="size-4" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMembersOpen(true)}
                  className="border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 size-9 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                  title="Workspace Members"
                >
                  <Users className="size-4" />
                </Button>

                {/* Workspace Settings/More Dropdown Menu */}
                <div className="relative" ref={settingsDropdownRef}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                    className="border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 size-9 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    title="More Workspace Actions"
                  >
                    <MoreVertical className="size-4" />
                  </Button>

                  {settingsDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                      <div className="px-4 py-1.5 border-b border-slate-100 dark:border-slate-850">
                        <p className="text-xs font-black text-slate-450 dark:text-slate-500 uppercase tracking-wider">Workspace Options</p>
                      </div>
                      
                      <div className="p-1.5 space-y-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            handleExportWorkspace();
                          }}
                          className="w-full justify-start text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <FileDown className="mr-2 size-4 text-indigo-500" />
                          <span>Export Workspace (ZIP)</span>
                        </Button>

                        {isCreator && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              setWorkspaceArchiveOpen(true);
                            }}
                            className="w-full justify-start text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Archive className="mr-2 size-4 text-amber-500" />
                            <span>Archive Workspace</span>
                          </Button>
                        )}

                        <Separator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

                        {isCreator ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              setWorkspaceDeleteOpen(true);
                            }}
                            className="w-full justify-start text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="mr-2 size-4" />
                            <span>Delete Workspace</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSettingsDropdownOpen(false);
                              setWorkspaceLeaveOpen(true);
                            }}
                            className="w-full justify-start text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                          >
                            <LogOut className="mr-2 size-4" />
                            <span>Leave Workspace</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Banners */}
            {isWorkspaceArchivedForEveryone && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <Archive className="size-4" />
                  <span>This workspace is archived. Unarchive it to make edits.</span>
                </div>
                {isCreator && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await api.patch(`/workspaces/${workspaceId}/unarchive`);
                        setWorkspace(prev => prev ? { ...prev, isArchived: false, archivedAt: null } : null);
                        setIsWorkspaceArchived(false);
                        toast.success('Workspace unarchived');
                      } catch (err) {
                        toast.error('Failed to unarchive workspace');
                      }
                    }}
                    className="h-7 px-2.5 text-[11px] font-bold border-amber-300 dark:border-amber-800 hover:bg-amber-100/50 dark:hover:bg-amber-900/40 text-amber-850 dark:text-amber-400 bg-transparent cursor-pointer"
                  >
                    Unarchive
                  </Button>
                )}
              </div>
            )}

            {activeNote?.isLocked && !isCreator && (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in duration-300">
                <span>🔒 This note is locked by {workspace.createdBy.name}. You can read but not edit.</span>
              </div>
            )}

            <RichTextEditor 
              key={`${activeNoteId}-${ydoc.guid}`}
              ydoc={ydoc}
              awareness={awareness}
              currentUser={currentUser}
              editable={isEditable}
              setSnapshotCallback={setSnapshotCallback}
              isConnected={isConnected}
              isReconnecting={isReconnecting}
              reconnectFailed={reconnectFailed}
              noteTitle={activeNoteTitle}
              isCreator={isCreator}
              isLocked={activeNote?.isLocked || false}
              onToggleLock={handleToggleLock}
            />
          </div>

          {/* Right Sidebar Columns (280px width) - Sticky on desktop, hidden on mobile */}
          <div className="hidden lg:flex w-[280px] shrink-0 flex-col gap-6 lg:h-[calc(100vh-130px)] lg:sticky lg:top-[100px]">
            {/* Online Users */}
            <div className="bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-sm">
              <OnlineUsers users={onlineUsers} currentUserId={user?.id} />
            </div>

            <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />

            {/* Activity Feed */}
            <div className="bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-sm flex-1 flex flex-col min-h-0">
              <ActivityFeed logs={mergedLogs} />
            </div>
          </div>

        </div>

      </div>

      {/* Floating Action Button (FAB) for mobile/tablet widget sidebar access */}
      <div className="fixed bottom-6 right-6 lg:hidden z-40">
        <Button
          onClick={() => setIsDrawerOpen(true)}
          className="size-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center relative cursor-pointer group transition-transform hover:scale-105 active:scale-95 border-none"
          aria-label="Toggle Online Users and Logs"
        >
          <Users className="size-6" />
          {onlineUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 size-6 rounded-full bg-green-500 text-white border-2 border-slate-50 dark:border-slate-950 flex items-center justify-center text-[10px] font-black leading-none">
              {onlineUsers.length}
            </span>
          )}
        </Button>
      </div>

      {/* Mobile/Tablet Notes Navigation Drawer */}
      {isLeftDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in" 
            onClick={() => setIsLeftDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative bg-slate-100 dark:bg-slate-900 h-full shadow-2xl flex flex-col max-w-[240px] w-full overflow-y-auto animate-in slide-in-from-left duration-300">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-950/60 bg-slate-200/20 dark:bg-slate-950/20">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-400">Navigation</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsLeftDrawerOpen(false)}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-205/50 dark:hover:bg-slate-800 text-xs px-2 h-7"
              >
                Close
              </Button>
            </div>
            <div className="flex-1">
              <NotesSidebar
                notes={workspace.notes}
                activeNoteId={activeNoteId}
                workspaceId={workspaceId}
                isCreator={isCreator}
                onNoteSelect={(id) => {
                  setActiveNoteId(id);
                  setIsLeftDrawerOpen(false);
                }}
                onNoteCreate={() => {
                  setIsTemplatePickerOpen(true);
                  setIsLeftDrawerOpen(false);
                }}
                onNoteRename={handleNoteRenameAPI}
                onNoteDelete={handleNoteDeleteAPI}
                tags={workspace.tags || []}
                onTagCreated={(tag) => setWorkspace(prev => {
                  if (!prev) return null;
                  const currentTags = prev.tags || [];
                  const exists = currentTags.some(t => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase());
                  if (exists) return prev;
                  return { ...prev, tags: [...currentTags, tag] };
                })}
                onTagDeleted={(tagId) => setWorkspace(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    tags: (prev.tags || []).filter(t => t.id !== tagId),
                    notes: prev.notes.map(n => ({
                      ...n,
                      tags: (n.tags || []).filter(t => t.id !== tagId)
                    }))
                  };
                })}
                onNoteTagsUpdated={(noteId, tags) => setWorkspace(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    notes: prev.notes.map(n => n.id === noteId ? { ...n, tags } : n)
                  };
                })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile/Tablet Slide-over Drawer overlay for Online Users & Activity Feed */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity duration-300" 
            onClick={() => setIsDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-[320px] bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Workspace info</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsDrawerOpen(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Close
              </Button>
            </div>
            
            {/* Online Users */}
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs">
              <OnlineUsers users={onlineUsers} currentUserId={user?.id} />
            </div>

            <Separator className="bg-slate-200/60 dark:bg-slate-800/60" />

            {/* Activity Feed */}
            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 shadow-xs flex-1 flex flex-col min-h-0">
              <ActivityFeed logs={mergedLogs} />
            </div>
          </div>
        </div>
      )}

      {/* Template Picker Dialog */}
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
        onCreateNote={handleNoteCreateWithTemplate}
      />

      {/* Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        notes={workspace.notes}
        activeNoteId={activeNoteId}
        onNoteSelect={setActiveNoteId}
        onCreateNote={() => setIsTemplatePickerOpen(true)}
        onSearchNotes={() => {
          // Focus search: toggle search panel on sidebar or show a helpful toast
          setIsLeftDrawerOpen(true);
          toast.info('Use search in the sidebar or command palette.');
        }}
        onCopyCode={copyCode}
        onDownloadNote={handleDownloadNote}
        onExportWorkspace={handleExportWorkspace}
        onToggleLockNote={handleToggleLock}
        isLocked={activeNote?.isLocked || false}
        isCreator={isCreator}
        onTogglePinNote={() => handleTogglePin(activeNoteId)}
        isPinned={activeNote?.isPinned || false}
        onArchiveWorkspace={() => setWorkspaceArchiveOpen(true)}
      />

      {/* Archive Workspace Dialog */}
      <Dialog open={workspaceArchiveOpen} onOpenChange={setWorkspaceArchiveOpen}>
        <DialogContent className="max-w-sm border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Archive className="size-5 text-amber-500" />
              Archive Workspace?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Archiving will hide this workspace from the active list. All notes are preserved. You can unarchive it at any time.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
            <Button
              disabled={isArchivingWorkspace}
              onClick={handleWorkspaceArchive}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {isArchivingWorkspace ? 'Archiving...' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <MembersDialog 
        workspaceId={workspaceId} 
        open={membersOpen} 
        onOpenChange={setMembersOpen}
        isCreator={isCreator}
      />

      {/* Leave Workspace Dialog */}
      <Dialog open={workspaceLeaveOpen} onOpenChange={setWorkspaceLeaveOpen}>
        <DialogContent className="max-w-sm border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Leave Workspace
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Are you sure you want to leave <span className="font-bold text-slate-850 dark:text-slate-200">&apos;{workspace.name}&apos;</span>? 
              You will no longer have access to this workspace and its notes unless you join again using the workspace code.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
            <Button
              disabled={isLeavingWorkspace}
              onClick={handleWorkspaceLeave}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {isLeavingWorkspace ? 'Leaving...' : 'Leave Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={workspaceDeleteOpen} onOpenChange={setWorkspaceDeleteOpen}>
        <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Are you absolutely sure you want to delete <span className="font-bold text-slate-850 dark:text-slate-200">&apos;{workspace.name}&apos;</span>? 
              This will permanently delete the workspace, all its notes, and revoke access for all members. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-3">
            <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
              Type <span className="font-extrabold text-slate-900 dark:text-white select-none">{workspace.name}</span> to confirm deletion:
            </label>
            <Input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Enter workspace name"
              className="bg-transparent text-sm w-full font-medium"
            />
          </div>

          <DialogFooter className="mt-4 gap-2">
            <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== workspace.name || isDeletingWorkspace}
              onClick={handleWorkspaceDelete}
              className="bg-red-600 hover:bg-red-750 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeletingWorkspace ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
