/**
 * 📝 **CONTENT FEATURE TYPE DEFINITIONS**
 *
 * Elite Engineering Standards:
 * - Comprehensive content management types
 * - Lightning Network payment integration
 * - AI-powered content enhancement
 * - IPFS media asset management
 */

// 📄 **CONTENT BLOCK TYPES**
export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'video'
  | 'audio'
  | 'lightning-payment'
  | 'ai-generated'
  | 'code'
  | 'quote'
  | 'list';

// 📝 **CONTENT BLOCK CONTENT INTERFACES**
export interface ParagraphContent {
  text: string;
  html?: string;
}

export interface HeadingContent {
  text: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface MediaContent {
  media_asset_id: string | null;
  alt_text: string;
  caption: string;
  url?: string;
}

export interface LightningPaymentContent {
  amount: number;
  description: string;
  type: 'payment_request' | 'donation' | 'tip';
  invoice?: string;
}

export interface AIGeneratedContent {
  text: string;
  generation_prompt: string;
  model_used: string;
  confidence_score: number;
  reviewed: boolean;
}

export interface CodeContent {
  code: string;
  language: string;
  filename?: string;
  highlighted?: boolean;
}

export interface QuoteContent {
  text: string;
  author?: string;
  source?: string;
}

export interface ListContent {
  items: string[];
  ordered: boolean;
}

// 🎯 **CONTENT BLOCK METADATA**
export interface ContentBlockMetadata {
  [key: string]: unknown;
}

// 🧱 **CONTENT BLOCK INTERFACE**
export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content:
    | ParagraphContent
    | HeadingContent
    | MediaContent
    | LightningPaymentContent
    | AIGeneratedContent
    | CodeContent
    | QuoteContent
    | ListContent
    | ContentBlockMetadata;
  metadata?: ContentBlockMetadata;
  ai_metadata?: {
    generated: boolean;
    confidence_score?: number;
    generation_prompt?: string;
    reviewed_by_human?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

// 📱 **MEDIA ASSET TYPES**
export type MediaAssetType = 'image' | 'video' | 'audio' | 'document';

export type ProcessingStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface MediaAsset {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  type?: MediaAssetType;
  ipfs_hash?: string;
  arweave_id?: string;
  processing_status: ProcessingStatus;
  thumbnail_url?: string;
  duration?: number; // For video/audio
  dimensions?: {
    width: number;
    height: number;
  };
  alt_text?: string;
  caption?: string;
  created_at: string;
  creator_pubkey: string;
  ai_analysis?: {
    description?: string;
    tags?: string[];
    content_warning?: boolean;
    quality_score?: number;
  };
}

// 📄 **CONTENT ITEM STATUS & VISIBILITY**
export type ContentStatus = 'draft' | 'published' | 'archived' | 'deleted';
export type ContentVisibility = 'public' | 'unlisted' | 'private' | 'supporters_only';

// 📝 **CONTENT ITEM INTERFACE**
export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  content_blocks: ContentBlock[];
  status: ContentStatus;
  visibility: ContentVisibility;
  creator_pubkey: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at?: string;
  version: number;

  // Engagement metrics
  view_count: number;
  like_count: number;
  comment_count: number;
  support_count: number;
  total_earned_sats: number;

  // AI Enhancement
  ai_enhancement?: {
    content_quality_score?: number;
    readability_score?: number;
    seo_optimization?: {
      title_optimized: boolean;
      meta_description?: string;
      keywords: string[];
    };
    suggested_improvements?: ContentImprovement[];
  };

  // Collaboration
  collaborators?: string[];
  permissions?: {
    can_edit: string[];
    can_comment: string[];
    can_view: string[];
  };
}

// 🤖 **AI CONTENT IMPROVEMENTS**
export type ImprovementType =
  | 'grammar'
  | 'clarity'
  | 'seo'
  | 'engagement'
  | 'structure'
  | 'accessibility';

export interface ContentImprovement {
  id: string;
  type: ImprovementType;
  block_id?: string; // Which block this applies to
  description: string;
  suggested_change: string;
  rationale: string;
  confidence_score: number;
  impact_level: 'low' | 'medium' | 'high';
  applied: boolean;
  reviewed: boolean;
  created_at: string;
}

// 📊 **CONTENT EDITOR STATE**
export interface EditorState {
  is_editing: boolean;
  auto_save_enabled: boolean;
  last_saved: string | null;
  ai_assistant_enabled: boolean;
  collaborative_mode: boolean;
  current_collaborators: string[];
  suggested_improvements: ContentImprovement[];
  selection?: {
    block_id: string;
    start_offset: number;
    end_offset: number;
  };
}

// 🎯 **AI STATE**
export interface AIState {
  models_available: string[];
  current_model: string;
  usage_quota: {
    used: number;
    limit: number;
    reset_date: string;
  };
  content_generation_queue: ContentGenerationJob[];
}

export interface ContentGenerationJob {
  id: string;
  prompt: string;
  content_type: ContentBlockType;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ContentBlock;
  error?: string;
  created_at: string;
  completed_at?: string;
}

// 💬 **COMMENTS & SUPPORT**
export interface Comment {
  id: string;
  content_id: string;
  author_pubkey: string;
  content: string;
  parent_id?: string; // For threaded comments
  created_at: string;
  updated_at?: string;
  likes: number;
  lightning_tips: number;
}

export interface Support {
  id: string;
  content_id: string;
  supporter_pubkey: string;
  amount_sats: number;
  message?: string;
  anonymous: boolean;
  created_at: string;
  lightning_invoice: string;
  paid: boolean;
}

// 🗂️ **VERSION CONTROL**
export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  content_snapshot: Omit<ContentItem, 'id' | 'created_at' | 'updated_at'>;
  created_at: string;
  created_by: string;
  change_summary: string;
}

// 🏪 **CMS STATE**
export interface CMSState {
  // Content Management
  content_items: ContentItem[];
  current_content: ContentItem | null;
  content_versions: ContentVersion[];

  // Media Assets
  media_assets: MediaAsset[];

  // Social Features
  comments: Comment[];
  supports: Support[];

  // Editor State
  editor_state: EditorState;
  ai_state: AIState;

  // Loading & Error States
  loading: boolean;
  error: string | null;
}

// 🎨 **COMPONENT PROPS**
export interface ContentEditorProps {
  contentId?: string;
  mode?: 'create' | 'edit' | 'view';
  onSave?: (content: ContentItem) => void;
  onPublish?: (content: ContentItem) => void;
  autoSaveInterval?: number;
  showAI?: boolean;
  collaborative?: boolean;
}

export interface SimpleContentEditorProps {
  onSave?: () => void;
  onPublish?: () => void;
  autoSaveInterval?: number;
}

// 🔧 **UTILITY TYPES**
export type ContentCreationData = Pick<
  ContentItem,
  'title' | 'description' | 'content_blocks' | 'status' | 'visibility' | 'tags'
>;

export type ContentUpdateData = Partial<
  Pick<ContentItem, 'title' | 'description' | 'content_blocks' | 'status' | 'visibility' | 'tags'>
>;

export type MediaUploadData = Pick<MediaAsset, 'filename' | 'size' | 'mime_type'> & {
  file: File;
};
