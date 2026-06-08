"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NOTE_TEMPLATES, NoteTemplate } from '@/lib/note-templates';
import * as Icons from 'lucide-react';

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateNote: (template: NoteTemplate) => Promise<void>;
}

export const TemplatePickerDialog: React.FC<TemplatePickerDialogProps> = ({
  open,
  onOpenChange,
  onCreateNote,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleSelect = async (template: NoteTemplate) => {
    setSelectedTemplateId(template.id);
    setIsCreating(true);
    try {
      await onCreateNote(template);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreating(false);
      setSelectedTemplateId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Create New Note</DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            Choose a template to kickstart your new note.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {NOTE_TEMPLATES.map((template) => {
            // Dynamically resolve Lucide Icon
            const IconComponent = (Icons as any)[template.iconName] || Icons.FileText;
            const isSelected = selectedTemplateId === template.id;
            const isBlank = template.id === 'blank';

            return (
              <button
                key={template.id}
                disabled={isCreating}
                onClick={() => handleSelect(template)}
                className={`flex flex-col items-start text-left p-4 rounded-xl transition-all border cursor-pointer select-none group relative ${
                  isSelected 
                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/25 ring-2 ring-indigo-500/20' 
                    : isBlank 
                      ? 'border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850/50' 
                      : 'border-slate-200 dark:border-slate-800/80 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                }`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className={`p-2 rounded-lg ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-650 dark:text-indigo-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-655 dark:text-slate-450 group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors'
                  }`}>
                    {isSelected ? (
                      <Icons.Loader2 className="size-5 animate-spin" />
                    ) : (
                      <IconComponent className="size-5" />
                    )}
                  </div>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {template.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 line-clamp-2">
                  {template.description}
                </p>
              </button>
            );
          })}
        </div>

        <DialogFooter className="border-t border-slate-150 dark:border-slate-800/60 pt-4 mt-2">
          <DialogClose render={<Button variant="outline" className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold cursor-pointer">Cancel</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
