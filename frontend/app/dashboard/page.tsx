"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  FolderPlus, 
  LogIn, 
  LogOut,
  Clipboard, 
  Check, 
  ArrowRight, 
  FileText, 
  Search, 
  Sparkles, 
  Loader2,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Archive
} from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import api from '@/lib/axios';

interface WorkspaceItem {
  id: string;
  name: string;
  code: string;
  joinedAt: string;
  isCreator?: boolean;
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // State
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [archivedWorkspaces, setArchivedWorkspaces] = useState<WorkspaceItem[]>([]);
  const [archivedExpanded, setArchivedExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog open triggers
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Form State - Create
  const [createName, setCreateName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Form State - Join
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Deletion State
  const [selectedWorkspaceForDelete, setSelectedWorkspaceForDelete] = useState<WorkspaceItem | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Leave State
  const [selectedWorkspaceForLeave, setSelectedWorkspaceForLeave] = useState<WorkspaceItem | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  // Clipboard Copied indicators
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch workspaces on mount
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await api.get('/workspaces');
      setWorkspaces(response.data);
      const archivedResponse = await api.get('/workspaces?archived=true');
      setArchivedWorkspaces(archivedResponse.data);
    } catch (err: any) {
      console.error('Failed to load workspaces:', err);
      setFetchError('Failed to load workspaces. Please refresh and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnarchiveWorkspace = async (workspaceId: string) => {
    try {
      await api.patch(`/workspaces/${workspaceId}/unarchive`);
      toast.success('Workspace unarchived!');
      fetchWorkspaces();
    } catch (err) {
      console.error(err);
      toast.error('Failed to unarchive workspace');
    }
  };

  // Handlers
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setCreateLoading(true);
    setCreateError(null);
    try {
      const response = await api.post('/workspaces', { name: createName });
      toast.success('Workspace created!');
      setCreateOpen(false);
      setCreateName('');
      router.push(`/workspace/${response.data.id}`);
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setCreateError(err.response?.data?.message || 'Failed to create workspace.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError('Workspace code is required');
      return;
    }

    setJoinLoading(true);
    setJoinError(null);
    try {
      const response = await api.post('/workspaces/join', { code: joinCode });
      toast.success('Joined workspace!');
      setJoinOpen(false);
      setJoinCode('');
      router.push(`/workspace/${response.data.id}`);
    } catch (err: any) {
      console.error('Failed to join workspace:', err);
      setJoinError(err.response?.data?.message || 'No workspace found with that code. Please check and try again.');
    } finally {
      setJoinLoading(false);
    }
  };

  const openDeleteConfirm = (ws: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkspaceForDelete(ws);
    setDeleteConfirmName('');
    setDeleteOpen(true);
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspaceForDelete) return;
    if (deleteConfirmName !== selectedWorkspaceForDelete.name) {
      toast.error('Workspace name does not match.');
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(`/workspaces/${selectedWorkspaceForDelete.id}`);
      toast.success('Workspace deleted successfully');
      setDeleteOpen(false);
      setWorkspaces(prev => prev.filter(w => w.id !== selectedWorkspaceForDelete.id));
      setSelectedWorkspaceForDelete(null);
    } catch (err: any) {
      console.error('Failed to delete workspace:', err);
      toast.error(err.response?.data?.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openLeaveConfirm = (ws: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWorkspaceForLeave(ws);
    setLeaveOpen(true);
  };

  const handleLeaveWorkspace = async () => {
    if (!selectedWorkspaceForLeave) return;
    setIsLeaving(true);
    try {
      await api.post(`/workspaces/${selectedWorkspaceForLeave.id}/leave`);
      toast.success('Left workspace successfully');
      setLeaveOpen(false);
      setWorkspaces(prev => prev.filter(w => w.id !== selectedWorkspaceForLeave.id));
      setSelectedWorkspaceForLeave(null);
    } catch (err: any) {
      console.error('Failed to leave workspace:', err);
      toast.error(err.response?.data?.message || 'Failed to leave workspace.');
    } finally {
      setIsLeaving(false);
    }
  };

  // Clear join errors when dialog is toggled
  useEffect(() => {
    if (!joinOpen) {
      setJoinError(null);
    }
  }, [joinOpen]);

  const copyToClipboard = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Code copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        
        {/* Welcome Section */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome back, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">{user?.name || 'User'}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">
            Select a workspace to start collaborating or create a new one to invite your team.
          </p>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Create Workspace */}
          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="space-y-2">
              <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-2">
                <FolderPlus className="size-6" />
              </div>
              <CardTitle className="text-xl font-bold">Create Workspace</CardTitle>
              <CardDescription>
                Start a new collaborative space for your team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => setCreateOpen(true)}
                className="w-full font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/10 transition-colors"
              >
                Create New
              </Button>
            </CardContent>
          </Card>

          {/* Join Workspace */}
          <Card className="border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="space-y-2">
              <div className="size-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-2">
                <LogIn className="size-6" />
              </div>
              <CardTitle className="text-xl font-bold">Join Workspace</CardTitle>
              <CardDescription>
                Enter a workspace code to join an existing space
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline"
                onClick={() => setJoinOpen(true)}
                className="w-full font-semibold border-slate-200 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
              >
                Join with Code
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Workspaces List Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Workspaces</h2>
            {!isLoading && !fetchError && workspaces.length > 0 && (
              <Badge variant="secondary" className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full">
                {workspaces.length} {workspaces.length === 1 ? 'workspace' : 'workspaces'}
              </Badge>
            )}
          </div>

          {fetchError && (
            <div className="text-center py-10 bg-red-55 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
              {fetchError}
            </div>
          )}

          {/* List Loader */}
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 gap-4">
                  <div className="space-y-2 flex-1 w-full">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !fetchError && workspaces.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm max-w-2xl mx-auto space-y-6">
              <div className="size-16 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-600">
                <Search className="size-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">No workspaces yet</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
                  Create a new workspace or join an existing one using a code to start collaborating with your team.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center pt-2">
                <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                  Create Workspace
                </Button>
                <Button onClick={() => setJoinOpen(true)} variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-950 font-semibold">
                  Join Workspace
                </Button>
              </div>
            </div>
          )}

          {/* Workspace cards */}
          {!isLoading && !fetchError && workspaces.length > 0 && (
            <div className="space-y-4">
              {workspaces.map((ws) => (
                <div 
                  key={ws.id} 
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                      {ws.name}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                      <span className="text-xs">
                        {getRelativeTime(ws.joinedAt)}
                      </span>
                      <span className="text-slate-300 dark:text-slate-800">•</span>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="font-mono text-xs text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/20 py-0.5 px-2">
                          {ws.code}
                        </Badge>
                        <button
                          onClick={() => copyToClipboard(ws.id, ws.code)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                          title="Copy join code"
                        >
                          {copiedId === ws.id ? (
                            <Check className="size-3.5 text-green-500" />
                          ) : (
                            <Clipboard className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-auto flex items-center justify-end gap-2">
                    {ws.isCreator ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => openDeleteConfirm(ws, e)}
                        className="border border-red-200 dark:border-red-900/50 text-red-500 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 size-9 flex items-center justify-center cursor-pointer"
                        title="Delete Workspace"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => openLeaveConfirm(ws, e)}
                        className="border border-amber-200 dark:border-amber-900/50 text-amber-500 hover:text-amber-650 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 size-9 flex items-center justify-center cursor-pointer"
                        title="Leave Workspace"
                      >
                        <LogOut className="size-4" />
                      </Button>
                    )}
                    <Button 
                      onClick={() => router.push(`/workspace/${ws.id}`)}
                      className="w-full md:w-auto bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 text-white font-semibold flex items-center justify-center gap-2 group shadow-sm cursor-pointer"
                    >
                      <span>Enter Workspace</span>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Collapsible Archived Workspaces Section */}
        <div className="space-y-4 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setArchivedExpanded(!archivedExpanded)}
              className="flex items-center gap-2 text-xl font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none"
            >
              {archivedExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
              <span>Archived Workspaces</span>
              <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold px-2 py-0.5 rounded-full ml-1">
                {archivedWorkspaces.length}
              </Badge>
            </button>
          </div>

          {archivedExpanded && (
            <div className="space-y-4 pt-2">
              {archivedWorkspaces.map((ws) => (
                <div 
                  key={ws.id} 
                  className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-slate-150/15 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 gap-4 opacity-75 hover:opacity-100 transition-opacity"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-655 dark:text-slate-400 line-through truncate">
                      {ws.name}
                    </h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Archived workspace
                    </p>
                  </div>

                  <div className="w-full md:w-auto flex items-center justify-end gap-2">
                    {ws.isCreator && (
                      <Button
                        onClick={() => handleUnarchiveWorkspace(ws.id)}
                        variant="outline"
                        size="sm"
                        className="font-semibold border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 h-9 px-3 cursor-pointer"
                      >
                        Unarchive
                      </Button>
                    )}
                    <Button 
                      onClick={() => router.push(`/workspace/${ws.id}`)}
                      size="sm"
                      className="font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 h-9 px-4 cursor-pointer"
                    >
                      View Notes
                    </Button>
                  </div>
                </div>
              ))}
              {archivedWorkspaces.length === 0 && (
                <p className="text-sm text-slate-455 dark:text-slate-500 italic pl-1">No archived workspaces.</p>
              )}
            </div>
          )}
        </div>

      </main>

      {/* Dialog: Create Workspace */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Create a New Workspace</DialogTitle>
            <DialogDescription>
              Start a new workspace to collaborate on notes with your team.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateWorkspace} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Workspace Name</Label>
              <Input
                id="create-name"
                type="text"
                placeholder="e.g. Design Team, Sprint Planning..."
                value={createName}
                maxLength={60}
                onChange={(e) => setCreateName(e.target.value)}
                className="border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 text-sm"
                required
              />
              <div className="flex justify-between items-center text-xs text-slate-450">
                <span>{createName.length} / 60 characters</span>
                {createName.length >= 60 && <span className="text-red-550 font-medium">Limit reached</span>}
              </div>
            </div>

            {createError && (
              <p className="text-sm font-semibold text-red-500 bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30">
                {createError}
              </p>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setCreateOpen(false)}
                className="border border-transparent hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLoading || !createName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
              >
                {createLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Workspace'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Join Workspace */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Join a Workspace</DialogTitle>
            <DialogDescription>
              Ask the workspace creator for their join code.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleJoinWorkspace} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="join-code">Workspace Code</Label>
              <Input
                id="join-code"
                type="text"
                placeholder="e.g. ocean-lamp-74"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toLowerCase());
                  if (joinError) setJoinError(null);
                }}
                className={`border-slate-200 dark:border-slate-800 focus-visible:ring-indigo-500 font-mono text-sm ${
                  joinError ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
              />
              {joinError && (
                <p className="text-xs font-semibold text-red-500 mt-1 animate-in fade-in duration-200">
                  {joinError}
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setJoinOpen(false)}
                className="border border-transparent hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={joinLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
              >
                {joinLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Workspace'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete Workspace
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Are you absolutely sure you want to delete <span className="font-bold text-slate-850 dark:text-slate-200">&apos;{selectedWorkspaceForDelete?.name}&apos;</span>? 
              This will permanently delete the workspace, all its notes, and revoke access for all members. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 my-3">
            <label className="text-xs font-bold text-slate-550 dark:text-slate-400">
              Type <span className="font-extrabold text-slate-900 dark:text-white select-none">{selectedWorkspaceForDelete?.name}</span> to confirm deletion:
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
              disabled={deleteConfirmName !== selectedWorkspaceForDelete?.name || isDeleting}
              onClick={handleDeleteWorkspace}
              className="bg-red-600 hover:bg-red-750 text-white font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Workspace Dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="max-w-sm border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Leave Workspace
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              Are you sure you want to leave <span className="font-bold text-slate-850 dark:text-slate-200">&apos;{selectedWorkspaceForLeave?.name}&apos;</span>? 
              You will no longer have access to this workspace and its notes unless you join again using the workspace code.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
            <Button
              disabled={isLeaving}
              onClick={handleLeaveWorkspace}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {isLeaving ? 'Leaving...' : 'Leave Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
