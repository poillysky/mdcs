export type ActorRow = {
  name: string;
  workCount: number;
  kinds: string[];
  codes: string[];
  lastScrapedAt: number | null;
  profileStatus?: "scraped" | "missing";
  mappedName?: string;
  avatarUrl?: string | null;
  overview?: string;
  profileScrapedAt?: number | null;
  imageScrapedAt?: number | null;
  birthday?: string;
  birthplace?: string;
  providerIds?: Record<string, string>;
  tags?: string[];
};
