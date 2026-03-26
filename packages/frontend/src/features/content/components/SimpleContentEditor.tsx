import React, { useCallback, useEffect, useState } from 'react';
import { usePublishWithProvenance } from '../../content-shield/hooks/usePublishWithProvenance';
import { useAppSelector } from '../../../store';
import type { ContentBlock, ContentBlockMetadata, MediaAsset } from '../../../types/content';

interface SimpleContentEditorProps {
  onSave?: () => void;
  onPublish?: () => void;
  autoSaveInterval?: number;
}

// 🛡️ **ELITE TYPE SAFETY - CONTENT INTERFACES**
interface LightningPaymentBlockContent extends ContentBlockMetadata {
  amount: number;
  description: string;
  type: 'payment_request';
}

interface MediaBlockContent extends ContentBlockMetadata {
  media_asset_id: string | null;
  alt_text: string;
  caption: string;
}

interface LightningBlockProps {
  block: ContentBlock;
  onUpdate: (content: LightningPaymentBlockContent) => void;
  onDelete: () => void;
}

const LightningBlock: React.FC<LightningBlockProps> = ({ block, onUpdate, onDelete }) => {
  // Type-safe content extraction
  const lightningContent = block.content as Record<string, unknown>;
  const [amount, setAmount] = useState<number>(
    typeof lightningContent.amount === 'number' ? lightningContent.amount : 1000
  );
  const [description, setDescription] = useState<string>(
    typeof lightningContent.description === 'string' ? lightningContent.description : ''
  );

  const handleUpdate = (): void => {
    onUpdate({
      amount,
      description,
      type: 'payment_request',
    });
  };

  return (
    <div className="border-2 border-yellow-400 rounded-lg p-4 my-4 bg-yellow-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-xl">⚡</span>
          <span className="ml-2 font-semibold text-yellow-800">Lightning Payment</span>
        </div>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700 text-sm">
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Amount (sats)</label>
          <input
            type="number"
            value={amount}
            onChange={(e): void => setAmount(parseInt(e.target.value) || 0)}
            onBlur={handleUpdate}
            className="w-full border border-border rounded px-3 py-2"
            min="1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e): void => setDescription(e.target.value)}
            onBlur={handleUpdate}
            placeholder="What is this payment for?"
            className="w-full border border-border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">
        Readers can send {amount} sats to support this content section.
      </div>
    </div>
  );
};

interface MediaBlockProps {
  block: ContentBlock;
  onUpdate: (content: MediaBlockContent) => void;
  onDelete: () => void;
}

const MediaBlock: React.FC<MediaBlockProps> = ({ block, onUpdate, onDelete }) => {
  const { media_assets } = useAppSelector((state) => (state as any).cms);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      // TODO(media-engineer): Implement Supabase Storage upload.
      // Pattern: upload to supabase.storage.from('media').upload(path, file),
      // then store the public URL via POST /api/v1/content/media.
      setUploadError('Media upload is coming soon. Please check back shortly.');
    } finally {
      setUploading(false);
    }
  };

  const mediaAsset: MediaAsset | undefined = media_assets.find(
    (asset: MediaAsset) => asset.id === block.content.media_asset_id
  );

  // Type-safe content extraction
  const mediaContent = block.content as Record<string, unknown>;
  const altText = typeof mediaContent.alt_text === 'string' ? mediaContent.alt_text : '';
  const caption = typeof mediaContent.caption === 'string' ? mediaContent.caption : '';

  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 my-4 bg-blue-50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <span className="text-xl">🖼️</span>
          <span className="ml-2 font-semibold text-blue-800">Media</span>
        </div>
        <button onClick={onDelete} className="text-red-500 hover:text-red-700 text-sm">
          Remove
        </button>
      </div>

      {!mediaAsset ? (
        <div>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={(event): void => {
              void handleFileUpload(event);
            }}
            disabled={uploading}
            className="mb-3"
          />
          {uploading && <div className="text-sm text-muted-foreground">Uploading to IPFS...</div>}
          {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}
        </div>
      ) : (
        <div>
          <div className="mb-3">
            {mediaAsset.mime_type.startsWith('image/') && (
              <img
                src={`https://gateway.pinata.cloud/ipfs/${mediaAsset.ipfs_hash}`}
                alt={altText || mediaAsset.filename}
                className="max-w-full h-auto rounded"
              />
            )}
            {mediaAsset.mime_type.startsWith('video/') && (
              <video
                src={`https://gateway.pinata.cloud/ipfs/${mediaAsset.ipfs_hash}`}
                controls
                className="max-w-full h-auto rounded"
              />
            )}
            {mediaAsset.mime_type.startsWith('audio/') && (
              <audio
                src={`https://gateway.pinata.cloud/ipfs/${mediaAsset.ipfs_hash}`}
                controls
                className="w-full"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Alt Text</label>
              <input
                type="text"
                value={altText}
                onChange={(e): void =>
                  onUpdate({
                    media_asset_id: mediaAsset.id,
                    alt_text: e.target.value,
                    caption,
                  })
                }
                className="w-full border border-border rounded px-3 py-2"
                placeholder="Describe this media for accessibility"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Caption</label>
              <input
                type="text"
                value={caption}
                onChange={(e): void =>
                  onUpdate({
                    media_asset_id: mediaAsset.id,
                    alt_text: altText,
                    caption: e.target.value,
                  })
                }
                className="w-full border border-border rounded px-3 py-2"
                placeholder="Optional caption"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SimpleContentEditor: React.FC<SimpleContentEditorProps> = ({
  onSave,
  onPublish,
  autoSaveInterval = 30000,
}) => {
  const { current_content, editor_state } = useAppSelector((state) => (state as any).cms);
  const [title, setTitle] = useState(current_content?.title || '');
  const [description, setDescription] = useState(current_content?.description || '');
  const [content, setContent] = useState('');

  const publishWithProvenance = usePublishWithProvenance(
    current_content?.id ?? '',
    async (body: string) => {
      // content is passed in so the async wrapper always uses the latest value
      void body;
      onPublish?.();
    }
  );
  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>(
    current_content?.content_blocks || []
  );

  // Initialize content from blocks
  useEffect(() => {
    if (current_content) {
      setTitle(current_content.title);
      setDescription(current_content.description || '');
      setLocalBlocks(current_content.content_blocks);

      // Extract text content from blocks
      const textContent = current_content.content_blocks
        .filter((block: ContentBlock) => block.type === 'paragraph')
        .map((block: ContentBlock) => {
          const blockContent = block.content as Record<string, unknown>;
          return (
            (typeof blockContent.text === 'string' ? blockContent.text : '') ||
            (typeof blockContent.html === 'string' ? blockContent.html : '')
          );
        })
        .join('\n\n');
      setContent(textContent);
    }
  }, [current_content]);

  // Auto-save functionality
  useEffect(() => {
    if (!editor_state.auto_save_enabled) return;

    const interval = setInterval(() => {
      if (editor_state.last_saved === null) {
        onSave?.();
      }
    }, autoSaveInterval);

    return (): void => clearInterval(interval);
  }, [editor_state.auto_save_enabled, editor_state.last_saved, autoSaveInterval, onSave]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setTitle(e.target.value);
    // TODO(backlog): Persist title changes via React Query mutation
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setDescription(e.target.value);
    // TODO(backlog): Persist description changes via React Query mutation
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    const newContent = e.target.value;
    setContent(newContent);

    // Update local blocks state — paragraphs are rebuilt, non-text blocks preserved
    const paragraphs = newContent.split('\n\n').filter((p) => p.trim());
    const textBlocks: ContentBlock[] = paragraphs.map((text) => ({
      id: crypto.randomUUID(),
      type: 'paragraph',
      content: { text },
    }));

    const nonTextBlocks = localBlocks.filter(
      (block: ContentBlock) => !['paragraph', 'heading'].includes(block.type)
    );

    setLocalBlocks([...textBlocks, ...nonTextBlocks]);
    // TODO(backlog): Persist content block changes via React Query mutation
  };

  const addLightningBlock = useCallback((): void => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'lightning-payment',
      content: {
        amount: 1000,
        description: '',
        type: 'payment_request',
      },
    };
    setLocalBlocks((prev) => [...prev, newBlock]);
    // TODO(backlog): Persist new block via React Query mutation
  }, []);

  const addMediaBlock = useCallback((): void => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'image',
      content: {
        media_asset_id: null,
        alt_text: '',
        caption: '',
      },
    };
    setLocalBlocks((prev) => [...prev, newBlock]);
    // TODO(backlog): Persist new block via React Query mutation
  }, []);

  const updateBlock = useCallback((index: number, blockContent: ContentBlockMetadata): void => {
    setLocalBlocks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], content: blockContent };
      return updated;
    });
    // TODO(backlog): Persist block update via React Query mutation
  }, []);

  const deleteBlock = useCallback((index: number): void => {
    setLocalBlocks((prev) => prev.filter((_, i) => i !== index));
    // TODO(backlog): Persist block deletion via React Query mutation
  }, []);

  const formatText = (type: 'bold' | 'italic' | 'heading'): void => {
    const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let formattedText = selectedText;

    switch (type) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'heading':
        formattedText = `## ${selectedText}`;
        break;
    }

    const newContent = content.substring(0, start) + formattedText + content.substring(end);
    setContent(newContent);
    handleContentChange({
      target: { value: newContent },
    } as React.ChangeEvent<HTMLTextAreaElement>);
  };

  if (!current_content) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No content selected for editing</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Content Editor</h1>
          <div className="flex items-center space-x-3">
            {editor_state.last_saved ? (
              <span className="text-sm text-green-600">
                Saved {new Date(editor_state.last_saved).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-sm text-orange-600">Unsaved changes</span>
            )}
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Draft
            </button>
            <button
              onClick={(): void => {
                void publishWithProvenance(content);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Publish
            </button>
          </div>
        </div>

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Enter your title..."
          className="w-full text-3xl font-bold border-none outline-none mb-4 placeholder-muted-foreground/60 bg-transparent"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Write a brief description..."
          className="w-full text-muted-foreground border-none outline-none resize-none placeholder-muted-foreground/60 bg-transparent"
          rows={2}
        />
      </div>

      {/* Editor Toolbar */}
      <div className="border-b border-border pb-4 mb-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={(): void => formatText('bold')}
            className="px-3 py-1 rounded hover:bg-accent"
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={(): void => formatText('italic')}
            className="px-3 py-1 rounded hover:bg-accent"
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={(): void => formatText('heading')}
            className="px-3 py-1 rounded hover:bg-accent"
            title="Heading"
          >
            H2
          </button>

          <div className="border-l border-border pl-2 ml-2">
            <button
              onClick={addMediaBlock}
              className="px-3 py-1 rounded hover:bg-accent text-blue-600"
            >
              + Media
            </button>
            <button
              onClick={addLightningBlock}
              className="px-3 py-1 rounded hover:bg-accent text-yellow-600"
            >
              + Lightning
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="mb-6">
        <textarea
          id="content-editor"
          value={content}
          onChange={handleContentChange}
          placeholder="Start writing your content... Use **bold**, *italic*, and ## headings for formatting."
          className="w-full min-h-96 p-4 border border-border rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
        />
        <div className="text-sm text-muted-foreground mt-2">
          Supports Markdown formatting: **bold**, *italic*, ## headings
        </div>
      </div>

      {/* Custom Blocks */}
      <div className="mt-6">
        {localBlocks
          .filter((block: ContentBlock) => !['paragraph', 'heading'].includes(block.type))
          .map((block: ContentBlock) => {
            const actualIndex = localBlocks.findIndex((b: ContentBlock) => b.id === block.id);

            if (block.type === 'lightning-payment') {
              return (
                <LightningBlock
                  key={block.id}
                  block={block}
                  onUpdate={(content): void => updateBlock(actualIndex, content)}
                  onDelete={(): void => deleteBlock(actualIndex)}
                />
              );
            }

            if (block.type === 'image' || block.type === 'video' || block.type === 'audio') {
              return (
                <MediaBlock
                  key={block.id}
                  block={block}
                  onUpdate={(content): void => updateBlock(actualIndex, content)}
                  onDelete={(): void => deleteBlock(actualIndex)}
                />
              );
            }

            return null;
          })}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Status: <span className="font-medium">{current_content.status}</span> • Visibility:{' '}
            <span className="font-medium">{current_content.visibility}</span>
          </div>
          <div>
            Version {current_content.version} • Created{' '}
            {new Date(current_content.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleContentEditor;
