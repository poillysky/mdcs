export {
  normalizeProviderAccess,
  PROVIDER_GROUP_LABELS,
  PROVIDER_GROUP_ORDER,
  type NormalizedProviderAccess,
  type ProviderAccess,
  type ProviderCatalogEntry,
  type ProviderCatalogRow,
  type ProviderGroup,
  type SourceTier,
} from "./catalogTypes.js";

import type { SourceId } from "../types.js";
import { SOURCE_CATALOG } from "./sourceMaster.js";
import type { ProviderCatalogEntry } from "./catalogTypes.js";

export { SOURCE_CATALOG } from "./sourceMaster.js";

export function getCatalogEntry(id: SourceId): ProviderCatalogEntry | undefined {
  return SOURCE_CATALOG.find((e) => e.id === id);
}

export function listCatalogIds(): SourceId[] {
  return SOURCE_CATALOG.map((e) => e.id);
}
