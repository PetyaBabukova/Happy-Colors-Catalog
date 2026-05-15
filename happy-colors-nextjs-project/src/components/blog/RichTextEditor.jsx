'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Underline as UnderlineIcon,
  Unlink,
} from 'lucide-react';
import styles from './RichTextEditor.module.css';

const EMPTY_EDITOR_HTML = '<p></p>';
const SAFE_LINK_PROTOCOL = /^(https:\/\/|mailto:)/i;

function normalizeHtml(html) {
  const next = String(html || '').trim();

  return next || EMPTY_EDITOR_HTML;
}

// Backend's contentJson validator only allows href/target/rel on link marks.
// Tiptap's default Link extension also tracks `class`, which the validator
// rejects with "Unexpected contentJson attr: class.". We override the
// addAttributes() to keep only the three allowed keys.
const StrictLink = Link.extend({
  addAttributes() {
    return {
      href: { default: null },
      target: { default: this.options.HTMLAttributes.target },
      rel: { default: this.options.HTMLAttributes.rel },
    };
  },
});

function ToolbarButton({ label, icon: IconComponent, active, disabled, onClick }) {
  const className = active ? `${styles.toolbarButton} ${styles.active}` : styles.toolbarButton;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      disabled={disabled}
      className={className}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <IconComponent aria-hidden="true" focusable="false" />
    </button>
  );
}

function ToolbarSeparator() {
  return <span className={styles.separator} aria-hidden="true" />;
}

export default function RichTextEditor({
  id,
  value = EMPTY_EDITOR_HTML,
  onChange,
  invalid = false,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        // Backend rejects `class` attrs in contentJson. CodeBlock would emit
        // language-* classes; inline code is also out of scope for the blog.
        codeBlock: false,
        code: false,
      }),
      Underline,
      StrictLink.configure({
        protocols: ['https', 'mailto'],
        openOnClick: false,
        autolink: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
    ],
    content: normalizeHtml(value),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Съдържание',
      },
    },
    onUpdate({ editor: instance }) {
      const contentHtml = instance.getHTML();
      const contentJson = instance.getJSON();
      const contentText = instance.getText();

      onChange?.({ contentHtml, contentJson, contentText });
    },
    immediatelyRender: false,
  });

  // Sync external value changes (e.g. loading existing article into edit form).
  useEffect(() => {
    if (!editor) {
      return;
    }

    const incoming = normalizeHtml(value);
    const current = editor.getHTML();

    if (incoming !== current) {
      editor.commands.setContent(incoming, false);
    }
  }, [editor, value]);

  const handleSetLink = () => {
    if (!editor) return;

    const previousHref = editor.getAttributes('link').href || '';
    const promptValue = window.prompt('Линк (https:// или mailto:)', previousHref || 'https://');

    if (promptValue === null) {
      return;
    }

    const href = promptValue.trim();

    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    if (!SAFE_LINK_PROTOCOL.test(href)) {
      window.alert('Линковете трябва да започват с https:// или mailto:.');
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const handleUnlink = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
  };

  const handleClearFormatting = () => {
    if (!editor) return;

    editor.chain().focus().unsetAllMarks().clearNodes().run();
  };

  const wrapperClassName = invalid
    ? `${styles.wrapper} ${styles.wrapperInvalid}`
    : styles.wrapper;

  if (!editor) {
    return (
      <div className={wrapperClassName}>
        <div className={styles.toolbar} aria-label="Форматиране" />
        <div className={styles.editorPlaceholder} />
      </div>
    );
  }

  return (
    <div className={wrapperClassName}>
      <div className={styles.toolbar} aria-label="Форматиране">
        <ToolbarButton
          label="Абзац"
          icon={Pilcrow}
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        />
        <ToolbarButton
          label="Заглавие 2"
          icon={Heading2}
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="Заглавие 3"
          icon={Heading3}
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="Заглавие 4"
          icon={Heading4}
          active={editor.isActive('heading', { level: 4 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        />

        <ToolbarSeparator />

        <ToolbarButton
          label="Получерно"
          icon={Bold}
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Курсив"
          icon={Italic}
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Подчертано"
          icon={UnderlineIcon}
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <ToolbarSeparator />

        <ToolbarButton
          label="Подравняване ляво"
          icon={AlignLeft}
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        />
        <ToolbarButton
          label="Подравняване център"
          icon={AlignCenter}
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        />
        <ToolbarButton
          label="Подравняване дясно"
          icon={AlignRight}
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        />

        <ToolbarSeparator />

        <ToolbarButton
          label="Списък"
          icon={List}
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Номериран списък"
          icon={ListOrdered}
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <ToolbarSeparator />

        <ToolbarButton
          label="Линк"
          icon={LinkIcon}
          active={editor.isActive('link')}
          onClick={handleSetLink}
        />
        <ToolbarButton
          label="Премахни линк"
          icon={Unlink}
          disabled={!editor.isActive('link')}
          onClick={handleUnlink}
        />

        <ToolbarSeparator />

        <ToolbarButton
          label="Изчисти форматиране"
          icon={Eraser}
          onClick={handleClearFormatting}
        />
      </div>

      <EditorContent editor={editor} className={styles.editorHost} />
    </div>
  );
}
