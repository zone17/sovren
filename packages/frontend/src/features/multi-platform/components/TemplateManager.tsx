import React, { useState } from 'react';
import {
  useReplyTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from '../hooks/useInboxActions';
import type { ReplyTemplate } from '../types/inbox';

export const TemplateManager: React.FC = () => {
  const { data: templates, isLoading } = useReplyTemplates();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formContent, setFormContent] = useState('');

  const resetForm = () => {
    setFormName('');
    setFormContent('');
    setEditingId(null);
    setIsCreating(false);
  };

  const handleCreate = () => {
    if (!formName.trim() || !formContent.trim()) return;
    createMutation.mutate(
      { name: formName.trim(), template_text: formContent.trim() },
      { onSuccess: resetForm }
    );
  };

  const handleEdit = (template: ReplyTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormContent(template.template_text);
    setIsCreating(false);
  };

  const handleUpdate = () => {
    if (!editingId || !formName.trim() || !formContent.trim()) return;
    updateMutation.mutate(
      { id: editingId, data: { name: formName.trim(), template_text: formContent.trim() } },
      { onSuccess: resetForm }
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this template?')) {
      deleteMutation.mutate(id, { onSuccess: resetForm });
    }
  };

  const inputClass =
    'w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const isFormMode = isCreating || editingId !== null;
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-12 rounded bg-muted" />
          <div className="h-12 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Reply Templates</h3>
        {!isFormMode && (
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onClick={() => setIsCreating(true)}
            aria-label="Create new reply template"
          >
            New template
          </button>
        )}
      </div>

      {isFormMode && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            editingId ? handleUpdate() : handleCreate();
          }}
          aria-label={editingId ? 'Edit template' : 'Create template'}
        >
          <div>
            <label
              htmlFor="template-name"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Template name
            </label>
            <input
              id="template-name"
              type="text"
              className={inputClass}
              placeholder="e.g. Thank you for your support"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div>
            <label
              htmlFor="template-content"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              Template content
            </label>
            <textarea
              id="template-content"
              className={inputClass}
              rows={4}
              placeholder="Thank you for your message! ..."
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              required
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              onClick={resetForm}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!formName.trim() || !formContent.trim() || isPending}
            >
              {isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {!templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No templates yet. Create one to speed up your replies.
          </p>
        ) : (
          templates.map((template) => (
            <div key={template.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {template.template_text}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={() => handleEdit(template)}
                    aria-label={`Edit template ${template.name}`}
                    disabled={isPending}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    onClick={() => handleDelete(template.id)}
                    aria-label={`Delete template ${template.name}`}
                    disabled={isPending}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TemplateManager;
