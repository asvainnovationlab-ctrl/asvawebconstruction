'use client';

import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
  Unlink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { isSafeHref } from '@asva/shared';
import { cn } from '@/lib/utils';
import { MediaPickerDialog } from './media-picker';

/**
 * Structured rich-text editor (headings, paragraphs, lists, links, images, quotes, code).
 * Output is HTML that the API sanitises against an allow-list before storing.
 */
export function RichTextEditor({ value, onChange, id, placeholder = 'Start writing…', invalid }: { value: string; onChange: (html: string) => void; id?: string; placeholder?: string; invalid?: boolean }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, protocols: ['mailto', 'tel'], HTMLAttributes: { rel: 'noopener noreferrer' } },
      }),
      Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate prose-asva max-w-none px-4 py-3 focus:outline-none',
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Content editor',
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });

  // Sync when the form value is reset externally (e.g. revision restore).
  useEffect(() => {
    if (editor && value !== editor.getHTML() && !(editor.isEmpty && !value)) editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-background focus-within:border-ring', invalid && 'border-destructive')}>
      {editor && <Toolbar editor={editor} onImage={() => setPickerOpen(true)} />}
      <EditorContent editor={editor} className="max-h-[70vh] overflow-y-auto" />
      <MediaPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(m) => {
          if (m.url) editor?.chain().focus().setImage({ src: m.url, alt: m.altText ?? '' }).run();
        }}
      />
    </div>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const btn = (label: string, Icon: React.ComponentType<{ className?: string }>, action: () => void, active = false, disabled = false) => (
    <button
      type="button"
      onClick={action}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn('grid size-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40', active && 'bg-primary/10 text-primary')}
    >
      <Icon className="size-4" />
    </button>
  );
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (https://…, /page, mailto:…)', previous ?? 'https://');
    if (url === null) return;
    if (url === '') return editor.chain().focus().extendMarkRange('link').unsetLink().run();
    if (!isSafeHref(url)) return window.alert('That link is not allowed. Use https://, a site path, mailto: or tel:.');
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: /^https?:/.test(url) ? '_blank' : null }).run();
  };
  const c = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-2 py-1" role="toolbar" aria-label="Formatting">
      {btn('Heading 2', Heading2, () => c().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
      {btn('Heading 3', Heading3, () => c().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn('Bold', Bold, () => c().toggleBold().run(), editor.isActive('bold'))}
      {btn('Italic', Italic, () => c().toggleItalic().run(), editor.isActive('italic'))}
      {btn('Strikethrough', Strikethrough, () => c().toggleStrike().run(), editor.isActive('strike'))}
      {btn('Inline code', Code, () => c().toggleCode().run(), editor.isActive('code'))}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn('Bullet list', List, () => c().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('Numbered list', ListOrdered, () => c().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('Quote', Quote, () => c().toggleBlockquote().run(), editor.isActive('blockquote'))}
      {btn('Code block', SquareCode, () => c().toggleCodeBlock().run(), editor.isActive('codeBlock'))}
      {btn('Divider', Minus, () => c().setHorizontalRule().run())}
      <span className="mx-1 h-5 w-px bg-border" />
      {btn('Link', Link2, setLink, editor.isActive('link'))}
      {btn('Remove link', Unlink, () => c().unsetLink().run(), false, !editor.isActive('link'))}
      {btn('Insert image', ImagePlus, onImage)}
      <span className="ml-auto" />
      {btn('Undo', Undo2, () => c().undo().run(), false, !editor.can().undo())}
      {btn('Redo', Redo2, () => c().redo().run(), false, !editor.can().redo())}
    </div>
  );
}
