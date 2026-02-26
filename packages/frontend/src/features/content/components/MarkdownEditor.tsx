/**
 * 📝 **MARKDOWN EDITOR COMPONENT**
 *
 * Elite Engineering Standards:
 * - Live markdown preview
 * - Syntax highlighting
 * - Keyboard shortcuts
 * - Mobile-first design
 * - Accessibility compliance
 * - Performance optimized
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useAppSelector } from '../../../store';

// Markdown syntax patterns for highlighting
const MARKDOWN_PATTERNS = {
  header: /^(#{1,6})\s+(.*)$/gm,
  bold: /\*\*(.*?)\*\*/g,
  italic: /\*(.*?)\*/g,
  code: /`(.*?)`/g,
  codeBlock: /```[\s\S]*?```/g,
  link: /\[([^\]]*)\]\(([^)]*)\)/g,
  image: /!\[([^\]]*)\]\(([^)]*)\)/g,
  quote: /^>\s+(.*)$/gm,
  list: /^[\s]*[-*+]\s+(.*)$/gm,
  orderedList: /^[\s]*\d+\.\s+(.*)$/gm,
  strikethrough: /~~(.*?)~~/g,
};

// Markdown shortcuts
const MARKDOWN_SHORTCUTS = [
  { name: 'Bold', syntax: '**text**', shortcut: 'Ctrl+B' },
  { name: 'Italic', syntax: '*text*', shortcut: 'Ctrl+I' },
  { name: 'Code', syntax: '`code`', shortcut: 'Ctrl+`' },
  { name: 'Link', syntax: '[text](url)', shortcut: 'Ctrl+K' },
  { name: 'Image', syntax: '![alt](url)', shortcut: 'Ctrl+Shift+I' },
  { name: 'Header 1', syntax: '# Header', shortcut: 'Ctrl+1' },
  { name: 'Header 2', syntax: '## Header', shortcut: 'Ctrl+2' },
  { name: 'Header 3', syntax: '### Header', shortcut: 'Ctrl+3' },
  { name: 'Quote', syntax: '> Quote', shortcut: 'Ctrl+Q' },
  { name: 'List', syntax: '- Item', shortcut: 'Ctrl+L' },
  { name: 'Code Block', syntax: '```\ncode\n```', shortcut: 'Ctrl+Shift+C' },
];

interface MarkdownEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  onSave?: () => void;
  autoSave?: boolean;
  autoSaveInterval?: number;
  showPreview?: boolean;
  showToolbar?: boolean;
  showSyntaxGuide?: boolean;
  readOnly?: boolean;
  minHeight?: number;
  className?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content = '',
  placeholder = 'Start writing in Markdown...',
  onChange,
  onSave,
  autoSave = true,
  autoSaveInterval = 30000,
  showPreview = true,
  showToolbar = true,
  showSyntaxGuide = false,
  readOnly = false,
  minHeight = 300,
  className = '',
}) => {
  const { editor_state } = useAppSelector((state) => state.cms);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(content);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(1);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Initialize content
  useEffect(() => {
    if (content !== markdown) {
      setMarkdown(content);
      updateCounts(content);
    }
  }, [content, markdown]);

  // Warn if autoSave is enabled but no onSave handler is provided
  useEffect(() => {
    if (autoSave && !onSave) {
      console.warn(
        'MarkdownEditor: autoSave is enabled but no onSave handler was provided. Content changes will not be persisted.'
      );
    }
  }, [autoSave, onSave]);

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !isEditing || !onSave || markdown === content) return;

    const autoSaveTimer = setInterval(() => {
      onSave();
    }, autoSaveInterval);

    return () => clearInterval(autoSaveTimer);
  }, [autoSave, isEditing, markdown, content, onSave, autoSaveInterval]);

  // Update counts and cursor position
  const updateCounts = useCallback((text: string) => {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    setWordCount(words.length);
    setLineCount(text.split('\n').length);
  }, []);

  // Handle content changes
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setMarkdown(newContent);
      updateCounts(newContent);
      onChange?.(newContent);
      setIsEditing(true);

      // Update cursor position
      const textarea = e.target;
      const lines = newContent.substring(0, textarea.selectionStart).split('\n');
      setCursorPosition({
        line: lines.length,
        column: lines[lines.length - 1].length + 1,
      });
    },
    [onChange, updateCounts]
  );

  // Insert markdown syntax
  const insertMarkdown = useCallback(
    (syntax: string) => {
      if (!textareaRef.current || readOnly) return;

      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = markdown.substring(start, end);

      let newText = '';
      let newCursorPos = start;

      switch (syntax) {
        case 'bold':
          newText = `**${selectedText || 'bold text'}**`;
          newCursorPos = selectedText ? end + 4 : start + 2;
          break;
        case 'italic':
          newText = `*${selectedText || 'italic text'}*`;
          newCursorPos = selectedText ? end + 2 : start + 1;
          break;
        case 'code':
          newText = `\`${selectedText || 'code'}\``;
          newCursorPos = selectedText ? end + 2 : start + 1;
          break;
        case 'link':
          newText = `[${selectedText || 'link text'}](url)`;
          newCursorPos = selectedText ? start + selectedText.length + 3 : start + 11;
          break;
        case 'image':
          newText = `![${selectedText || 'alt text'}](url)`;
          newCursorPos = selectedText ? start + selectedText.length + 4 : start + 12;
          break;
        case 'header1':
          newText = `# ${selectedText || 'Header 1'}`;
          newCursorPos = selectedText ? end + 2 : start + 2;
          break;
        case 'header2':
          newText = `## ${selectedText || 'Header 2'}`;
          newCursorPos = selectedText ? end + 3 : start + 3;
          break;
        case 'header3':
          newText = `### ${selectedText || 'Header 3'}`;
          newCursorPos = selectedText ? end + 4 : start + 4;
          break;
        case 'quote':
          newText = `> ${selectedText || 'Quote'}`;
          newCursorPos = selectedText ? end + 2 : start + 2;
          break;
        case 'list':
          newText = `- ${selectedText || 'List item'}`;
          newCursorPos = selectedText ? end + 2 : start + 2;
          break;
        case 'codeblock':
          newText = `\`\`\`\n${selectedText || 'code'}\n\`\`\``;
          newCursorPos = selectedText ? end + 7 : start + 4;
          break;
        default:
          return;
      }

      const newContent = markdown.substring(0, start) + newText + markdown.substring(end);
      setMarkdown(newContent);
      onChange?.(newContent);

      // Set cursor position after state update
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [markdown, onChange, readOnly]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;

      const { ctrlKey, metaKey, shiftKey, key } = e;
      const isCmd = ctrlKey || metaKey;

      if (isCmd) {
        switch (key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            insertMarkdown('bold');
            break;
          case 'i':
            e.preventDefault();
            insertMarkdown('italic');
            break;
          case 'k':
            e.preventDefault();
            insertMarkdown('link');
            break;
          case 'q':
            e.preventDefault();
            insertMarkdown('quote');
            break;
          case 'l':
            e.preventDefault();
            insertMarkdown('list');
            break;
          case '1':
            e.preventDefault();
            insertMarkdown('header1');
            break;
          case '2':
            e.preventDefault();
            insertMarkdown('header2');
            break;
          case '3':
            e.preventDefault();
            insertMarkdown('header3');
            break;
          case '`':
            e.preventDefault();
            insertMarkdown('code');
            break;
          case 'c':
            if (shiftKey) {
              e.preventDefault();
              insertMarkdown('codeblock');
            }
            break;
          case 's':
            e.preventDefault();
            onSave?.();
            break;
        }
      }

      // Handle Tab for indentation
      if (key === 'Tab') {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = markdown.substring(0, start) + '  ' + markdown.substring(end);
        setMarkdown(newContent);
        onChange?.(newContent);

        setTimeout(() => {
          textarea.setSelectionRange(start + 2, start + 2);
        }, 0);
      }
    },
    [readOnly, insertMarkdown, onSave, markdown, onChange]
  );

  // Convert markdown to HTML for preview
  const convertMarkdownToHTML = useCallback((text: string): string => {
    let html = text;

    // Headers
    html = html.replace(MARKDOWN_PATTERNS.header, (match, hashes, content) => {
      const level = hashes.length;
      return `<h${level}>${content}</h${level}>`;
    });

    // Bold
    html = html.replace(MARKDOWN_PATTERNS.bold, '<strong>$1</strong>');

    // Italic
    html = html.replace(MARKDOWN_PATTERNS.italic, '<em>$1</em>');

    // Strikethrough
    html = html.replace(MARKDOWN_PATTERNS.strikethrough, '<del>$1</del>');

    // Code blocks (before inline code)
    html = html.replace(MARKDOWN_PATTERNS.codeBlock, (match) => {
      return `<pre><code>${match.slice(3, -3)}</code></pre>`;
    });

    // Inline code
    html = html.replace(MARKDOWN_PATTERNS.code, '<code>$1</code>');

    // Links
    html = html.replace(
      MARKDOWN_PATTERNS.link,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    // Images
    html = html.replace(MARKDOWN_PATTERNS.image, '<img src="$2" alt="$1" />');

    // Quotes
    html = html.replace(MARKDOWN_PATTERNS.quote, '<blockquote>$1</blockquote>');

    // Lists
    html = html.replace(MARKDOWN_PATTERNS.list, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(MARKDOWN_PATTERNS.orderedList, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }, []);

  return (
    <div
      className={`markdown-editor border border-gray-300 rounded-lg overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      {showToolbar && !readOnly && (
        <div className="border-b border-gray-200 bg-gray-50 p-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Format buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => insertMarkdown('bold')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 font-bold"
                title="Bold (Ctrl+B)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('italic')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 italic"
                title="Italic (Ctrl+I)"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('code')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 font-mono"
                title="Code (Ctrl+`)"
              >
                &lt;/&gt;
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('link')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200"
                title="Link (Ctrl+K)"
              >
                🔗
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('image')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200"
                title="Image"
              >
                🖼️
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Header buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => insertMarkdown('header1')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 font-bold"
                title="Header 1 (Ctrl+1)"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('header2')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 font-bold"
                title="Header 2 (Ctrl+2)"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('header3')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200 font-bold"
                title="Header 3 (Ctrl+3)"
              >
                H3
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* List and quote buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => insertMarkdown('list')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200"
                title="List (Ctrl+L)"
              >
                •
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('quote')}
                className="px-2 py-1 text-sm rounded hover:bg-gray-200"
                title="Quote (Ctrl+Q)"
              >
                ❝
              </button>
            </div>

            {showPreview && (
              <>
                <div className="w-px h-6 bg-gray-300" />

                {/* Preview mode toggle */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('edit')}
                    className={`px-2 py-1 text-sm rounded ${
                      previewMode === 'edit' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('split')}
                    className={`px-2 py-1 text-sm rounded ${
                      previewMode === 'split' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                    }`}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('preview')}
                    className={`px-2 py-1 text-sm rounded ${
                      previewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </>
            )}

            {/* Syntax guide toggle */}
            <button
              type="button"
              onClick={() => setShowSyntaxGuide(!showSyntaxGuide)}
              className="ml-auto px-2 py-1 text-sm rounded hover:bg-gray-200"
              title="Toggle syntax guide"
            >
              ?
            </button>
          </div>
        </div>
      )}

      {/* Editor and Preview Area */}
      <div className="flex" style={{ minHeight: `${minHeight}px` }}>
        {/* Editor */}
        {(previewMode === 'edit' || previewMode === 'split') && (
          <div
            className={`${previewMode === 'split' ? 'w-1/2 border-r border-gray-200' : 'w-full'}`}
          >
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsEditing(true)}
              onBlur={() => setIsEditing(false)}
              placeholder={placeholder}
              readOnly={readOnly}
              className={`w-full h-full p-4 resize-none outline-none font-mono text-sm ${
                readOnly ? 'cursor-default bg-gray-50' : 'cursor-text'
              }`}
              style={{ minHeight: `${minHeight}px` }}
              aria-label="Markdown editor"
            />
          </div>
        )}

        {/* Preview */}
        {showPreview && (previewMode === 'preview' || previewMode === 'split') && (
          <div className={`${previewMode === 'split' ? 'w-1/2' : 'w-full'} bg-white`}>
            <div
              className="p-4 prose max-w-none h-full overflow-y-auto"
              style={{ minHeight: `${minHeight}px` }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(convertMarkdownToHTML(markdown)),
              }}
            />
          </div>
        )}
      </div>

      {/* Syntax Guide */}
      {showSyntaxGuide && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Markdown Syntax Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {MARKDOWN_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.name} className="flex justify-between">
                <span className="text-gray-600">{shortcut.name}:</span>
                <code className="bg-gray-200 px-1 rounded">{shortcut.syntax}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 flex justify-between items-center text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>{wordCount} words</span>
          <span>{lineCount} lines</span>
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
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
    </div>
  );
};

export default MarkdownEditor;
