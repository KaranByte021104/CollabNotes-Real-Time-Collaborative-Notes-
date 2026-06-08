import React from 'react';
import { History, UserPlus, UserMinus, FileEdit, Clock, PlusCircle, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

export interface ActivityLog {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: {
    name?: string;
    userName?: string;
    noteTitle?: string;
    removedUserName?: string;
  };
}

interface ActivityFeedProps {
  logs: ActivityLog[];
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  const getLogDetails = (log: ActivityLog) => {
    const name = log.metadata?.name || log.metadata?.userName || 'Someone';

    switch (log.eventType) {
      case 'user_joined':
        return {
          message: `${name} joined the workspace`,
          icon: <UserPlus className="size-3.5 text-green-500" />,
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-100 dark:border-green-900/20',
        };
      case 'user_left':
        return {
          message: `${name} left the workspace entirely`,
          icon: <UserMinus className="size-3.5 text-red-500" />,
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-100 dark:border-red-900/20',
        };
      case 'member_removed':
        return {
          message: `${name} removed ${log.metadata?.removedUserName || 'a member'} from the workspace`,
          icon: <UserMinus className="size-3.5 text-red-500" />,
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-100 dark:border-red-900/20',
        };
      case 'note_updated':
        return {
          message: `${name} updated the note`,
          icon: <FileEdit className="size-3.5 text-blue-500" />,
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-100 dark:border-blue-900/20',
        };
      case 'note_created':
        return {
          message: `${name} created note "${log.metadata?.noteTitle || 'Untitled Note'}"`,
          icon: <PlusCircle className="size-3.5 text-green-500" />,
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-100 dark:border-green-900/20',
        };
      case 'note_deleted':
        return {
          message: `${name} deleted note "${log.metadata?.noteTitle || 'Untitled Note'}"`,
          icon: <Trash2 className="size-3.5 text-slate-500" />,
          bgColor: 'bg-slate-50 dark:bg-slate-900/20',
          borderColor: 'border-slate-100 dark:border-slate-800/20',
        };
      default:
        return {
          message: `${name} triggered ${log.eventType.replace('_', ' ')}`,
          icon: <Clock className="size-3.5 text-slate-500" />,
          bgColor: 'bg-slate-50 dark:bg-slate-900/20',
          borderColor: 'border-slate-100 dark:border-slate-800/20',
        };
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <History className="size-4 text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Activity</h3>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-none pr-1 space-y-2.5 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">No activity yet</p>
          </div>
        ) : (
          logs.map((log) => {
            const { message, icon, bgColor, borderColor } = getLogDetails(log);

            return (
              <div 
                key={log.id} 
                className={`flex gap-3 p-2.5 rounded-xl border ${bgColor} ${borderColor} transition-all hover:bg-opacity-80`}
              >
                <div className="size-6 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm shrink-0 border border-slate-100 dark:border-slate-800">
                  {icon}
                </div>
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-normal break-words">
                    {message}
                  </p>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 block">
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
