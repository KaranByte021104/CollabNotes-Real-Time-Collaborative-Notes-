import React from 'react';

export interface OnlineUser {
  userId: string;
  name: string;
  socketId: string;
  color: string;
  avatarUrl?: string | null;
}

interface OnlineUsersProps {
  users: OnlineUser[];
  currentUserId?: string;
}

export function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
  const maxDisplay = 8;
  const displayedUsers = users.slice(0, maxDisplay);
  const extraCount = users.length - maxDisplay;

  const getBackendUrl = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    return apiUrl.replace(/\/api$/, '');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex size-2.5 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full size-2.5 bg-green-500"></span>
        </div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Online Now</h3>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
          {users.length}
        </span>
      </div>

      <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
        {users.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No active members</p>
        ) : (
          displayedUsers.map((user) => {
            const isMe = user.userId === currentUserId;
            const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';

            return (
              <div key={`${user.userId}-${user.socketId}`} className="flex items-center gap-3 group">
                <div className="relative shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={`${getBackendUrl()}${user.avatarUrl}`}
                      alt={user.name}
                      className="size-9 rounded-full object-cover shadow-inner transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div 
                      className="size-9 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-inner transition-transform group-hover:scale-105"
                      style={{ backgroundColor: user.color || '#6366f1' }}
                    >
                      {initials}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></span>
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[170px]">
                  {user.name} {isMe && <span className="text-slate-400 dark:text-slate-500 font-normal ml-0.5">(you)</span>}
                </span>
              </div>
            );
          })
        )}

        {extraCount > 0 && (
          <div className="flex items-center gap-3 pl-1.5">
            <div className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-450 flex items-center justify-center">
              +{extraCount}
            </div>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              more members active
            </span>
          </div>
        )}
      </div>

      {users.length <= 1 && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed pt-1.5 border-t border-slate-100 dark:border-slate-850/50">
          💡 Share your workspace code with team members to collaborate in real-time.
        </p>
      )}
    </div>
  );
}
