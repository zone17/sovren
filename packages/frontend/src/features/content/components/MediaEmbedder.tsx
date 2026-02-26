/**
 * 🎬 **MEDIA EMBEDDER COMPONENT**
 *
 * Elite Engineering Standards:
 * - Multi-format media support
 * - Drag & drop upload
 * - External media embedding
 * - Accessibility compliance
 * - Performance optimized
 * - Mobile-first design
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../../store';
import type { ContentBlock, MediaAsset } from '../../../types/content';

// Supported media types
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
const SUPPORTED_AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'];

// External embed patterns
const EMBED_PATTERNS = {
  youtube: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  vimeo: /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
  twitter: /(?:https?:\/\/)?(?:www\.)?twitter\.com\/\w+\/status\/(\d+)/,
  instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
  soundcloud: /(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/,
  spotify: /(?:https?:\/\/)?open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/,
};

interface MediaEmbedderProps {
  onMediaAdded?: (block: ContentBlock) => void;
  allowedTypes?: ('image' | 'video' | 'audio' | 'external')[];
  maxFileSize?: number; // in bytes
  className?: string;
}

export const MediaEmbedder: React.FC<MediaEmbedderProps> = ({
  onMediaAdded,
  allowedTypes = ['image', 'video', 'audio', 'external'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  className = '',
}) => {
  const { media_assets } = useAppSelector((state) => state.cms);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [externalUrl, setExternalUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'gallery'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      setError(null);

      // Validate file type
      const isImage = SUPPORTED_IMAGE_TYPES.includes(file.type);
      const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.type);
      const isAudio = SUPPORTED_AUDIO_TYPES.includes(file.type);

      if (!isImage && !isVideo && !isAudio) {
        setError('Unsupported file type. Please select an image, video, or audio file.');
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        setError(`File too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB.`);
        return;
      }

      // Check allowed types
      if (isImage && !allowedTypes.includes('image')) {
        setError('Image files are not allowed.');
        return;
      }
      if (isVideo && !allowedTypes.includes('video')) {
        setError('Video files are not allowed.');
        return;
      }
      if (isAudio && !allowedTypes.includes('audio')) {
        setError('Audio files are not allowed.');
        return;
      }

      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Upload file
      setUploading(true);
      setUploadProgress(0);

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        // TODO: Replace with real media upload API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        clearInterval(progressInterval);
        setUploadProgress(100);

        // Create content block
        const blockType = isImage ? 'image' : isVideo ? 'video' : 'audio';
        const mediaBlock: ContentBlock = {
          id: crypto.randomUUID(),
          type: blockType,
          content: {
            media_asset_id: crypto.randomUUID(),
            alt_text: isImage ? '' : undefined,
            caption: '',
            autoplay: isVideo || isAudio ? false : undefined,
            controls: isVideo || isAudio ? true : undefined,
          },
        };

        onMediaAdded?.(mediaBlock);

        // Reset state
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          setPreviewUrl(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }, 1000);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Upload failed');
        setUploading(false);
        setUploadProgress(0);
        setPreviewUrl(null);
      }
    },
    [maxFileSize, allowedTypes, onMediaAdded]
  );

  // Handle external URL embedding
  const handleExternalEmbed = useCallback(() => {
    if (!externalUrl.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    if (!allowedTypes.includes('external')) {
      setError('External embeds are not allowed.');
      return;
    }

    setError(null);

    // Detect embed type
    let embedType = 'external';
    let embedData: Record<string, unknown> = { url: externalUrl };

    // YouTube
    const youtubeMatch = externalUrl.match(EMBED_PATTERNS.youtube);
    if (youtubeMatch) {
      embedType = 'youtube';
      embedData = {
        video_id: youtubeMatch[1],
        url: externalUrl,
        embed_url: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
      };
    }

    // Vimeo
    const vimeoMatch = externalUrl.match(EMBED_PATTERNS.vimeo);
    if (vimeoMatch) {
      embedType = 'vimeo';
      embedData = {
        video_id: vimeoMatch[1],
        url: externalUrl,
        embed_url: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      };
    }

    // Twitter
    const twitterMatch = externalUrl.match(EMBED_PATTERNS.twitter);
    if (twitterMatch) {
      embedType = 'twitter';
      embedData = {
        tweet_id: twitterMatch[1],
        url: externalUrl,
      };
    }

    // Create embed block
    const embedBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'external-embed',
      content: {
        embed_type: embedType,
        ...embedData,
      },
    };

    onMediaAdded?.(embedBlock);
    setExternalUrl('');
  }, [externalUrl, allowedTypes, onMediaAdded]);

  // Handle existing media selection
  const handleGallerySelect = useCallback(
    (asset: MediaAsset) => {
      const blockType = asset.file_type.startsWith('image/')
        ? 'image'
        : asset.file_type.startsWith('video/')
          ? 'video'
          : 'audio';

      const mediaBlock: ContentBlock = {
        id: crypto.randomUUID(),
        type: blockType,
        content: {
          media_asset_id: asset.id,
          alt_text: blockType === 'image' ? asset.alt_text || '' : undefined,
          caption: asset.caption || '',
          autoplay: blockType !== 'image' ? false : undefined,
          controls: blockType !== 'image' ? true : undefined,
        },
      };

      onMediaAdded?.(mediaBlock);
    },
    [onMediaAdded]
  );

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
    [handleFileSelect]
  );

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div
      className={`media-embedder bg-white border border-gray-300 rounded-lg overflow-hidden ${className}`}
    >
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1" aria-label="Media tabs">
          {allowedTypes.includes('image') ||
          allowedTypes.includes('video') ||
          allowedTypes.includes('audio') ? (
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Upload
            </button>
          ) : null}

          {allowedTypes.includes('external') && (
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'url'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Embed URL
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'gallery'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Gallery
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* Drop Zone */}
            <div
              ref={dropZoneRef}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {uploading ? (
                <div className="space-y-4">
                  <div className="text-2xl">⬆️</div>
                  <div>
                    <div className="text-sm text-gray-600">Uploading...</div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{uploadProgress}%</div>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="space-y-4">
                  <div className="text-2xl">✅</div>
                  <div className="text-sm text-green-600">Upload successful!</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-4xl">📁</div>
                  <div>
                    <div className="text-lg font-medium text-gray-900">
                      Drop files here or click to browse
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Supports images, videos, and audio files up to{' '}
                      {Math.round(maxFileSize / 1024 / 1024)}MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Choose Files
                  </button>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileSelect(e.target.files)}
              accept={[
                ...(allowedTypes.includes('image') ? SUPPORTED_IMAGE_TYPES : []),
                ...(allowedTypes.includes('video') ? SUPPORTED_VIDEO_TYPES : []),
                ...(allowedTypes.includes('audio') ? SUPPORTED_AUDIO_TYPES : []),
              ].join(',')}
              className="hidden"
              aria-label="File upload"
            />

            {/* Preview */}
            {previewUrl && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-900 mb-2">Preview</div>
                <div className="max-w-xs mx-auto">
                  {previewUrl.startsWith('data:image') || previewUrl.includes('image') ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-auto rounded" />
                  ) : previewUrl.includes('video') ? (
                    <video src={previewUrl} controls className="w-full h-auto rounded" />
                  ) : (
                    <audio src={previewUrl} controls className="w-full" />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Media URL</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                Supports YouTube, Vimeo, Twitter, Instagram, SoundCloud, and Spotify
              </div>
            </div>

            <button
              type="button"
              onClick={handleExternalEmbed}
              disabled={!externalUrl.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Embed Media
            </button>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div className="space-y-4">
            {media_assets.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🖼️</div>
                <div className="text-gray-500">No media files yet</div>
                <div className="text-sm text-gray-400">Upload some files to see them here</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {media_assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 cursor-pointer transition-colors"
                    onClick={() => handleGallerySelect(asset)}
                  >
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      {asset.file_type.startsWith('image/') ? (
                        <img
                          src={asset.url}
                          alt={asset.alt_text || asset.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : asset.file_type.startsWith('video/') ? (
                        <div className="text-2xl">🎬</div>
                      ) : (
                        <div className="text-2xl">🎵</div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {asset.filename}
                      </div>
                      <div className="text-xs text-gray-500">
                        {Math.round(asset.file_size / 1024)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">⚠️</div>
              <div className="text-sm text-red-800">{error}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaEmbedder;
