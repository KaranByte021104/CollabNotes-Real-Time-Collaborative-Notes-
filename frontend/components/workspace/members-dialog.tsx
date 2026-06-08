"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, Trash2, AlertTriangle } from 'lucide-react';
import api from '@/lib/axios';

interface Member {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  isCreator: boolean;
}

interface MembersDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreator: boolean;
}

export const MembersDialog: React.FC<MembersDialogProps> = ({
  workspaceId,
  open,
  onOpenChange,
  isCreator,
}) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (open && workspaceId) {
      fetchMembers();
    }
  }, [open, workspaceId]);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/workspaces/${workspaceId}/members`);
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      toast.error('Failed to load workspace members.');
    } finally {
      setIsLoading(false);
    }
  };

  const openRemoveConfirm = (member: Member) => {
    setMemberToRemove(member);
    setRemoveConfirmOpen(true);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    try {
      await api.delete(`/workspaces/${workspaceId}/members/${memberToRemove.userId}`);
      
      // Optimistic update: filter out from state
      setMembers((prev) => prev.filter((m) => m.userId !== memberToRemove.userId));
      toast.success(`${memberToRemove.name} has been removed from the workspace`);
      setRemoveConfirmOpen(false);
      setMemberToRemove(null);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      toast.error(error.response?.data?.message || 'Failed to remove member.');
    } finally {
      setIsRemoving(false);
    }
  };

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500',
      'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
      'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
      'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Workspace Members</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {!isLoading && `${members.length} ${members.length === 1 ? 'member' : 'members'} active in this space.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-3 max-h-[300px] overflow-y-auto pr-1">
            {isLoading ? (
              // Skeleton Loading Rows
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-16 rounded-md" />
                </div>
              ))
            ) : (
              members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-850 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-full ${getAvatarColor(member.name)} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{member.name}</span>
                        {member.isCreator && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200/40">
                            <Shield className="size-2.5" />
                            Creator
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block truncate max-w-[200px]">{member.email}</span>
                    </div>
                  </div>

                  {isCreator && !member.isCreator && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openRemoveConfirm(member)}
                      className="text-red-500 hover:text-red-650 hover:bg-red-55 dark:hover:bg-red-955/20 text-xs font-semibold px-2.5 cursor-pointer h-7 border border-transparent"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Close</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested Remove Member Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent className="max-w-sm border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-[60]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Remove {memberToRemove?.name}?
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 mt-2">
              {memberToRemove?.name} will lose access to this workspace and all its notes. They can rejoin using the workspace code.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              disabled={isRemoving}
              onClick={() => setRemoveConfirmOpen(false)}
              className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isRemoving}
              onClick={confirmRemoveMember}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
            >
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
