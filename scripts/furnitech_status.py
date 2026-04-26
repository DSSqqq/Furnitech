"""
Печать краткого статуса проекта и ссылок на документацию.
Использование из корня репозитория:  py scripts/furnitech_status.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

if sys.platform == "win32" and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent


def read_head(path: Path, max_lines: int = 40) -> str:
    if not path.is_file():
        return f"(нет файла: {path.name})\n"
    lines = path.read_text(encoding="utf-8").splitlines()
    return "\n".join(lines[:max_lines]) + ("\n" if len(lines) > max_lines else "")


def main() -> int:
    print("=== Furnitech — статус для handoff ===\n")
    for name in ("PROGRESS.md", "PLAN.md", "ARCHITECTURE.md"):
        p = ROOT / "docs" / name
        print(f"--- docs/{name} ---\n")
        print(read_head(p, 50))
    print("Дальше: читайте полный `docs/PROGRESS.md` и обновляйте его в конце сессии.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
