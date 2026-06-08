"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash2, FileText, Check, X, Search, Pin, Tag, Settings, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import api from '@/lib/axios';
import { toast } from 'sonner';

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  order: number;
  isLocked?: boolean;
  lockedById?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  tags?: TagItem[];
}

interface NotesSidebarProps {
  notes: Note[];
  activeNoteId: string;
  workspaceId: string;
  isCreator: boolean;
  onNoteSelect: (noteId: string) => void;
  onNoteCreate: () => void;
  onNoteRename: (noteId: string, newTitle: string) => void;
  onNoteDelete: (noteId: string) => void;
  tags?: TagItem[];
  onTagCreated?: (tag: TagItem) => void;
  onTagDeleted?: (tagId: string) => void;
  onNoteTagsUpdated?: (noteId: string, tags: TagItem[]) => void;
}

export const NotesSidebar: React.FC<NotesSidebarProps> = ({
  notes,
  activeNoteId,
  workspaceId,
  isCreator,
  onNoteSelect,
  onNoteCreate,
  onNoteRename,
  onNoteDelete,
  tags = [],
  onTagCreated,
  onTagDeleted,
  onNoteTagsUpdated,
}) => {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tag Manager State
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [activeTagPopoverNoteId, setActiveTagPopoverNoteId] = useState<string | null>(null);

  // Collapsible sections
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(true);
  const [selectedFilterTagId, setSelectedFilterTagId] = useState<string | null>(null);

  const PRESET_COLORS = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#eab308', // Yellow
    '#f97316', // Orange
    '#ef4444', // Red
    '#ec4899', // Pink
    '#a855f7', // Purple
  ];

  useEffect(() => {
    if (editingNoteId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingNoteId]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Debounced Search API Call
  useEffect(() => {
    if (!isSearchOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(`/workspaces/${workspaceId}/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.data);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, isSearchOpen, workspaceId]);

  // Handle Escape Key Global listener for Search Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startRename = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setTempTitle(note.title);
  };

  const handleKeyDown = (e: React.KeyboardEvent, noteId: string) => {
    if (e.key === 'Enter') {
      submitRename(noteId);
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  const submitRename = (noteId: string) => {
    if (tempTitle.trim() && tempTitle.trim() !== notes.find(n => n.id === noteId)?.title) {
      onNoteRename(noteId, tempTitle.trim());
    }
    setEditingNoteId(null);
  };

  const cancelRename = () => {
    setEditingNoteId(null);
  };

  const openDeleteConfirm = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    if (notes.length <= 1) return;
    setNoteToDelete(note);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (noteToDelete) {
      onNoteDelete(noteToDelete.id);
      setDeleteConfirmOpen(false);
      setNoteToDelete(null);
    }
  };

  // Tag creation / deletion / note assignment
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setIsCreatingTag(true);
    try {
      const response = await api.post(`/workspaces/${workspaceId}/tags`, {
        name: newTagName.trim(),
        color: newTagColor,
      });
      if (onTagCreated) {
        onTagCreated(response.data);
      }
      setNewTagName('');
      toast.success('Tag created');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to create tag');
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await api.delete(`/workspaces/${workspaceId}/tags/${tagId}`);
      if (onTagDeleted) {
        onTagDeleted(tagId);
      }
      if (selectedFilterTagId === tagId) {
        setSelectedFilterTagId(null);
      }
      toast.success('Tag deleted');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete tag');
    }
  };

  const handleToggleTagOnNote = async (note: Note, tag: TagItem) => {
    const isApplied = note.tags?.some(t => t.id === tag.id);
    try {
      if (isApplied) {
        await api.delete(`/workspaces/${workspaceId}/notes/${note.id}/tags/${tag.id}`);
        const updatedTags = (note.tags || []).filter(t => t.id !== tag.id);
        if (onNoteTagsUpdated) onNoteTagsUpdated(note.id, updatedTags);
      } else {
        await api.post(`/workspaces/${workspaceId}/notes/${note.id}/tags/${tag.id}`);
        const updatedTags = [...(note.tags || []), tag];
        if (onNoteTagsUpdated) onNoteTagsUpdated(note.id, updatedTags);
      }
    } catch (err) {
      console.error('Failed to toggle tag:', err);
      toast.error('Failed to update note tag');
    }
  };

  const handleTogglePinNote = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (note.isPinned) {
        await api.patch(`/workspaces/${workspaceId}/notes/${note.id}/unpin`);
        toast.success('Note unpinned');
      } else {
        await api.patch(`/workspaces/${workspaceId}/notes/${note.id}/pin`);
        toast.success('Note pinned');
      }
    } catch (err) {
      console.error('Pin toggle failed:', err);
      toast.error('Failed to toggle pin');
    }
  };

  // Filter notes by selected tag
  const filteredNotes = selectedFilterTagId
    ? notes.filter(n => n.tags?.some(t => t.id === selectedFilterTagId))
    : notes;

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const regularNotes = filteredNotes.filter(n => !n.isPinned);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) 
            ? <mark key={i} className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-extrabold px-0.5 rounded">{part}</mark>
            : part
        )}
      </span>
    );
  };

  return (
    <TooltipProvider delay={200}>
      <aside className="w-[240px] bg-slate-50/90 dark:bg-slate-900/95 border-r border-slate-200 dark:border-slate-950 flex flex-col h-full text-slate-800 dark:text-slate-100 select-none shrink-0 sticky top-0">
        
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-950/60 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest">Workspace</p>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 tracking-tight flex items-center gap-1.5">
              <FileText className="size-4 text-indigo-500 dark:text-indigo-400" />
              Notes
            </h2>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-2 border-b border-slate-200/50 dark:border-slate-950/20 flex gap-1.5 shrink-0">
          <Button
            onClick={onNoteCreate}
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 font-bold cursor-pointer h-9 px-3 gap-2 border border-transparent text-xs"
          >
            <Plus className="size-4 text-indigo-500 dark:text-indigo-400" />
            <span>New Note</span>
          </Button>
          <Button
            onClick={() => {
              setIsSearchOpen(true);
              setSearchQuery('');
              setSearchResults([]);
            }}
            variant="ghost"
            size="icon"
            className="size-9 border border-slate-200/50 dark:border-slate-800/80 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            title="Search notes"
          >
            <Search className="size-4" />
          </Button>
        </div>

        {/* Tags Section */}
        <div className="p-3 border-b border-slate-200/50 dark:border-slate-950/20 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            <button 
              onClick={() => setIsTagsSectionOpen(!isTagsSectionOpen)}
              className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white cursor-pointer focus:outline-none"
            >
              {isTagsSectionOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <span>Tags</span>
            </button>
            <button
              onClick={() => setIsTagManagerOpen(true)}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Manage tags"
            >
              <Settings className="size-3.5" />
            </button>
          </div>
          
          {isTagsSectionOpen && (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
              {tags.map((tag) => {
                const isSelected = selectedFilterTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedFilterTagId(isSelected ? null : tag.id)}
                    style={{ 
                      backgroundColor: isSelected ? tag.color : `${tag.color}15`,
                      color: isSelected ? '#ffffff' : tag.color,
                      borderColor: tag.color
                    }}
                    className="text-[10px] font-black px-2 py-0.5 rounded-full border transition-all cursor-pointer truncate max-w-[90px]"
                    title={`Filter by tag: ${tag.name}`}
                  >
                    {tag.name}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 lowercase italic">No tags created yet</span>
              )}
            </div>
          )}
        </div>

        {/* Search Mode Panel */}
        {isSearchOpen ? (
          <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 animate-in fade-in duration-150">
            <div className="p-2 border-b border-slate-250/60 dark:border-slate-850/60 flex items-center gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="size-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="text-xs px-2 h-8 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-500"
              >
                Cancel
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isSearching ? (
                <div className="space-y-2.5 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-1.5 animate-pulse">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                      <div className="h-3 bg-slate-150 dark:bg-slate-850 rounded w-full" />
                    </div>
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      onClick={() => {
                        onNoteSelect(result.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                        setSearchResults([]);
                      }}
                      className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850/60 cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-800/80"
                    >
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {highlightText(result.title || 'Untitled Note', searchQuery)}
                      </h4>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {highlightText(result.snippet || '', searchQuery)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="text-center p-6 space-y-2">
                  <Search className="size-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No notes match your search</p>
                </div>
              ) : (
                <div className="text-center p-6 text-xs text-slate-400 dark:text-slate-500 italic">
                  Type at least 2 characters to search
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Notes List Mode */
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            
            {/* Pinned Section */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-1.5">
                  <Pin className="size-3 text-indigo-500" />
                  <span>Pinned</span>
                </div>
                {pinnedNotes.map((note) => renderNoteRow(note, true))}
                <div className="pt-2 px-1">
                  <div className="h-[1px] bg-slate-200/60 dark:bg-slate-800/50 w-full" />
                </div>
              </div>
            )}

            {/* Regular Notes Section */}
            <div className="space-y-1">
              {pinnedNotes.length > 0 && regularNotes.length > 0 && (
                <div className="text-[10px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-1.5">
                  <span>All Notes</span>
                </div>
              )}
              {regularNotes.map((note) => renderNoteRow(note, false))}
              {filteredNotes.length === 0 && (
                <div className="text-center p-6 text-xs text-slate-400 dark:text-slate-500 italic">
                  {selectedFilterTagId ? 'No notes with this tag' : 'No notes found'}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Delete Note?</DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Are you sure you want to delete &apos;{noteToDelete?.title || 'this note'}&apos;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
              >
                Delete Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tag Manager Dialog */}
        <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
          <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Manage Tags</DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Create and delete workspace-wide tags.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {/* Existing Tags List */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{tag.name}</span>
                    </div>
                    {isCreator && (
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete tag"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {tags.length === 0 && (
                  <div className="text-center p-4 text-xs text-slate-400 dark:text-slate-500 italic">No tags created yet.</div>
                )}
              </div>

              {/* Create Tag Form */}
              <form onSubmit={handleCreateTag} className="border-t border-slate-150 dark:border-slate-800/60 pt-4 space-y-3">
                <div className="text-xs font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Create New Tag</div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Tag name (max 30 chars)"
                    maxLength={30}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1 bg-transparent text-xs"
                  />
                  <Button 
                    type="submit" 
                    disabled={isCreatingTag || !newTagName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 cursor-pointer"
                  >
                    {isCreatingTag ? <Loader2 className="size-3.5 animate-spin" /> : 'Create'}
                  </Button>
                </div>
                
                {/* Color Swatch Selector */}
                <div className="flex items-center gap-1.5 pt-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTagColor(color)}
                      className={`size-6 rounded-full border-2 transition-transform cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center`}
                      style={{ 
                        backgroundColor: color,
                        borderColor: newTagColor === color ? '#ffffff' : 'transparent',
                        boxShadow: newTagColor === color ? `0 0 0 1.5px ${color}` : 'none'
                      }}
                      title={color}
                    >
                      {newTagColor === color && <Check className="size-3 text-white" />}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            <DialogFooter className="pt-2 border-t border-slate-150 dark:border-slate-800/60">
              <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Close</Button>} />
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </aside>
    </TooltipProvider>
  );

  function renderNoteRow(note: Note, isPinnedSection: boolean) {
    const isActive = note.id === activeNoteId;
    const isEditing = note.id === editingNoteId;
    const showTagPopover = activeTagPopoverNoteId === note.id;

    return (
      <div
        key={note.id}
        onClick={() => !isEditing && onNoteSelect(note.id)}
        className={`group relative flex flex-col justify-center rounded-lg px-2.5 py-2 text-sm font-semibold transition-all cursor-pointer border-l-2 ${
          isActive
            ? 'bg-white dark:bg-slate-800 text-indigo-750 dark:text-white border-indigo-600 dark:border-indigo-500 shadow-xs'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/40 dark:hover:bg-slate-800/40 border-transparent'
        } ${showTagPopover ? 'z-30' : 'z-0'}`}
      >
        <div className="flex items-center justify-between w-full">
          {isEditing ? (
            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, note.id)}
                onBlur={() => submitRename(note.id)}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded px-1.5 py-0.5 text-xs focus:outline-none w-full font-medium"
              />
            </div>
          ) : (
            <>
              <span className="truncate pr-16 w-full block">
                {note.isLocked && <span className="mr-1 text-xs">🔒</span>}
                {note.title || 'Untitled Note'}
              </span>
              
              {/* Note Row Hover Actions */}
              <div 
                className={`absolute right-1.5 top-1/2 -translate-y-1/2 items-center gap-0.5 ${
                  showTagPopover ? 'flex' : 'hidden group-hover:flex'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Pin Button */}
                <button
                  onClick={(e) => handleTogglePinNote(note, e)}
                  className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none ${
                    note.isPinned 
                      ? 'text-indigo-600 dark:text-indigo-400' 
                      : 'text-slate-450 hover:text-slate-700 dark:hover:text-white'
                  }`}
                  title={note.isPinned ? "Unpin note" : "Pin note"}
                >
                  <Pin className={`size-3 ${note.isPinned ? 'fill-indigo-600 dark:fill-indigo-400' : ''}`} />
                </button>

                {/* Tag Popover Button */}
                <div className="relative">
                  <button
                    onClick={() => setActiveTagPopoverNoteId(showTagPopover ? null : note.id)}
                    className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none"
                    title="Apply tags"
                  >
                    <Tag className="size-3" />
                  </button>
                  
                  {/* Small popover menu for tags */}
                  {showTagPopover && (
                    <>
                      {/* Invisible backdrop to capture click-outside */}
                      <div 
                        className="fixed inset-0 z-40 bg-transparent cursor-default" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTagPopoverNoteId(null);
                        }}
                      />
                      <div 
                        className="absolute right-0 top-6 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 shadow-xl w-48 text-xs font-medium space-y-2 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[9px] pb-1 border-b border-slate-100 dark:border-slate-800">Assign Tags</div>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {tags.map((tag) => {
                            const isApplied = note.tags?.some(t => t.id === tag.id);
                            return (
                              <label key={tag.id} className="flex items-center gap-2 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!isApplied}
                                  onChange={() => handleToggleTagOnNote(note, tag)}
                                  className="rounded text-indigo-600 focus:ring-indigo-500 size-3 cursor-pointer"
                                />
                                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                <span className="truncate text-slate-700 dark:text-slate-300">{tag.name}</span>
                              </label>
                            );
                          })}
                          {tags.length === 0 && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic p-1">No tags created yet.</div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setActiveTagPopoverNoteId(null);
                            setIsTagManagerOpen(true);
                          }}
                          className="w-full text-left font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-850 dark:hover:text-indigo-300 pt-1 text-[10px] border-t border-slate-100 dark:border-slate-800"
                        >
                          + Create new tag
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Edit Button */}
                <button
                  onClick={(e) => startRename(note, e)}
                  className="p-1 rounded text-slate-455 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none"
                  title="Rename note"
                >
                  <Pencil className="size-3" />
                </button>

                {/* Delete Button */}
                {notes.length <= 1 ? (
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="p-1 rounded text-slate-300 dark:text-slate-700 cursor-not-allowed">
                        <Trash2 className="size-3" />
                      </span>
                    } />
                    <TooltipContent side="right" className="bg-slate-950 text-white border border-slate-800">
                      <span>Cannot delete the last note</span>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={(e) => openDeleteConfirm(note, e)}
                    className="p-1 rounded text-slate-455 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none"
                    title="Delete note"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Applied Tag Dots Below Title */}
        {note.tags && note.tags.length > 0 && !isEditing && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {note.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                style={{ backgroundColor: tag.color }}
                className="size-1.5 rounded-full shrink-0"
                title={tag.name}
              />
            ))}
            {note.tags.length > 3 && (
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-none">
                +{note.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
};
