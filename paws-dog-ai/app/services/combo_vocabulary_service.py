"""
Combo vocabulary service.

Provides the canonical set of trick combos with their per-combo thresholds.

Loading order:
  1. In-process cache (populated on first call)
  2. Supabase trick_combos table (if DB is configured)
  3. Hardcoded defaults (always available, used when DB is unavailable)

Tests call invalidate_cache() to reset state between cases.
"""

from __future__ import annotations

from app.models.combo_models import TrickComboEntry
from app.utils.logging import log_warn


# ---------------------------------------------------------------------------
# Hardcoded defaults
# ---------------------------------------------------------------------------

_DEFAULTS: dict[str, TrickComboEntry] = {
    "sit_then_down": TrickComboEntry(
        slug="sit_then_down",
        display_name="Sit then Down",
        trick_sequence=["sit", "down"],
        active=True,
        difficulty=2,
    ),
    "sit_spin_down": TrickComboEntry(
        slug="sit_spin_down",
        display_name="Sit, Spin, then Down",
        trick_sequence=["sit", "spin", "down"],
        active=True,
        difficulty=3,
    ),
    "paw_then_sit": TrickComboEntry(
        slug="paw_then_sit",
        display_name="Paw then Sit",
        trick_sequence=["paw", "sit"],
        active=True,
        difficulty=2,
    ),
    "stand_spin_sit": TrickComboEntry(
        slug="stand_spin_sit",
        display_name="Stand, Spin, then Sit",
        trick_sequence=["stand", "spin", "sit"],
        active=True,
        difficulty=4,
    ),
}


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_cache: dict[str, TrickComboEntry] | None = None


def invalidate_cache() -> None:
    """Clear the in-process cache. Intended for tests and hot-reload."""
    global _cache
    _cache = None


def _ensure_loaded() -> dict[str, TrickComboEntry]:
    global _cache
    if _cache is not None:
        return _cache

    try:
        loaded = _load_from_db()
        _cache = loaded if loaded else dict(_DEFAULTS)
    except Exception as exc:  # noqa: BLE001
        log_warn(
            "combo_vocabulary_service",
            "db_load_failed_using_defaults",
            error=str(exc),
        )
        _cache = dict(_DEFAULTS)

    return _cache


def _load_from_db() -> dict[str, TrickComboEntry] | None:
    from app.config import settings  # noqa: PLC0415

    if not settings.supabase_configured:
        return None

    from app.services.supabase_service import get_supabase  # noqa: PLC0415

    client = get_supabase()
    rows = client.table("trick_combos").select("*").execute().data or []

    if not rows:
        return None

    result: dict[str, TrickComboEntry] = {}
    for row in rows:
        slug = row.get("slug", "")
        if not slug:
            continue
        default = _DEFAULTS.get(slug, TrickComboEntry(
            slug=slug,
            display_name=slug.replace("_", " ").title(),
            trick_sequence=[],
        ))
        sequence = row.get("trick_sequence")
        if isinstance(sequence, str):
            import json  # noqa: PLC0415
            sequence = json.loads(sequence)
        if not isinstance(sequence, list):
            sequence = default.trick_sequence

        result[slug] = TrickComboEntry(
            id=str(row.get("id", "")),
            slug=slug,
            display_name=row.get("display_name", default.display_name),
            trick_sequence=sequence,
            active=bool(row.get("active", default.active)),
            difficulty=int(row.get("difficulty", default.difficulty)),
            min_step_confidence=float(
                row.get("min_step_confidence", default.min_step_confidence)),
            min_combo_score=float(
                row.get("min_combo_score", default.min_combo_score)),
            min_segment_duration_ms=int(
                row.get("min_segment_duration_ms", default.min_segment_duration_ms)),
            smooth_window_frames=int(
                row.get("smooth_window_frames", default.smooth_window_frames)),
        )

    # Fill gaps with defaults not yet in DB.
    for slug, entry in _DEFAULTS.items():
        if slug not in result:
            result[slug] = entry

    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_combo_config(slug: str) -> TrickComboEntry | None:
    """Return the combo entry for a slug, or None if unknown."""
    return _ensure_loaded().get(slug)


def get_all_combos() -> list[TrickComboEntry]:
    return list(_ensure_loaded().values())


def get_active_combos() -> list[TrickComboEntry]:
    return [e for e in _ensure_loaded().values() if e.active]


def is_known_combo(slug: str) -> bool:
    return slug in _ensure_loaded()


def is_active_combo(slug: str) -> bool:
    entry = _ensure_loaded().get(slug)
    return entry is not None and entry.active


def active_combo_slugs() -> list[str]:
    return [e.slug for e in get_active_combos()]
