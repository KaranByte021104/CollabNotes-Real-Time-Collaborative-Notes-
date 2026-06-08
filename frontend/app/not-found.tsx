"use client";

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="space-y-6 max-w-md w-full">
        {/* Brand/Logo Header */}
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
            <FileText className="size-8" />
            <span className="text-2xl font-black tracking-tight">CollabNotes</span>
          </div>
        </div>

        {/* Large Muted 404 */}
        <div className="text-8xl font-black text-slate-200 dark:text-slate-800 tracking-widest select-none">
          404
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Page not found</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        {/* Redirect CTA */}
        <div className="pt-2">
          <Link href="/dashboard">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md px-6 py-2 rounded-xl border-none">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
