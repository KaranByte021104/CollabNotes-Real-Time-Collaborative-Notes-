"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Clipboard, Check, AlertTriangle } from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { Navbar } from '@/components/layout/navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useCollaboration } from '@/hooks/use-collaboration';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { OnlineUsers } from '@/components/workspace/online-users';
import { ActivityFeed } from '@/components/workspace/activity-feed';
import api from '@/lib/axios';

interface LogItem {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: {
    name?: string;
    userName?: string;
  };
}

interface WorkspaceDetail {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  note: {
    id: string;
    content: string;
  };
  activityLogs: LogItem[];
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

  // Call the real-time collaboration hook
  const { 
    ydoc,
    awareness,
    onlineUsers, 
    activityLogs: realTimeLogs, 
    isConnected, 
    setSnapshotCallback 
  } = useCollaboration(workspaceId);

  // Local State
  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch initial workspace details (metadata)
  useEffect(() => {
    fetchWorkspaceDetails();
  }, [workspaceId]);

  const fetchWorkspaceDetails = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.get(`/workspaces/${workspaceId}`);
      setWorkspace(response.data);
    } catch (err: any) {
      console.error('Failed to load workspace details:', err);
      if (err.response?.status === 403) {
        setErrorMsg('You are not authorized to view this workspace. Please join first.');
      } else {
        setErrorMsg('Workspace not found or failed to load.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.code);
    setCopied(true);
    toast.success('Join code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !ydoc || !awareness) {
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

  if (errorMsg || !workspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-6">
          <div className="size-16 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500">
            <AlertTriangle className="size-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Workspace Error</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {errorMsg || 'Failed to load workspace details.'}
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const mergedLogs = realTimeLogs.length > 0 ? realTimeLogs : workspace.activityLogs;
  
  const currentUserColor = generateColorFromName(user?.name || 'Anonymous');
  const currentUser = {
    name: user?.name || 'Anonymous User',
    color: currentUserColor,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 gap-6 items-stretch">
        
        {/* Main Editor Canvas Column */}
        <div className="flex-1 flex flex-col space-y-6">
          
          {/* Header section inside the workspace */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-slate-800/60 pb-5">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push('/dashboard')}
                className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-sm"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">{workspace.name}</h1>
                  <Badge 
                    variant="secondary" 
                    className={`flex items-center gap-1.5 font-semibold text-xs px-2.5 py-0.5 rounded-full ${
                      isConnected 
                        ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200/50 dark:border-green-900/30' 
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30'
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
                    <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                  </Badge>
                </div>
                <p className="text-xs text-slate-450 dark:text-slate-500 mt-1">
                  Created by {workspace.createdBy.name} on {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Join Code Badge */}
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          {/* Rich-Text collaborative Tiptap Editor */}
          <RichTextEditor 
            ydoc={ydoc}
            awareness={awareness}
            currentUser={currentUser}
            editable={isConnected}
            setSnapshotCallback={setSnapshotCallback}
          />
        </div>

        {/* Sidebar Columns (280px width) */}
        <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6 lg:h-[calc(100vh-130px)] lg:sticky lg:top-[100px]">
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
  );
}
