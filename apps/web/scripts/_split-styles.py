"""One-off: split styles.css into styles/ modules."""
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src" / "styles.css"
ROOT = Path(__file__).resolve().parents[1] / "src" / "styles"

MARKERS: list[tuple[int, str]] = [
    (1, "base/tokens-and-reset.css"),
    (121, "layout/shell.css"),
    (444, "components/buttons.css"),
    (571, "components/alerts.css"),
    (708, "components/stats.css"),
    (765, "components/panels.css"),
    (824, "pages/settings-config.css"),
    (1786, "components/tags-chips.css"),
    (1829, "components/create-job-modal.css"),
    (2047, "components/folder-picker.css"),
    (2214, "components/status-badges.css"),
    (2252, "components/tables.css"),
    (2332, "pages/live.css"),
    (2444, "pages/sources.css"),
    (3168, "utilities/responsive.css"),
    (3424, "layout/s1-layout.css"),
    (3509, "pages/dashboard.css"),
    (3877, "pages/settings-panels.css"),
    (6455, "pages/record-detail.css"),
    (7923, "pages/records-misc.css"),
    (8037, "pages/source-subpages.css"),
    (8363, "pages/recognition.css"),
    (8496, "pages/priority.css"),
    (8910, "pages/files.css"),
    (9302, "pages/jobs.css"),
    (10061, "pages/records.css"),
    (11167, "pages/kind-tasks.css"),
    (11372, "components/cover-crop-and-actors.css"),
]


def main() -> None:
    lines = SRC.read_text(encoding="utf-8").splitlines(keepends=True)
    ROOT.mkdir(parents=True, exist_ok=True)
    imports: list[str] = []
    for i, (start, name) in enumerate(MARKERS):
        end = MARKERS[i + 1][0] - 1 if i + 1 < len(MARKERS) else len(lines)
        chunk = "".join(lines[start - 1 : end])
        out = ROOT / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(chunk, encoding="utf-8")
        imports.append(name)
        print(f"{name}: {end - start + 1} lines")
    index_lines = [f'@import "./{n}";' for n in imports]
    (ROOT / "index.css").write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(imports)} modules -> styles/index.css")


if __name__ == "__main__":
    main()
