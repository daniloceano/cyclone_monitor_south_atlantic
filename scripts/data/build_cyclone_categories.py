#!/usr/bin/env python3
"""
Build the per-cyclone taxonomy index.

    data/processed/cyclone_categories.json

Why this exists
---------------
The monitor needs to answer "which track_ids are subtropical cyclones?" without
touching per-timestep data, and it must answer it with the categories the
upstream classification actually defines. That is a different question from
"what was this cyclone's structure at 06Z", which lives in the per-timestep
columns cps_class / cps_state of the consolidated base.

Keeping the two apart is the point. A cyclone's category is a property of the
whole system; its phase-space state is a property of an hour. Deriving the
former from the latter - by, say, taking the commonest per-timestep label - is
exactly the mistake the upstream pipeline's persistence gate and identification
guards exist to prevent, and this script never does it. Every category here is
copied from the per-cyclone classification as exported.

Structure
---------
    {
      "taxonomies": {
        "cps": {
          "name": ..., "grain": "per_cyclone", "source_ref": "cyclone_phase_space",
          "categories": {
            "EC": {"label": ..., "kind": "identified", "group": "Extratropical",
                   "count": 2926, "track_ids": [...]},
            ...
          }
        }
      }
    }

Keyed by taxonomy so a second one - the planned energy-pattern classification -
becomes a sibling entry rather than a restructure.

The 'kind' field
----------------
Copied verbatim from the export's class_kind:

    identified      passed the 36 h persistence gate AND the identification
                    guards (genesis band, ocean fraction, warm-seclusion test)
    characteristic  showed a dominant structure that never lasted 36 h. NOT
                    guarded, and NOT a claim that the cyclone is of that type
    undetermined    no dominant structure
    no_data         no CPS series

A consumer that groups a 'characteristic' class under the corresponding
identified class is asserting something the classification refuses to assert.
Filter on 'kind', never on a string prefix of the category code.

Run from project root:
    conda run -n paper_energy_patterns python scripts/data/build_cyclone_categories.py
------------------------------------------------------------------------------
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CYCLONES_PARQUET = PROJECT_ROOT / "data" / "processed" / "cyclones.parquet"
OUTPUT = PROJECT_ROOT / "data" / "processed" / "cyclone_categories.json"

# Display grouping for the CPS categories. The '*_like' classes are deliberately
# NOT folded into their base class: see the module docstring.
CPS_GROUPS: dict[str, str] = {
    "EC": "Extratropical",
    "SC": "Subtropical",
    "TC": "Tropical",
    "ST": "Subtropical transition",
    "SD": "Subtropical decay",
    "TT": "Tropical transition",
    "ET": "Extratropical transition",
    "EC_like": "Not sustained (<36 h)",
    "SC_like": "Not sustained (<36 h)",
    "TC_like": "Not sustained (<36 h)",
    "undetermined": "Undetermined",
    "no_cps_data": "No CPS data",
}


def build_cps_taxonomy(cyc: pd.DataFrame) -> dict:
    """Build the CPS taxonomy block from the per-cyclone table."""
    required = {"cps_phase_class", "cps_class_kind", "track_id"}
    missing = required - set(cyc.columns)
    if missing:
        raise SystemExit(
            f"x cyclones.parquet is missing {sorted(missing)}; "
            "re-run scripts/data/merge_wind.py"
        )

    categories: dict[str, dict] = {}
    for code, grp in cyc.groupby("cps_phase_class", sort=False):
        kinds = grp["cps_class_kind"].dropna().unique()
        if len(kinds) > 1:
            raise SystemExit(
                f"x category {code!r} carries multiple class_kind values {list(kinds)}; "
                "refusing to guess - inspect the CPS export"
            )
        labels = grp["cps_phase_class_label"].dropna().unique() \
            if "cps_phase_class_label" in grp.columns else []

        categories[str(code)] = {
            "label": str(labels[0]) if len(labels) else str(code),
            "kind": str(kinds[0]) if len(kinds) else "unknown",
            "group": CPS_GROUPS.get(str(code), "Other"),
            "count": int(len(grp)),
            "track_ids": sorted(int(t) for t in grp["track_id"]),
        }

    # Most populous first, so the index reads naturally.
    categories = dict(sorted(categories.items(), key=lambda kv: -kv[1]["count"]))

    return {
        "name": "Cyclone Phase Space classification",
        "description": (
            "Per-cyclone structural category in the Hart (2003) Cyclone Phase "
            "Space, after a 36 h persistence gate and the subtropical/tropical "
            "identification guards. Distinct from the per-timestep cps_class "
            "and cps_state columns of the consolidated base."
        ),
        "grain": "per_cyclone",
        "source_ref": "cyclone_phase_space",
        "kind_meaning": {
            "identified": "passed the 36 h persistence gate and the identification guards",
            "characteristic": "dominant structure that never lasted 36 h; a description, not an identification",
            "undetermined": "no dominant structure",
            "no_data": "no CPS series for this cyclone",
        },
        "categories": categories,
    }


def main() -> int:
    if not CYCLONES_PARQUET.exists():
        print(f"x {CYCLONES_PARQUET} not found. Run scripts/data/merge_wind.py first.")
        return 1

    cyc = pd.read_parquet(CYCLONES_PARQUET)
    print(f"  Loaded {len(cyc):,} cyclones from {CYCLONES_PARQUET.name}")

    taxonomies = {"cps": build_cps_taxonomy(cyc)}

    payload = {
        "generated": datetime.now().isoformat(timespec="seconds"),
        "n_cyclones": int(len(cyc)),
        "taxonomies": taxonomies,
    }

    OUTPUT.write_text(json.dumps(payload, indent=2))

    print(f"\n  Taxonomies: {', '.join(taxonomies)}")
    for tname, tax in taxonomies.items():
        total = sum(c["count"] for c in tax["categories"].values())
        print(f"\n  {tname}  ({total:,} cyclones)")
        for code, c in tax["categories"].items():
            print(f"    {code:<14s} {c['count']:>5,}  {c['kind']:<15s} {c['group']}")
        if total != len(cyc):
            print(f"  ! category counts sum to {total:,} but the table has {len(cyc):,}")
            return 1

    print(f"\nok Written -> {OUTPUT}  ({OUTPUT.stat().st_size / 1e3:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
