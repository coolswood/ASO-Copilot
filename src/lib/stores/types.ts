export type StorePlatform = "IOS" | "ANDROID";

export interface StoreListing {
  platform: StorePlatform;
  storeId: string;
  name: string;
  developer: string | null;
  iconUrl: string | null;
  url: string | null;
  category: string | null;
  rating: number | null;
  ratingCount: number | null;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  screenshotCount: number | null;
  screenshotUrls: string[];
  languageCount: number | null;
  version: string | null;
  lastUpdated: Date | null;
}

export interface StoreSearchHit {
  storeId: string;
  name: string;
  iconUrl: string | null;
  developer: string | null;
}

export interface StoreReview {
  externalId: string;
  rating: number | null;
  title: string | null;
  text: string | null;
  authorName: string | null;
  version: string | null;
  reviewedAt: Date | null;
}
