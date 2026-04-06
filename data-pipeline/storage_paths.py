from __future__ import annotations

import os
from pathlib import Path

DEFAULT_SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / "database" / "weather.duckdb"


def derive_ledger_path(snapshot_path: Path) -> Path:
    if snapshot_path.suffix == "":
        return Path(f"{snapshot_path}.sqlite3")

    return snapshot_path.with_suffix(".sqlite3")


def resolve_snapshot_path() -> Path:
    return Path(os.environ.get("WEATHER_LEDGER_DB_PATH", DEFAULT_SNAPSHOT_PATH))


def resolve_ledger_path() -> Path:
    return Path(
        os.environ.get(
            "WEATHER_LEDGER_LEDGER_PATH",
            derive_ledger_path(resolve_snapshot_path()),
        )
    )
