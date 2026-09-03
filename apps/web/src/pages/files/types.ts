import type { NotifyFn } from "../../lib/notify";
import type { FileRow, KindRow } from "../../types";

export type FilesPageProps = {
  kinds: KindRow[];
  loading: boolean;
  onChanged: () => void;
  onNavigate: (path: string) => void;
  notify: NotifyFn;
};

export type CreateJobContext = {
  folder?: string;
  kindIds?: string[];
};

export const FILE_PAGE_SIZE = 20;
export const FILE_INDEX_PAGE_SIZE = 200;

/** 文件管理页默认打开的目录（相对项目根） */
export const FILES_DEFAULT_BROWSE_PATH = "media/本地索引";

/** 本地索引树下、已启用且绑定了来源的分区 */
export function indexableKindIds(kinds: KindRow[]): string[] {
  const root = FILES_DEFAULT_BROWSE_PATH.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return kinds
    .filter((k) => {
      if (!k.enabled || !k.sourceRoot?.trim()) return false;
      const source = k.sourceRoot.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      return source === root || source.startsWith(`${root}/`);
    })
    .map((k) => k.id);
}

export type BrowseFileRow =
  | { kind: "indexed"; file: FileRow }
  | { kind: "local"; relative: string; file_name: string; file_mtime: number; file_size: number };
