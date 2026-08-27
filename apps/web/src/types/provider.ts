export type ProviderSiteConfig = {
  baseUrl: string;
  cookie: string;
  userAgent: string;
  cooldownSec: number;
  overrideRetry: boolean;
  retry: number;
  proxyUrl: string;
};
