"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, Info, Lock, Unlock, Pin, Tag, Archive, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/axios';
import { toast } from 'sonner';

interface Notification {
  id: string;
  userId: string;
  workspaceId: string | null;
  noteId: string | null;
  eventType: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  workspace: {
    id: string;
    name: string;
  } | null;
}

interface NotificationBellProps {
  socket?: any;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ socket }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch of unread count
    fetchUnreadCount();

    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  // Socket listener for new notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { notification: Notification }) => {
      setUnreadCount(prev => prev + 1);
      setShouldAnimate(true);
      setTimeout(() => setShouldAnimate(false), 1000);

      // Prepend to list if panel is currently open
      setNotifications(prev => [data.notification, ...prev].slice(0, 50));
      toast.info(data.notification.message, {
        description: data.notification.workspace?.name || '',
        action: data.notification.workspaceId ? {
          label: 'View',
          onClick: () => {
            router.push(`/workspace/${data.notification.workspaceId}`);
          }
        } : undefined
      });
    };

    socket.on('new_notification', handleNewNotification);
    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, router]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.count);
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.isRead) {
      navigateToTarget(notification);
      return;
    }

    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      navigateToTarget(notification);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error(err);
      toast.error('Failed to mark all as read');
    }
  };

  const navigateToTarget = (notification: Notification) => {
    setOpen(false);
    if (notification.workspaceId) {
      // If we are already on this workspace page, switching active note could be handled by a query parameter or localStorage.
      // But simple router.push is standard.
      router.push(`/workspace/${notification.workspaceId}?noteId=${notification.noteId || ''}`);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'note_locked':
        return <Lock className="size-4 text-amber-500" />;
      case 'note_unlocked':
        return <Unlock className="size-4 text-green-500" />;
      case 'note_pinned':
        return <Pin className="size-4 text-indigo-500" />;
      case 'tag_added':
        return <Tag className="size-4 text-blue-500" />;
      case 'workspace_archived':
        return <Archive className="size-4 text-amber-500" />;
      default:
        return <Info className="size-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`size-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors relative cursor-pointer focus:outline-none ${
          shouldAnimate ? 'animate-bounce' : ''
        } ${unreadCount > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-450 dark:text-slate-500'}`}
        title="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-5 bg-red-600 text-white border-2 border-slate-50 dark:border-slate-950 rounded-full flex items-center justify-center text-[9px] font-black leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <span className="text-sm font-black text-slate-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0 py-1">
            {isLoading ? (
              <div className="flex items-center justify-center p-12 text-slate-400">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span className="text-xs font-semibold">Loading notifications...</span>
              </div>
            ) : notifications.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleMarkAsRead(notification)}
                    className={`flex gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-850/50 cursor-pointer transition-colors text-left relative ${
                      !notification.isRead 
                        ? 'border-l-[3px] border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/10' 
                        : 'border-l-[3px] border-transparent'
                    }`}
                  >
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 h-8 flex items-center justify-center">
                      {getEventIcon(notification.eventType)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold leading-relaxed line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.workspace && (
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold truncate">
                          {notification.workspace.name}
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 dark:text-slate-550 shrink-0 font-bold ml-1.5 self-start">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-12 space-y-3">
                <Check className="size-8 text-green-500 mx-auto bg-green-50 dark:bg-green-950/20 rounded-full p-1.5" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">You&apos;re all caught up!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
