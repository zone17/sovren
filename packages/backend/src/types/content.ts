export interface ContentBlock {
  id?: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface ContentCollection {
  id: string;
  name: string;
  items: ContentItem[];
  [key: string]: any;
}

export interface ContentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  content?: string;
  creatorId?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface ContentSeries {
  id: string;
  title: string;
  episodes: SeriesEpisode[];
  [key: string]: any;
}

export interface MediaAsset {
  id: string;
  url: string;
  type: string;
  size?: number;
  mimeType?: string;
  [key: string]: any;
}

export interface PremiumContent {
  id: string;
  contentId: string;
  price: number;
  currency?: string;
  accessType?: string;
  [key: string]: any;
}

export interface SeriesEpisode {
  id: string;
  title: string;
  order: number;
  content?: string;
  [key: string]: any;
}
