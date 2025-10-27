// Enhanced Content Types for Elite CMS - 2024 Elite Standards
export interface ContentBlock {
  id: string;
  type:
    | 'paragraph'
    | 'heading'
    | 'image'
    | 'video'
    | 'audio'
    | 'code'
    | 'quote'
    | 'lightning-payment'
    | 'nostr-embed'
    | 'ai-generated'
    | 'interactive-chart'
    | 'embedded-app';
  content: ContentBlockMetadata;
  metadata?: ContentBlockMetadata;
  ai_metadata?: {
    generated_by?: 'gpt-4' | 'claude-3' | 'gemini-pro' | 'custom-model';
    generation_prompt?: string;
    confidence_score?: number; // 0-100
    human_reviewed?: boolean;
    auto_improvement_enabled?: boolean;
  };
  version?: number;
  parent_block_id?: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  ipfs_hash?: string;
  arweave_id?: string;
  created_at: string;
  creator_pubkey: string;
  alt_text?: string;
  caption?: string;
  ai_analysis?: {
    auto_generated_alt?: string;
    content_description?: string;
    tags?: string[];
    accessibility_score?: number;
    optimization_suggestions?: string[];
  };
  processing_status?: 'uploading' | 'processing' | 'ready' | 'failed';
  thumbnails?: {
    small: string;
    medium: string;
    large: string;
  };
}

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description?: string;
  content_blocks: ContentBlock[];
  status: 'draft' | 'published' | 'archived' | 'scheduled' | 'under_review';
  visibility: 'public' | 'private' | 'subscribers' | 'supporters' | 'token-gated';
  creator_pubkey: string;
  ipfs_hash?: string;
  arweave_id?: string;
  lightning_invoice?: string;
  price_sats?: number;
  tags: string[];
  featured_image?: MediaAsset;
  created_at: string;
  updated_at: string;
  published_at?: string;
  scheduled_at?: string;
  version: number;
  parent_version_id?: string;
  nostr_event_id?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  support_count: number;
  total_earned_sats: number;
  ai_enhancement?: {
    seo_optimized?: boolean;
    readability_score?: number; // 0-100
    engagement_prediction?: number; // 0-100
    auto_translation_enabled?: boolean;
    available_languages?: string[];
    content_quality_score?: number; // 0-100
    suggested_improvements?: string[];
  };
  collaboration?: {
    editors: string[]; // NOSTR pubkeys
    reviewers: string[]; // NOSTR pubkeys
    edit_permissions: 'owner_only' | 'editors' | 'public_suggestions';
    review_status?: 'pending' | 'approved' | 'needs_changes';
    last_reviewed_by?: string;
    last_reviewed_at?: string;
  };
  nft_metadata?: {
    collection_id?: string;
    token_id?: string;
    mint_transaction?: string;
    ownership_verified?: boolean;
  };
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  content_blocks: ContentBlock[];
  ipfs_hash?: string;
  created_at: string;
  change_summary?: string;
}

export interface Creator {
  pubkey: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  lightning_address?: string;
  website?: string;
  social_links: Record<string, string>;
  content_count: number;
  follower_count: number;
  total_earnings_sats: number;
  created_at: string;
}

export interface ContentComment {
  id: string;
  content_id: string;
  commenter_pubkey: string;
  content: string;
  parent_id?: string;
  nostr_event_id?: string;
  created_at: string;
  like_count: number;
}

export interface ContentSupport {
  id: string;
  content_id: string;
  supporter_pubkey: string;
  amount_sats: number;
  message?: string;
  lightning_preimage: string;
  created_at: string;
}

export interface CMSState {
  content_items: ContentItem[];
  current_content: ContentItem | null;
  media_assets: MediaAsset[];
  content_versions: ContentVersion[];
  comments: ContentComment[];
  supports: ContentSupport[];
  loading: boolean;
  error: string | null;
  editor_state: {
    is_editing: boolean;
    auto_save_enabled: boolean;
    last_saved: string | null;
    ai_assistant_enabled: boolean;
    collaborative_mode: boolean;
    current_collaborators: string[];
    suggested_improvements: ContentImprovement[];
  };
  ai_state?: {
    models_available: AIModel[];
    current_model?: string;
    usage_quota?: {
      used: number;
      limit: number;
      reset_date: string;
    };
    content_generation_queue: ContentGenerationJob[];
  };
}

export interface ContentPublishOptions {
  status: 'draft' | 'published' | 'scheduled';
  visibility: 'public' | 'private' | 'subscribers' | 'supporters' | 'token-gated';
  price_sats?: number;
  tags: string[];
  publish_to_nostr: boolean;
  store_on_ipfs: boolean;
  store_on_arweave: boolean;
  featured_image_id?: string;
  scheduled_at?: string;
  ai_optimization?: {
    auto_seo: boolean;
    auto_translation: boolean;
    target_languages?: string[];
    readability_optimization: boolean;
  };
  nft_minting?: {
    enabled: boolean;
    collection_id?: string;
    royalty_percentage?: number;
    limited_edition?: {
      max_supply: number;
      pricing_tiers: Array<{
        quantity: number;
        price_sats: number;
      }>;
    };
  };
}

export interface ContentFilter {
  creator_pubkey?: string;
  status?: ContentItem['status'];
  visibility?: ContentItem['visibility'];
  tags?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  search_query?: string;
  sort_by: 'created_at' | 'updated_at' | 'view_count' | 'like_count' | 'total_earned_sats';
  sort_order: 'asc' | 'desc';
}

export interface ContentAnalytics {
  content_id: string;
  views_today: number;
  views_week: number;
  views_month: number;
  views_total: number;
  earnings_today_sats: number;
  earnings_week_sats: number;
  earnings_month_sats: number;
  earnings_total_sats: number;
  top_referrers: Array<{ source: string; count: number }>;
  engagement_rate: number;
  avg_read_time: number;
  geographic_distribution: Array<{
    country: string;
    views: number;
    earnings_sats: number;
  }>;
  device_breakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  social_shares: {
    nostr: number;
    twitter: number;
    other: number;
  };
  ai_insights?: {
    performance_prediction: number; // 0-100
    optimization_suggestions: string[];
    best_publishing_times: string[];
    recommended_price_sats?: number;
    content_longevity_score: number; // 0-100
  };
}

// New interfaces for 2024 elite features
export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  capabilities: ('text-generation' | 'image-analysis' | 'translation' | 'seo-optimization')[];
  cost_per_token: number;
  max_tokens: number;
  specialized_for?: string[];
}

export interface ContentGenerationJob {
  id: string;
  type: 'full-content' | 'block-enhancement' | 'translation' | 'seo-optimization';
  prompt: string;
  target_block_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  result?: ContentBlock | ContentImprovement | string | null;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface ContentImprovement {
  id: string;
  type: 'readability' | 'seo' | 'engagement' | 'accessibility' | 'translation';
  target_block_id?: string;
  current_content: string;
  suggested_content: string;
  confidence_score: number; // 0-100
  rationale: string;
  auto_apply: boolean;
  human_review_required: boolean;
}

export interface UniversalEditorConfig {
  mode: 'traditional' | 'headless' | 'hybrid';
  ai_assistance_level: 'disabled' | 'suggestions' | 'auto-enhance' | 'full-ai';
  collaboration_enabled: boolean;
  real_time_preview: boolean;
  auto_save_interval: number; // seconds
  supported_block_types: ContentBlock['type'][];
  customization: {
    theme: 'light' | 'dark' | 'auto';
    layout: 'sidebar' | 'bottom-drawer' | 'floating';
    shortcuts_enabled: boolean;
  };
}

export interface ContentWorkflow {
  id: string;
  name: string;
  stages: WorkflowStage[];
  auto_transitions: boolean;
  ai_assistance: boolean;
  required_roles: string[];
}

export interface WorkflowStage {
  id: string;
  name: string;
  description: string;
  required_actions: ('review' | 'edit' | 'approve' | 'ai-check')[];
  assignees: string[]; // NOSTR pubkeys
  deadline?: string;
  auto_advance_conditions?: {
    time_elapsed?: number; // hours
    approval_threshold?: number; // percentage
    ai_quality_score?: number; // 0-100
  };
}

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'quote'
  | 'lightning-payment'
  | 'nostr-embed'
  | 'ai-generated'
  | 'interactive-chart';

// Fix: Replace `any` with proper typed interfaces
export interface ContentBlockMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ContentBlockStyle {
  [key: string]: string | number | boolean | null | undefined;
}

export interface AIContentAnalysis {
  readabilityScore: number;
  seoScore: number;
  engagementPrediction: number;
  improvements: ContentImprovement[];
  wordCount: number;
  estimatedReadTime: number;
  keywordDensity: Record<string, number>;
}

export interface PerformanceAnalytics {
  [key: string]: string | number | boolean | null | undefined;
}
