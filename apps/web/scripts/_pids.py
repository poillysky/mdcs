import subprocess

pids = [12124, 17232, 4036, 5948]
lines = []
for pid in pids:
    try:
        r = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").CommandLine",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        lines.append(f"{pid}\t{(r.stdout or r.stderr).strip()}")
    except Exception as e:
        lines.append(f"{pid}\t{e}")
Path = __import__("pathlib").Path
Path(r"e:/Mdcs/apps/web/scripts/_pids.out.txt").write_text("\n".join(lines), encoding="utf-8")
print("wrote", len(lines), "lines")
