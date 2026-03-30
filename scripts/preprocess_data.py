#!/usr/bin/env python3
"""
Preprocessing script: CSV → web-optimized JSON artefacts.

Run from the project root:
    python3 scripts/preprocess_data.py

Input:
    data/raw/tracks_SAt_filtered_with_energetics.csv

Output:
    site/public/data/summary.json          — one entry per track (metadata + simplified line coords)
    site/public/data/details/{year}.json   — full timestep data per year, loaded on demand by the web app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Intensity measure
-----------------
vor42 (relative vorticity at 400 hPa, ×10⁻⁵ s⁻¹) is used as the intensity proxy.
It is the only intensity-related variable that is 100% complete in the dataset.
Higher vor42 → more intense cyclone. The intensity of each track is its
maximum vor42 over all timesteps.

Genesis region assignment
-------------------------
Based on the cyclogenesis regions defined in:
    Gramcianinov, C. B., Hodges, K. I., & Camargo, R. D. (2019).
    The properties and genesis environments of South Atlantic cyclones.
    Climate Dynamics, 53(7), 4115–4140. https://doi.org/10.1007/s00382-019-04778-7

The regions are assigned from the genesis position (first timestep of each track)
using geographic bounding boxes that approximate the cyclogenesis hotspots
identified in that study.

Lifecycle phase labels
-----------------------
Phase labels shown in the web app (intensification, mature, decay, etc.) are
derived heuristically in this script from the vor42 time series, as a proxy
for the lifecycle characterization performed by the Cyclophaser tool:

    de Souza, D. C., da Dias, P. L. S., Gramcianinov, C. B., & de Camargo, R. (2025).
    Cyclophaser: A Python package for detecting extratropical cyclone life cycles.
    Journal of Open Source Software, 10(108), 7363.
    https://doi.org/10.21105/joss.07363

Results from applying Cyclophaser to this dataset are presented in:

    Couto de Souza, D., da Silva Dias, P. L., Gramcianinov, C. B.,
    da Silva, M. B. L., & de Camargo, R. (2024).
    New perspectives on South Atlantic storm track through an automatic method
    for detecting extratropical cyclones' lifecycle.
    International Journal of Climatology, 44(10), 3568–3588.
    https://doi.org/10.1002/joc.8566

For rigorous lifecycle analysis, use Cyclophaser directly rather than the
heuristic derivation in this script.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import pandas as pd
import numpy as np
import json
import math
from pathlib import Path
from datetime import datetime

# ─── Paths ────────────────────────────────────────────────────────────────────
# Script must be run from the project root (cyclone_monitor_south_atlantic/).
INPUT_CSV   = Path("data/raw/tracks_SAt_filtered_with_energetics.csv")
OUTPUT_DIR  = Path("site/public/data")
DETAILS_DIR = OUTPUT_DIR / "details"

# ─── Precision ────────────────────────────────────────────────────────────────
COORD_DECIMALS      = 2   # ~1 km — sufficient for trajectory visualisation
VOR42_DECIMALS      = 4
ENERGETICS_DECIMALS = 3
MAX_COORDS_PER_TRACK = 120


# ─── Genesis Region ───────────────────────────────────────────────────────────
def assign_genesis_region(lat: float, lon: float) -> str:
    """
    Classify the cyclone genesis region from its first (genesis) position.

    Regions approximate the cyclogenesis hotspots identified in:
        Gramcianinov et al. (2019), Climate Dynamics, 53, 4115–4140.

    Bounding boxes (approximate):

        SESA     Southeastern South America  lat ∈ [−45, −25], lon ∈ [−70, −48]
                 The most active region; includes the La Plata Basin and
                 Río de la Plata estuary area.

        ARG      Argentina / Patagonia       lat < −45, lon ∈ [−75, −50]
                 Continental and near-coastal southern Argentina / Patagonia.

        SEC      SE Brazil Coast             lat ∈ [−35, −20], lon ∈ [−55, −35]
                 Coastal baroclinic zone off southeastern Brazil.

        SUB      Subtropical South Atlantic  lat ∈ [−35, −20], lon > −35
                 Open-ocean subtropical region east of the Brazilian coast.

        OOC      Open Ocean (mid-lat)        lat < −45, lon > −50
                 Mid-latitude open South Atlantic.

        OTHER    Indian Ocean / Other        lon > +20
                 Genesis points east of Africa; outside the primary domain.
    """
    if lon > 20:
        return "Indian Ocean / Other"
    if lon < -50 and lat < -45:
        return "Argentina / Patagonia"
    if -70 <= lon <= -48 and -45 <= lat <= -25:
        return "SE South America"
    if -55 <= lon <= -35 and -35 <= lat <= -20:
        return "SE Brazil Coast"
    if lon > -35 and -35 <= lat <= -20:
        return "Subtropical South Atlantic"
    if lon > -50 and lat < -45:
        return "Open South Atlantic"
    return "Open South Atlantic"


# ─── Lifecycle Phase ─────────────────────────────────────────────────────────
def compute_phases(vor42_series: pd.Series) -> list:
    """
    Heuristic lifecycle phase labels derived from the track's vor42 time series.

    This is an approximation of the phases detected by Cyclophaser
    (de Souza et al., JOSS 2025 / IJC 2024). For rigorous lifecycle
    analysis, run Cyclophaser on the original tracks.

    Phase definitions:
        incipient        : first 2 timesteps (system just forming)
        intensification  : vor42 increasing, below 85 % of track maximum
        mature           : vor42 ≥ 85 % of track maximum
        decay            : vor42 decreasing, below 85 % of track maximum after peak
        dissipation      : last 2 timesteps
    """
    values = vor42_series.values
    n      = len(values)
    max_v  = float(values.max())
    max_i  = int(np.argmax(values))
    thresh = 0.85 * max_v

    phases = []
    for i, v in enumerate(values):
        if i <= 1:
            phases.append("incipient")
        elif i >= n - 2:
            phases.append("dissipation")
        elif i <= max_i and v < thresh:
            phases.append("intensification")
        elif v >= thresh:
            phases.append("mature")
        else:
            phases.append("decay")
    return phases


# ─── Helpers ─────────────────────────────────────────────────────────────────
def safe_float(value, decimals: int = 3):
    if value is None:
        return None
    try:
        f = float(value)
        if math.isnan(f):
            return None
        return round(f, decimals)
    except (TypeError, ValueError):
        return None


def quantile_label(value: float, thresholds: dict) -> str:
    if value >= thresholds["p95"]:
        return "top 5%"
    if value >= thresholds["p90"]:
        return "top 10%"
    if value >= thresholds["p75"]:
        return "top 25%"
    if value >= thresholds["p50"]:
        return "top 50%"
    return "bottom 50%"


def downsample_coords(lons, lats, max_pts: int = MAX_COORDS_PER_TRACK):
    n = len(lons)
    if n <= max_pts:
        indices = list(range(n))
    else:
        step    = n / max_pts
        indices = [int(i * step) for i in range(max_pts)]
        if indices[-1] != n - 1:
            indices[-1] = n - 1
    return [
        [round(float(lons[i]), COORD_DECIMALS), round(float(lats[i]), COORD_DECIMALS)]
        for i in indices
    ]


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now():%H:%M:%S}] Reading {INPUT_CSV} …")
    df = pd.read_csv(INPUT_CSV, parse_dates=["date"])
    df = df.rename(columns={"lon vor": "lon", "lat vor": "lat"})

    n_tracks = df["track_id"].nunique()
    print(f"  {len(df):,} rows | {n_tracks:,} unique tracks")

    df["year"] = (df["track_id"] // 10000).astype(int)
    df = df.sort_values(["track_id", "date"]).reset_index(drop=True)

    # ── Quantile thresholds (track-level max vor42) ──────────────────────────
    print("  Computing intensity quantile thresholds …")
    track_max = df.groupby("track_id")["vor42"].max()
    thresholds = {
        "p25": float(track_max.quantile(0.25)),
        "p50": float(track_max.quantile(0.50)),
        "p75": float(track_max.quantile(0.75)),
        "p90": float(track_max.quantile(0.90)),
        "p95": float(track_max.quantile(0.95)),
    }
    print(f"  vor42 thresholds: { {k: round(v,3) for k,v in thresholds.items()} }")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Process tracks ───────────────────────────────────────────────────────
    print(f"  Processing {n_tracks:,} tracks …")
    summaries  = []
    year_data: dict = {}

    for i, (tid, grp) in enumerate(df.groupby("track_id", sort=False)):
        if i % 1000 == 0:
            print(f"    {i}/{n_tracks}")

        grp   = grp.reset_index(drop=True)
        first = grp.iloc[0]
        last  = grp.iloc[-1]
        year  = int(first["year"])
        n     = len(grp)

        genesis_lat = round(float(first["lat"]), COORD_DECIMALS)
        genesis_lon = round(float(first["lon"]), COORD_DECIMALS)
        lysis_lat   = round(float(last["lat"]),  COORD_DECIMALS)
        lysis_lon   = round(float(last["lon"]),  COORD_DECIMALS)

        start_dt      = first["date"]
        end_dt        = last["date"]
        genesis_month = int(start_dt.month)
        duration_h    = int((end_dt - start_dt).total_seconds() / 3600)

        genesis_region = assign_genesis_region(genesis_lat, genesis_lon)
        max_vor42      = float(grp["vor42"].max())
        q_label        = quantile_label(max_vor42, thresholds)
        coords         = downsample_coords(grp["lon"].tolist(), grp["lat"].tolist())

        summaries.append({
            "id":             int(tid),
            "year":           year,
            "month":          genesis_month,
            "start":          start_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "end":            end_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration_h":     duration_h,
            "genesis_lat":    genesis_lat,
            "genesis_lon":    genesis_lon,
            "lysis_lat":      lysis_lat,
            "lysis_lon":      lysis_lon,
            "genesis_region": genesis_region,
            "max_vor42":      round(max_vor42, VOR42_DECIMALS),
            "quantile":       q_label,
            "coords":         coords,
        })

        # Per-timestep data (loaded on demand via details/{year}.json)
        phases    = compute_phases(grp["vor42"])
        timesteps = []
        for j, row in grp.iterrows():
            ts: dict = {
                "date":  row["date"].strftime("%Y-%m-%dT%H:%M:%S"),
                "lon":   round(float(row["lon"]),   COORD_DECIMALS),
                "lat":   round(float(row["lat"]),   COORD_DECIMALS),
                "vor42": round(float(row["vor42"]), VOR42_DECIMALS),
                "phase": phases[j - grp.index[0]],
            }
            for col in ["Kz", "Ke", "Ck", "Ca", "BAe", "BKe", "Ge"]:
                v = safe_float(row.get(col), ENERGETICS_DECIMALS)
                if v is not None:
                    ts[col] = v
            timesteps.append(ts)

        if year not in year_data:
            year_data[year] = {}
        year_data[year][str(int(tid))] = {"timesteps": timesteps}

    # ── Write summary.json ───────────────────────────────────────────────────
    summary_obj = {
        "generated":   datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "total_tracks": len(summaries),
        "date_range": {
            "start": min(s["start"] for s in summaries),
            "end":   max(s["end"]   for s in summaries),
        },
        "years":    sorted({s["year"]           for s in summaries}),
        "months":   sorted({s["month"]          for s in summaries}),
        "regions":  sorted({s["genesis_region"] for s in summaries}),
        "quantile_thresholds": {k: round(v, 4) for k, v in thresholds.items()},
        "tracks": summaries,
        # Provenance metadata
        "sources": {
            "tracks": {
                "doi":   "10.17632/kwcvfr52hp.4",
                "label": "Atlantic extratropical cyclone tracks (ERA5/CFSR, 1979–2020)",
            },
            "energetics": {
                "doi":   "10.5281/zenodo.18133432",
                "label": "Semi-Lagrangian LEC diagnostics (1979–2020)",
            },
            "genesis_regions": {
                "doi":   "10.1007/s00382-019-04778-7",
                "label": "Gramcianinov et al. (2019), Climate Dynamics",
            },
            "lifecycle_phases": {
                "doi":   "10.21105/joss.07363",
                "label": "Cyclophaser — de Souza et al. (JOSS 2025); "
                         "heuristic approximation used here for display purposes",
            },
        },
    }

    out = OUTPUT_DIR / "summary.json"
    with open(out, "w") as f:
        json.dump(summary_obj, f, separators=(",", ":"))
    print(f"\n  → {out}  ({out.stat().st_size / 1e6:.1f} MB)")

    # ── Write details/{year}.json ────────────────────────────────────────────
    for year in sorted(year_data):
        out = DETAILS_DIR / f"{year}.json"
        with open(out, "w") as f:
            json.dump({"year": year, "tracks": year_data[year]}, f, separators=(",", ":"))
        print(f"  → {out}  ({out.stat().st_size / 1e6:.1f} MB)")

    print(f"\n[{datetime.now():%H:%M:%S}] Done. "
          f"{len(summaries)} tracks, {len(year_data)} year detail files.")
    print(f"  Output: {OUTPUT_DIR.resolve()}")


if __name__ == "__main__":
    main()
