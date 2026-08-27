import { useCallback, useEffect, useState } from "react";
import { ArrowLeftIcon } from "@heroicons/react/20/solid";
import { fetchActorDetail, fetchFiles, scrapeActors } from "../api";
import { kindLabel } from "../lib/labels";
import { resolveCoverImageSrc, resolveProxiedImageSrc } from "../lib/metaDisplay";
import type { ActorRow, FileRow } from "../types";
import type { NotifyFn } from "../lib/notify";
import { LazyCover } from "./LazyCover";

type Props = {
  name: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

type WorkItem = {
  code: string;
  file: FileRow | null;
};

function formatActorTime(ms?: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function actorInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

/** 优先本地 poster/封面缓存；无文件时按 kind+番号兜底 */
function workCoverSrc(code: string, file: FileRow | null, kinds: string[]): string | null {
  if (file?.id) return resolveCoverImageSrc(null, file);
  if (file?.cover_url) return resolveProxiedImageSrc(file.cover_url);
  const kind = kinds[0];
  if (kind && code) {
    return `/api/files/cover/${encodeURIComponent(kind)}/${encodeURIComponent(code)}`;
  }
  return null;
}

export function ActorDetailView({ name, onClose, onNavigate, notify }: Props) {
  const [actor, setActor] = useState<ActorRow | null>(null);
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActorDetail(name);
      setActor(data.actor);
      const codes = data.actor.codes ?? [];
      const items: WorkItem[] = [];
      for (const code of codes.slice(0, 30)) {
        try {
          const files = await fetchFiles({ q: code, pageSize: 1 });
          const file =
            files.files.find((f) => (f.code || "").toUpperCase() === code.toUpperCase()) ??
            files.files[0] ??
            null;
          items.push({ code, file });
        } catch {
          items.push({ code, file: null });
        }
      }
      setWorks(items);
    } catch (e) {
      notify("error", e, "加载演员详情失败");
      setActor(null);
    } finally {
      setLoading(false);
    }
  }, [name, notify]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function runScrape() {
    setScraping(true);
    try {
      const result = await scrapeActors({ names: [name], forceImage: true });
      const item = result.results[0];
      if (item && !item.ok) {
        notify("error", item.error || "刮削失败", "刮削演员失败");
      } else {
        notify("ok", `已刮削 ${name}`);
      }
      await loadDetail();
    } catch (e) {
      notify("error", e, "刮削演员失败");
    } finally {
      setScraping(false);
    }
  }

  const scraped = actor?.profileStatus === "scraped";

  return (
    <div className="actor-detail">
      <nav className="actor-detail-nav" aria-label="演员详情导航">
        <button type="button" className="record-detail-nav-back" onClick={onClose}>
          <ArrowLeftIcon aria-hidden />
          返回列表
        </button>
        <button
          type="button"
          className="btn sm primary solid"
          disabled={loading || scraping}
          onClick={() => void runScrape()}
        >
          {scraping ? "刮削中…" : scraped ? "重新刮削" : "刮削档案"}
        </button>
      </nav>

      {loading ? (
        <div className="actor-detail-empty">加载中…</div>
      ) : !actor ? (
        <div className="actor-detail-empty">未找到该演员</div>
      ) : (
        <>
          <header className="actor-detail-head">
            {actor.avatarUrl ? (
              <img
                key={actor.avatarUrl}
                className="actor-detail-photo"
                src={actor.avatarUrl}
                alt=""
              />
            ) : (
              <span className="actors-avatar actors-avatar--lg" aria-hidden>
                {actorInitial(actor.name)}
              </span>
            )}
            <div className="actor-detail-head-text">
              <div className="actor-detail-name-row">
                <h1 className="actor-detail-name">{actor.name}</h1>
                <span
                  className={`actor-detail-status${scraped ? " is-scraped" : " is-missing"}`}
                >
                  {scraped ? "已刮削" : "未刮削"}
                </span>
              </div>
              <p className="actor-detail-meta">
                {actor.workCount} 部作品 ·{" "}
                {actor.kinds.map((k) => kindLabel(k) || k).join("、") || "—"}
              </p>
              <p className="actor-detail-meta actor-detail-meta--dim">
                档案刮削：{formatActorTime(actor.profileScrapedAt)} · 作品缓存：
                {formatActorTime(actor.lastScrapedAt)}
              </p>
            </div>
          </header>

          {scraped ? (
            <section className="actor-detail-section">
              <h2 className="actor-detail-section-title">本地档案</h2>
              <div className="actor-detail-profile-card">
                <dl className="actor-detail-profile">
                  <div className="actor-detail-profile-block actor-detail-profile-block--wide">
                    <dt>简介</dt>
                    <dd>
                      {actor.overview?.trim() && !/^映射名\s*[:：]/.test(actor.overview.trim())
                        ? actor.overview.split("\n").map((line, i) => (
                            <span key={i}>
                              {i > 0 ? <br /> : null}
                              {line}
                            </span>
                          ))
                        : "—"}
                    </dd>
                  </div>
                  <div className="actor-detail-profile-block">
                    <dt>生日</dt>
                    <dd>{actor.birthday?.trim() || "—"}</dd>
                  </div>
                  <div className="actor-detail-profile-block">
                    <dt>出生地</dt>
                    <dd>{actor.birthplace?.trim() || "—"}</dd>
                  </div>
                  <div className="actor-detail-profile-block actor-detail-profile-block--wide">
                    <dt>标签</dt>
                    <dd>
                      {actor.tags?.length ? (
                        <ul className="actor-detail-tags">
                          {actor.tags.map((tag) => (
                            <li key={tag} className="actor-detail-tag">
                              {tag}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="actor-detail-profile-block actor-detail-profile-block--wide">
                    <dt>外链</dt>
                    <dd>
                      {(() => {
                        const links = [
                          {
                            href: actor.providerIds?.["minnano-av"],
                            label: "minnano-av",
                          },
                          {
                            href: actor.providerIds?.Url || actor.providerIds?.url,
                            label: "详情",
                          },
                          {
                            href: actor.providerIds?.Twitter
                              ? `https://x.com/${String(actor.providerIds.Twitter).replace(/^@/, "")}`
                              : "",
                            label: "Twitter",
                          },
                        ].filter((x) => x.href) as Array<{ href: string; label: string }>;
                        if (!links.length) return "—";
                        return (
                          <ul className="actor-detail-links">
                            {links.map((link) => (
                              <li key={link.href}>
                                <a
                                  className="actor-detail-link"
                                  href={link.href}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {link.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : (
            <div className="actor-detail-banner" role="note">
              尚未独立刮削演员档案。可点击右上角「刮削档案」从 minnano-av
              拉取简介/生日，并从 Gfriends 拉取头像。
            </div>
          )}

          <section className="actor-detail-section">
            <h2 className="actor-detail-section-title">
              关联番号
              {works.length ? (
                <span className="actor-detail-section-count">{works.length}</span>
              ) : null}
            </h2>
            {works.length ? (
              <ul className="actor-detail-works">
                {works.map((w) => {
                  const title =
                    w.file?.titleZh?.trim() ||
                    w.file?.title?.trim() ||
                    "暂无标题";
                  const href = w.file
                    ? `/records?id=${w.file.id}`
                    : `/records?q=${encodeURIComponent(w.code)}`;
                  const cover = workCoverSrc(w.code, w.file, actor.kinds);
                  return (
                    <li key={w.code}>
                      <button
                        type="button"
                        className="actor-detail-work"
                        onClick={() => onNavigate(href)}
                      >
                        <LazyCover
                          src={cover}
                          alt=""
                          className="actor-detail-work-cover"
                        />
                        <span className="actor-detail-work-body">
                          <span className="actor-detail-work-code">{w.code}</span>
                          <span className="actor-detail-work-title">{title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="actor-detail-empty-inline">暂无关联番号</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
