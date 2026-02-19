import React, { useState } from 'react';
import { useReplyTemplates } from '../hooks/useInboxActions';

interface BatchActionToolbarProps {
  selectedCount: number;
  isPending: boolean;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onTemplateReply: (templateContent: string) => void;
  onClearSelection: () => void;
}

export const BatchActionToolbar: React.FC<BatchActionToolbarProps> = ({
  selectedCount,
  isPending,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onTemplateReply,
  onClearSelection,
}) => {
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const { data: templates } = useReplyTemplates();

  if (selectedCount === 0) return null;

  const btnClass =
    'rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';

  return (
    <div
      role="toolbar"
      aria-label={`Batch actions for ${selectedCount} selected messages`}
      className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2"
    >
      <span className="text-sm font-medium text-indigo-700">{selectedCount} selected</span>

      <div className="h-4 w-px bg-indigo-200" aria-hidden="true" />

      <button
        type="button"
        className={btnClass}
        onClick={onMarkRead}
        disabled={isPending}
        aria-label="Mark selected messages as read"
      >
        Mark read
      </button>

      <button
        type="button"
        className={btnClass}
        onClick={onMarkUnread}
        disabled={isPending}
        aria-label="Mark selected messages as unread"
      >
        Mark unread
      </button>

      <button
        type="button"
        className={btnClass}
        onClick={onArchive}
        disabled={isPending}
        aria-label="Archive selected messages"
      >
        Archive
      </button>

      {templates && templates.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className={btnClass}
            onClick={() => setShowTemplateMenu((v) => !v)}
            disabled={isPending}
            aria-haspopup="listbox"
            aria-expanded={showTemplateMenu}
            aria-label="Reply with template"
          >
            Template reply
          </button>
          {showTemplateMenu && (
            <div
              role="listbox"
              aria-label="Reply templates"
              className="absolute left-0 top-9 z-10 w-64 rounded-md border border-gray-200 bg-white shadow-lg"
            >
              {templates.map((t) => (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={false}
                  type="button"
                  className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
                  onClick={() => {
                    onTemplateReply(t.template_text);
                    setShowTemplateMenu(false);
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="ml-auto text-xs text-gray-400 hover:text-gray-600 focus:outline-none"
        onClick={onClearSelection}
        aria-label="Clear selection"
      >
        Clear
      </button>
    </div>
  );
};

export default BatchActionToolbar;
