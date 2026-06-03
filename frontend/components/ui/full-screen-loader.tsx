import React from 'react';
import { Loader2, FileText } from 'lucide-react';

export const FullScreenLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-4">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
        <FileText className="size-8 animate-pulse" />
        <span className="text-2xl font-extrabold tracking-tight">CollabNotes</span>
      </div>
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm font-medium">Loading session...</span>
      </div>
    </div>
  );
};
export default FullScreenLoader;
