"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if available
    console.error('Unhandled client error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="space-y-6 max-w-md w-full">
        {/* Brand Logo Header */}
        <div className="flex justify-center mb-2">
          <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400">
            <FileText className="size-8" />
            <span className="text-2xl font-black tracking-tight">CollabNotes</span>
          </div>
        </div>

        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="size-16 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500">
            <AlertOctagon className="size-8" />
          </div>
        </div>

        {/* Messaging */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
            An unexpected error occurred. Try refreshing the page.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => reset()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-md px-5"
          >
            Try again
          </Button>
          <Link href="/dashboard">
            <Button
              variant="outline"
              className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold px-5"
            >
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
