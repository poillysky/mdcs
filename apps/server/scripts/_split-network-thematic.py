from pathlib import Path

NET = Path(r"e:/Mdcs/apps/server/src/scrape/network")


def split_download() -> None:
    path = NET / "download" / "index.ts"
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    # lines[21:137] = limits + host gate (0-based, after blank line following imports)
    rest = "".join(lines[137:])
    body = "".join(lines[21:137])
    for a, b in [
        ("const MAX_HTML_BYTES", "export const MAX_HTML_BYTES"),
        ("const MAX_IMAGE_BYTES", "export const MAX_IMAGE_BYTES"),
        ("function hostOf", "export function hostOf"),
        ("async function drainBody", "export async function drainBody"),
        ("function contentLengthTooLarge", "export function contentLengthTooLarge"),
        ("function markDirectSkip", "export function markDirectSkip"),
        ("function shouldSkipDirect", "export function shouldSkipDirect"),
        ("async function withHostGate", "export async function withHostGate"),
    ]:
        body = body.replace(a, b, 1)

    (NET / "download" / "hostGate.ts").write_text(
        'import { hostNeedsFlare } from "../flaresolverr.js";\n\n' + body,
        encoding="utf-8",
        newline="\n",
    )

    head = "".join(lines[:21])
    if "hostNeedsFlare" not in rest:
        head = head.replace("  hostNeedsFlare,\n", "")

    insert = (
        "import {\n"
        "  MAX_HTML_BYTES,\n"
        "  MAX_IMAGE_BYTES,\n"
        "  contentLengthTooLarge,\n"
        "  drainBody,\n"
        "  hostOf,\n"
        "  markDirectSkip,\n"
        "  shouldSkipDirect,\n"
        "  withHostGate,\n"
        '} from "./hostGate.js";\n\n'
    )
    path.write_text(head + insert + rest, encoding="utf-8", newline="\n")
    print("download ok", (head + insert + rest).count("\n") + 1)


def split_site_mirror() -> None:
    path = NET / "siteMirror" / "index.ts"
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    # 1-based markers from probe:
    # type 31-48, originOf 73, normalizeOrigin 93, defaultLooksLike 123, profiles 130-431, getSiteMirror 432
    # 0-based: type 30, originOf 72, normalize 92, defaultLooks 122, profiles 129, get 431

    type_block = "".join(lines[30:48])  # export type SiteMirrorProfile { ... };
    # find exact type end
    brace = 0
    type_start = 30
    type_end = type_start
    for i in range(type_start, len(lines)):
        brace += lines[i].count("{") - lines[i].count("}")
        if i > type_start and brace <= 0:
            type_end = i + 1
            break
    type_block = "".join(lines[type_start:type_end])

    origin_start = next(i for i, l in enumerate(lines) if l.startswith("function originOf"))
    norm_start = next(i for i, l in enumerate(lines) if l.startswith("export function normalizeOrigin"))
    brace = 0
    norm_end = norm_start
    for i in range(norm_start, len(lines)):
        brace += lines[i].count("{") - lines[i].count("}")
        if i > norm_start and brace <= 0:
            norm_end = i + 1
            break
    helpers = "".join(lines[origin_start:norm_end])
    helpers = helpers.replace("function originOf", "export function originOf", 1)
    helpers = helpers.replace("function hostOf", "export function hostOf", 1)

    dl_start = next(i for i, l in enumerate(lines) if l.startswith("function defaultLooksLike"))
    brace = 0
    dl_end = dl_start
    for i in range(dl_start, len(lines)):
        brace += lines[i].count("{") - lines[i].count("}")
        if i > dl_start and brace <= 0:
            dl_end = i + 1
            break
    default_fn = "".join(lines[dl_start:dl_end]).replace(
        "function defaultLooksLike", "export function defaultLooksLike", 1
    )

    prof_start = next(i for i, l in enumerate(lines) if "export const SITE_MIRROR_PROFILES" in l)
    get_start = next(i for i, l in enumerate(lines) if l.startswith("export function getSiteMirrorProfile"))
    profiles_const = "".join(lines[prof_start:get_start])

    profiles_ts = (
        '/** Site mirror seed profiles (pure data + normalizers). */\n\n'
        'import { looksBlockedHtml } from "../flaresolverr.js";\n\n'
        + type_block
        + "\n"
        + helpers
        + "\n"
        + default_fn
        + "\n"
        + profiles_const
    )
    (NET / "siteMirror" / "profiles.ts").write_text(profiles_ts, encoding="utf-8", newline="\n")

    skip = set(range(type_start, type_end))
    skip |= set(range(origin_start, norm_end))
    skip |= set(range(dl_start, dl_end))
    skip |= set(range(prof_start, get_start))

    remaining_lines = [l for i, l in enumerate(lines) if i not in skip]
    remaining = "".join(remaining_lines)
    if "looksBlockedHtml(" not in remaining and "looksBlockedHtml" not in remaining.split("from")[0]:
        # strip unused import if body no longer calls it
        if "looksBlockedHtml(" not in remaining:
            remaining = remaining.replace("  looksBlockedHtml,\n", "")

    import_block = (
        "import {\n"
        "  SITE_MIRROR_PROFILES,\n"
        "  defaultLooksLike,\n"
        "  hostOf,\n"
        "  normalizeOrigin,\n"
        "  originOf,\n"
        "  type SiteMirrorProfile,\n"
        '} from "./profiles.js";\n'
    )
    needle = 'from "../../providers/catalog.js";\n'
    if needle not in remaining:
        raise SystemExit("catalog import missing")
    remaining = remaining.replace(needle, needle + "\n" + import_block, 1)
    remaining += (
        "\nexport { SITE_MIRROR_PROFILES, normalizeOrigin, originOf, hostOf };\n"
        "export type { SiteMirrorProfile };\n"
    )
    path.write_text(remaining, encoding="utf-8", newline="\n")
    print("siteMirror ok", remaining.count("\n") + 1, "profiles", profiles_ts.count("\n") + 1)


if __name__ == "__main__":
    split_download()
    split_site_mirror()
