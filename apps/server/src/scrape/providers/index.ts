import { javbusProvider, stubProvider } from "./javbus.js";
import { jav321Provider } from "./jav321.js";
import { javdbProvider } from "./javdb.js";
import { dmmProvider } from "./dmm.js";
import { libredmmProvider } from "./libredmm.js";
import { airavProvider } from "./airav.js";
import { airavIoProvider } from "./airav_io.js";
import { iqqtvProvider } from "./iqqtv.js";
import { avsexProvider } from "./avsex.js";
import { freejavbtProvider } from "./freejavbt.js";
import { caribProvider } from "./carib.js";
import { avmooProvider } from "./avmoo.js";
import { javdayProvider } from "./javday.js";
import { javlibraryProvider } from "./javlibrary.js";
import { avsoxProvider } from "./avsox.js";
import { fc2Provider } from "./fc2.js";
import { fc2HubProvider } from "./fc2_hub.js";
import { fd2ppvProvider } from "./fd2ppv.js";
import { madouProvider } from "./madou.js";
import { madouquProvider } from "./madouqu.js";
import { hscangkuProvider } from "./hscangku.js";
import { xiaoHuangShuProvider } from "./xiao_huang_shu.js";
import { lulubarProvider } from "./lulubar.js";
import { r18devProvider } from "./r18dev.js";
import { sevenmmtvProvider } from "./sevenmmtv.js";
import { avbaseProvider } from "./avbase.js";
import { mgstageProvider } from "./mgstage.js";
import { missAvProvider } from "./miss_av.js";
import { njavProvider } from "./njav.js";
import { theporndbProvider } from "./theporndb.js";
import { avheatProvider } from "./avheat.js";
import {
  listCatalogIds,
  SOURCE_CATALOG,
  type ProviderCatalogRow,
} from "./catalog.js";
import type { ScrapeProvider, SourceId } from "../types.js";

const registry = new Map<SourceId, ScrapeProvider>();

const IMPLEMENTED: Partial<Record<SourceId, ScrapeProvider>> = {
  javbus: javbusProvider,
  jav321: jav321Provider,
  dmm: dmmProvider,
  libredmm: libredmmProvider,
  javdb: javdbProvider,
  airav: airavProvider,
  airav_io: airavIoProvider,
  iqqtv: iqqtvProvider,
  freejavbt: freejavbtProvider,
  avsex: avsexProvider,
  r18dev: r18devProvider,
  sevenmmtv: sevenmmtvProvider,
  avbase: avbaseProvider,
  mgstage: mgstageProvider,
  miss_av: missAvProvider,
  njav: njavProvider,
  carib: caribProvider,
  avmoo: avmooProvider,
  javday: javdayProvider,
  javlibrary: javlibraryProvider,
  avsox: avsoxProvider,
  fc2: fc2Provider,
  fc2_hub: fc2HubProvider,
  fd2ppv: fd2ppvProvider,
  madou: madouProvider,
  madouqu: madouquProvider,
  hscangku: hscangkuProvider,
  xiao_huang_shu: xiaoHuangShuProvider,
  lulubar: lulubarProvider,
  theporndb: theporndbProvider,
  avheat: avheatProvider,
};

function ensureRegistry() {
  if (registry.size) return;
  for (const entry of SOURCE_CATALOG) {
    const impl = IMPLEMENTED[entry.id];
    if (entry.implemented && impl) {
      registry.set(entry.id, impl);
    } else {
      registry.set(entry.id, stubProvider(entry.id));
    }
  }
}

export function getProvider(id: SourceId): ScrapeProvider | undefined {
  ensureRegistry();
  return registry.get(id);
}

export function listProviders(): SourceId[] {
  ensureRegistry();
  return [...registry.keys()];
}

export function registerProvider(provider: ScrapeProvider): void {
  ensureRegistry();
  registry.set(provider.id, provider);
}

export function listProviderCatalog(disabledIds: string[] = []): ProviderCatalogRow[] {
  ensureRegistry();
  const disabled = new Set(disabledIds);
  const registered = new Set(registry.keys());
  return SOURCE_CATALOG.map((entry) => ({
    ...entry,
    registered: registered.has(entry.id),
    enabled: !disabled.has(entry.id),
  }));
}

export function isProviderEnabled(id: SourceId, disabledIds: string[] = []): boolean {
  return !disabledIds.includes(id);
}

export { listCatalogIds, SOURCE_CATALOG };
