import { ActorDetailView } from "../../components/ActorDetailView";
import { ActorsEmbyPanel } from "./ActorsEmbyPanel";
import { ActorsLocalPanel } from "./ActorsLocalPanel";
import { parseActorName, parseActorsTab } from "./actorsDisplay";
import type { ActorsPageProps } from "./types";

export function ActorsPage({ path, locationSearch, onNavigate, notify }: ActorsPageProps) {
  const tab = parseActorsTab(path);
  const detailName = tab === "local" ? parseActorName(locationSearch) : "";

  if (detailName) {
    return (
      <ActorDetailView
        name={detailName}
        onClose={() => onNavigate("/actors")}
        onNavigate={onNavigate}
        notify={notify}
      />
    );
  }

  return (
    <div className="actors-page">
      <div className="settings-tabs actors-tabs" role="tablist" aria-label="演员管理分类">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "local"}
          className={`settings-tab${tab === "local" ? " active" : ""}`}
          onClick={() => onNavigate("/actors")}
        >
          刮削缓存
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "emby"}
          className={`settings-tab${tab === "emby" ? " active" : ""}`}
          onClick={() => onNavigate("/actors/emby")}
        >
          Emby 刮削
        </button>
      </div>
      {tab === "emby" ? (
        <ActorsEmbyPanel notify={notify} />
      ) : (
        <ActorsLocalPanel onNavigate={onNavigate} notify={notify} />
      )}
    </div>
  );
}
