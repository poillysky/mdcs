import type { NotifyFn } from "../../lib/notify";
import type { SettingsSaveActions } from "../../hooks/useDirtyBaseline";
import type { ProviderCatalogRow, ScrapeConfig } from "../../types";

export type ScrapeConfigPanelProps = {
  notify: NotifyFn;
  variant?: "project" | "sources" | "providers" | "fields";
  embedded?: boolean;
  value?: ScrapeConfig;
  catalog?: ProviderCatalogRow[];
  onChange?: (next: ScrapeConfig, catalog?: ProviderCatalogRow[]) => void;
  onActionsChange?: (actions: SettingsSaveActions | null) => void;
};
