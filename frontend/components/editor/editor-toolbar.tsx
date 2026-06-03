import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Quote, 
  Code2, 
  Highlighter, 
  Minus, 
  Eraser, 
  Undo2, 
  Redo2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
  editable: boolean;
}

export function EditorToolbar({ editor, editable }: EditorToolbarProps) {
  if (!editor) return null;

  const ToolbarButton = ({ 
    onClick, 
    active, 
    disabled = false,
    children, 
    title 
  }: { 
    onClick: () => void; 
    active?: boolean; 
    disabled?: boolean;
    children: React.ReactNode; 
    title?: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled || !editable}
      title={title}
      className={cn(
        "size-8 rounded-md transition-colors",
        active 
          ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold" 
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
      )}
    >
      {children}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-1.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 w-full rounded-t-xl">
      {/* Group 1: Inline styles */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          active={editor.isActive('bold')} 
          title="Bold"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          active={editor.isActive('italic')} 
          title="Italic"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleUnderline().run()} 
          active={editor.isActive('underline')} 
          title="Underline"
        >
          <Underline className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleStrike().run()} 
          active={editor.isActive('strike')} 
          title="Strikethrough"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-200 dark:bg-slate-800" />

      {/* Group 2: Headings */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          active={editor.isActive('heading', { level: 1 })} 
          title="Heading 1"
        >
          <span className="text-xs font-black">H1</span>
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          active={editor.isActive('heading', { level: 2 })} 
          title="Heading 2"
        >
          <span className="text-xs font-black">H2</span>
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          active={editor.isActive('heading', { level: 3 })} 
          title="Heading 3"
        >
          <span className="text-xs font-black">H3</span>
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-200 dark:bg-slate-800" />

      {/* Group 3: Lists */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          active={editor.isActive('bulletList')} 
          title="Bullet List"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          active={editor.isActive('orderedList')} 
          title="Ordered List"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-200 dark:bg-slate-800" />

      {/* Group 4: Alignments */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().setTextAlign('left').run()} 
          active={editor.isActive({ textAlign: 'left' })} 
          title="Align Left"
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().setTextAlign('center').run()} 
          active={editor.isActive({ textAlign: 'center' })} 
          title="Align Center"
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().setTextAlign('right').run()} 
          active={editor.isActive({ textAlign: 'right' })} 
          title="Align Right"
        >
          <AlignRight className="size-4" />
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-200 dark:bg-slate-800" />

      {/* Group 5: Blocks */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          active={editor.isActive('blockquote')} 
          title="Blockquote"
        >
          <Quote className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
          active={editor.isActive('codeBlock')} 
          title="Code Block"
        >
          <Code2 className="size-4" />
        </ToolbarButton>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6 bg-slate-200 dark:bg-slate-800" />

      {/* Group 6: Highlights and Formatting */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton 
          onClick={() => editor.chain().focus().toggleHighlight().run()} 
          active={editor.isActive('highlight')} 
          title="Highlight"
        >
          <Highlighter className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().setHorizontalRule().run()} 
          title="Horizontal Rule"
        >
          <Minus className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} 
          title="Clear Formatting"
        >
          <Eraser className="size-4" />
        </ToolbarButton>
      </div>

      {/* Group 7: Undo / Redo - Pushed to the right */}
      <div className="flex items-center gap-0.5 ml-auto">
        <ToolbarButton 
          onClick={() => editor.chain().focus().undo().run()} 
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo"
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={() => editor.chain().focus().redo().run()} 
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo"
        >
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}
