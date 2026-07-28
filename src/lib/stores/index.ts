import * as appstore from "./appstore";
import * as playstore from "./playstore";
import type { StoreListing, StorePlatform, StoreSearchHit, StoreReview } from "./types";

export type { StoreListing, StorePlatform, StoreSearchHit, StoreReview };

export async function getListing(
  platform: StorePlatform,
  storeId: string,
  country = "us",
): Promise<StoreListing | null> {
  return platform === "IOS"
    ? appstore.lookupByBundleId(storeId, country)
    : playstore.lookupByAppId(storeId, country);
}

export async function search(
  platform: StorePlatform,
  term: string,
  country = "us",
  limit = 30,
): Promise<StoreSearchHit[]> {
  return platform === "IOS"
    ? appstore.searchApps(term, country, limit)
    : playstore.searchApps(term, country, limit);
}

export async function findRank(
  platform: StorePlatform,
  term: string,
  storeId: string,
  country = "us",
): Promise<number | null> {
  return platform === "IOS"
    ? appstore.findRank(term, storeId, country)
    : playstore.findRank(term, storeId, country);
}

export async function analyzeTerm(
  platform: StorePlatform,
  term: string,
  country = "us",
): Promise<{ resultCount: number; topAuthority: number }> {
  return platform === "IOS"
    ? appstore.analyzeTerm(term, country)
    : playstore.analyzeTerm(term, country);
}

export async function autocompleteSuggestions(
  platform: StorePlatform,
  term: string,
  country = "us",
): Promise<string[]> {
  return platform === "IOS"
    ? appstore.autocompleteSuggestions(term, country)
    : playstore.autocompleteSuggestions(term, country);
}

export async function fetchReviews(
  platform: StorePlatform,
  storeId: string,
  country = "us",
): Promise<StoreReview[]> {
  return platform === "IOS" ? appstore.fetchReviews(storeId, country) : playstore.fetchReviews(storeId, country);
}
