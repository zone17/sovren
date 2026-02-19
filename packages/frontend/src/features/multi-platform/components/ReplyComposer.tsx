import React, { useState } from 'react';
import { useReplyTemplates } from '../hooks/useInboxActions';
import { PLATFORM_DISPLAY } from '../types';

interface ReplyComposerProps {
  messageId: string;
  platform: string;
  authorName: string;
  isPending: boolean;
  onSend: (content: string) => void;
  onCancel: () => void;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  messageId: _messageId,
  platform,
  authorName,
  isPending,
  onSend,
  onCancel,
}) => {
  const [content, setContent] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const { data: templates } = useReplyTemplates();

  const platformInfo = PLATFORM_DISPLAY[platform];
  const charLimit = platform === 'twitter' ? 280 : undefined;
  const overLimit = charLimit !== undefined && content.length > charLimit;

  const handleSend = () => {
    if (!content.trim() || overLimit || isPending) return;
    onSend(content.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const applyTemplate = (templateContent: string) => {
    setContent(templateContent);
    setShowTemplates(false);
  };

  return (
    <div className="mt-2 rounded-md border border-indigo-200 bg-indigo-50/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: platformInfo?.color || '#6B7280' }}
          aria-hidden="true"
        />
        <span className="text-xs text-gray-500">
          Replying to <span className="font-medium text-gray-700">{authorName}</span> via{' '}
          {platformInfo?.name || platform}
        </span>
      </div>

      <textarea
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        rows={3}
        placeholder={`Reply via ${platformInfo?.name || platform}...`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
        aria-label={`Reply to ${authorName}`}
        aria-describedby={charLimit ? 'char-count' : undefined}
        autoFocus
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {charLimit !== undefined && (
            <span
              id="char-count"
              className={`text-xs ${overLimit ? 'text-red-600 font-medium' : 'text-gray-400'}`}
              aria-live="polite"
            >
              {content.length}/{charLimit}
            </span>
          )}
          {templates && templates.length > 0 && (
            <div className="relative">
              <button
                type="button"
                className="text-xs text-indigo-600 hover:underline focus:outline-none"
                onClick={() => setShowTemplates((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={showTemplates}
              >
                Use template
              </button>
              {showTemplates && (
                <div
                  role="listbox"
                  aria-label="Reply templates"
                  className="absolute left-0 top-6 z-10 w-56 rounded-md border border-gray-200 bg-white shadow-lg"
                >
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      role="option"
                      aria-selected={false}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                      onClick={() => applyTemplate(t.template_text)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            onClick={handleSend}
            disabled={!content.trim() || overLimit || isPending}
            aria-label="Send reply"
          >
            {isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplyComposer;
