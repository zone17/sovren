/**
 * 📝 **RICH TEXT EDITOR COMPONENT**
 *
 * Elite Engineering Standards:
 * - Advanced formatting capabilities
 * - Mobile-first responsive design
 * - Accessibility compliance (WCAG 2.1 AA)
 * - Real-time auto-save
 * - Keyboard shortcuts support
 * - Performance optimized
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useAppSelector } from '../../../store';

// Formatting options interface
interface FormattingOption {
  name: string;
  command: string;
  icon: string;
  shortcut?: string;
  requiresValue?: boolean;
}

// Editor configuration
const FORMATTING_OPTIONS: FormattingOption[] = [
  { name: 'Bold', command: 'bold', icon: 'B', shortcut: 'Ctrl+B' },
  { name: 'Italic', command: 'italic', icon: 'I', shortcut: 'Ctrl+I' },
  { name: 'Underline', command: 'underline', icon: 'U', shortcut: 'Ctrl+U' },
  { name: 'Strike', command: 'strikethrough', icon: 'S' },
  { name: 'Heading 1', command: 'formatBlock', icon: 'H1', requiresValue: true },
  { name: 'Heading 2', command: 'formatBlock', icon: 'H2', requiresValue: true },
  { name: 'Heading 3', command: 'formatBlock', icon: 'H3', requiresValue: true },
  { name: 'Paragraph', command: 'formatBlock', icon: 'P', requiresValue: true },
  { name: 'Quote', command: 'formatBlock', icon: '❝', requiresValue: true },
  { name: 'Code', command: 'formatBlock', icon: '</>', requiresValue: true },
  { name: 'Bullet List', command: 'insertUnorderedList', icon: '•' },
  { name: 'Number List', command: 'insertOrderedList', icon: '1.' },
  { name: 'Link', command: 'createLink', icon: '🔗', requiresValue: true },
  { name: 'Image', command: 'insertImage', icon: '🖼️', requiresValue: true },
  { name: 'Align Left', command: 'justifyLeft', icon: '⬅️' },
  { name: 'Align Center', command: 'justifyCenter', icon: '↔️' },
  { name: 'Align Right', command: 'justifyRight', icon: '➡️' },
  { name: 'Justify', command: 'justifyFull', icon: '⬌' },
];

interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  autoSave?: boolean;
  autoSaveInterval?: number;
  readOnly?: boolean;
  showToolbar?: boolean;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content = '',
  placeholder = 'Start writing...',
  onChange,
  onSave,
  autoSave = true,
  autoSaveInterval = 30000,
  readOnly = false,
  showToolbar = true,
  minHeight = 200,
  maxHeight = 600,
  className = '',
}) => {
  const { editor_state } = useAppSelector((state) => state.cms);

  const editorRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState(content);
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && content !== editorContent) {
      editorRef.current.innerHTML = DOMPurify.sanitize(content);
      setEditorContent(content);
      updateCounts(content);
    }
  }, [content, editorContent]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !isEditing) return;

    const autoSaveTimer = setInterval(() => {
      if (editorContent !== content) {
        onSave?.();
      }
    }, autoSaveInterval);

    return () => clearInterval(autoSaveTimer);
  }, [autoSave, isEditing, editorContent, content, onSave, autoSaveInterval]);

  // Update word and character counts
  const updateCounts = useCallback((htmlContent: string) => {
    const textContent = htmlContent.replace(/<[^>]*>/g, '').trim();
    const words = textContent.split(/\s+/).filter((word) => word.length > 0);
    setWordCount(words.length);
    setCharacterCount(textContent.length);
  }, []);

  // Handle content changes
  const handleContentChange = useCallback(() => {
    if (!editorRef.current) return;

    const newContent = editorRef.current.innerHTML;
    setEditorContent(newContent);
    updateCounts(newContent);
    onChange?.(newContent);
    setIsEditing(true);
  }, [onChange, updateCounts]);

  // Execute formatting command
  const executeCommand = useCallback(
    (option: FormattingOption) => {
      if (readOnly) return;

      let value = '';

      if (option.requiresValue) {
        switch (option.command) {
          case 'formatBlock':
            value =
              option.name === 'Heading 1'
                ? 'h1'
                : option.name === 'Heading 2'
                  ? 'h2'
                  : option.name === 'Heading 3'
                    ? 'h3'
                    : option.name === 'Quote'
                      ? 'blockquote'
                      : option.name === 'Code'
                        ? 'pre'
                        : 'p';
            break;
          case 'createLink':
            value = prompt('Enter URL:') || '';
            if (!value) return;
            break;
          case 'insertImage':
            value = prompt('Enter image URL:') || '';
            if (!value) return;
            break;
        }
      }

      document.execCommand(option.command, false, value);
      editorRef.current?.focus();
      handleContentChange();
    },
    [readOnly, handleContentChange]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (readOnly) return;

      const { ctrlKey, metaKey, key } = e;
      const isCmd = ctrlKey || metaKey;

      if (isCmd) {
        switch (key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            executeCommand(FORMATTING_OPTIONS[0]); // Bold
            break;
          case 'i':
            e.preventDefault();
            executeCommand(FORMATTING_OPTIONS[1]); // Italic
            break;
          case 'u':
            e.preventDefault();
            executeCommand(FORMATTING_OPTIONS[2]); // Underline
            break;
          case 's':
            e.preventDefault();
            onSave?.();
            break;
        }
      }

      // Handle Enter key for better paragraph handling
      if (key === 'Enter' && !e.shiftKey) {
        const selection = window.getSelection();
        if (selection?.anchorNode?.nodeName === 'DIV') {
          e.preventDefault();
          document.execCommand('insertHTML', false, '<p><br></p>');
        }
      }
    },
    [readOnly, executeCommand, onSave]
  );

  // Update selected format based on cursor position
  const updateSelectedFormat = useCallback(() => {
    if (readOnly) return;

    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const element =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : (range.commonAncestorContainer as Element);

    if (element) {
      const tagName = element.tagName?.toLowerCase();
      setSelectedFormat(tagName || '');
    }
  }, [readOnly]);

  // Handle selection change
  useEffect(() => {
    const handleSelectionChange = () => updateSelectedFormat();
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateSelectedFormat]);

  // Paste handling for clean content
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (readOnly) return;

      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      const cleanText = text.replace(/[\r\n]/g, '<br>');
      document.execCommand('insertHTML', false, cleanText);
      handleContentChange();
    },
    [readOnly, handleContentChange]
  );

  return (
    <div
      className={`rich-text-editor border border-gray-300 rounded-lg overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      {showToolbar && !readOnly && (
        <div className="border-b border-gray-200 bg-gray-50 p-2">
          <div className="flex flex-wrap gap-1">
            {FORMATTING_OPTIONS.map((option) => (
              <button
                key={option.command}
                type="button"
                onClick={() => executeCommand(option)}
                className={`px-3 py-1 text-sm rounded hover:bg-gray-200 transition-colors ${
                  selectedFormat === option.command ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
                }`}
                title={`${option.name}${option.shortcut ? ` (${option.shortcut})` : ''}`}
                aria-label={option.name}
              >
                {option.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleContentChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsEditing(true)}
        onBlur={() => setIsEditing(false)}
        className={`p-4 outline-none prose max-w-none ${readOnly ? 'cursor-default' : 'cursor-text'}`}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
          overflowY: 'auto',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text editor"
      />

      {/* Status Bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>{wordCount} words</span>
          <span>{characterCount} characters</span>
          {isEditing && autoSave && <span className="text-orange-600">Editing...</span>}
          {!isEditing && editor_state.last_saved && (
            <span className="text-green-600">
              Saved {new Date(editor_state.last_saved).toLocaleTimeString()}
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onSave}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help */}
      {showToolbar && !readOnly && (
        <div className="text-xs text-gray-500 px-4 py-1 bg-gray-50 border-t border-gray-100">
          Shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+S (Save)
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
