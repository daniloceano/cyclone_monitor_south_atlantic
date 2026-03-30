#!/usr/bin/env python3
"""
Preprocessing script: CSV → web-optimized JSON artefacts.

Input:  data/raw/tracks_SAt_filtered_with_energetics.csv
Output:
    public/data/summary.json          — one entry per track (metadata + simplified line coords)
    public/data/details/{year}.json   — full timestep data per year, loaded on demand

Intensity measure: vor42 (relative vorticity at 400 hPa), the only intensity-related
variable that is 100% complete. Higher vor42 → more intense system.

Genesis region: derived from the first lat/lon of each track using geographic bounding
boxes based on Reboita et al. (2010) South Atlantic cyclogenesis regions.

Lifecycle phase: derived per timestep from the track's vor42 time series.
  - genesis        : first 2 timesteps
  - intensification: vor42 increasing, below 85% of track maximum
  - mature         : vor42 >= 85% of track maximum
  - decay          : vor42 decreasing, below 85% of track maximum
  - lysis          : last 2 timesteps

Quantile: each track's max_vor42 is compared against the distribution of max_vor42
across ALL tracks and assigned a label (top 5%, top 10%, top 25%, top 50%, bottom 50%).

Usage:
    python3 scripts/preprocess_data.py
"""

import pandas as pd
import numpy as np
import json
import math
from pathlib import Path
from datetime import datetime

# ─── Paths ────────────────────────────────────────────────────────────────────
INPUT_CSV = Path("data/raw/tracks_SAt_filtered_with_energetics.csv")
OUTPUT_DIR = Path("public/data")
DETAILS_DIR = OUTPUT_DIR / "details"

# ─── Precision ────────────────────────────────────────────────────────────────
COORD_DECIMALS = 2       # ~1 km precision — sufficient for trajectory maps
VOR42_DECIMALS = 4
ENERGETICS_DECIMALS = 3
MAX_COORDS_PER_TRACK = 120   # limit summary line complexity


# ─── Genesis Region ──────────────────────────────────────────────────────────
def assign_genesis_region(lat: float, lon: float) -> str:
    """
    Classify the genesis region of a cyclone from its first (genesis) position.

    Based on cyclogenesis regions defined in:
      Reboita et al. (2010), Mon. Wea. Rev., doi:10.1175/2009MWR3046.1
      Gramcianinov et al. (2019)

    Regions:
      Patagonia             — continental Argentina/southern Chile
      La Plata Basin        — subtropical South America (Río de la Plata region)
      SE Brazil Coast       — offshore southeast Brazil
      Open South Atlantic   — mid-latitude open ocean
      Subtropical Atlantic  — subtropical open ocean east of Brazil
      Indian Ocean / Other  — tracks with genesis east of 20°E
    """
    if lon > 20:
        return "Indian Ocean / Other"
    if lon < -60 and lat < -42:
        return "Patagonia"
    if -68 <= lon <= -44 and -42 <= lat <= -27:
        return "La Plata Basin"
    if -56 <= lon <= -32 and -35 <= lat <= -20:
        return "SE Brazil Coast"
    if lon > -32 and -35 <= lat <= -20:
        return "Subtropical Atlantic"
    return "Open South Atlantic"


# ─── Lifecycle Phase ─────────────────────────────────────────────────────────
def compute_phases(vor42_series: pd.Series) -> list:
    """
    Derive lifecycle phase labels for each timestep in a track.
    See module docstring for phase definitions.
    """
    values = vor42_series.values
    n = len(values)
    max_val = float(values.max())
    max_idx = int(np.argmax(values))
    threshold = 0.85 * max_val

    phases = []
    for i, v in enumerate(values):
        if i <= 1:
            phases.append("genesis")
        elif i >= n - 2:
            phases.append("lysis")
        elif i <= max_idx and v < threshold:
            phases.append("intensification")
        elif v >= threshold:
            phases.append("mature")
        else:
            phases.append("decay")
    return phases


# ─── Helpers ─────────────────────────────────────────────────────────────────
def safe_float(value, decimals: int = 3):
    """Return rounded float, or None for NaN/missing."""
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


def downsample_coords(lons, lats, max_points: int = MAX_COORDS_PER_TRACK):
    """Keep up to max_points coordinates, always including first and last."""
    n = len(lons)
    if n <= max_points:
        indices = list(range(n))
    else:
        step = n / max_points
        indices = [int(i * step) for i in range(max_points)]
        if indices[-1] != n - 1:
            indices[-1] = n - 1
    return [
        [round(float(lons[i]), COORD_DECIMALS), round(float(lats[i]), COORD_DECIMALS)]
        for i in indices
    ]


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Reading {INPUT_CSV} …")
    df = pd.read_csv(INPUT_CSV, parse_dates=["date"])

    # Normalise column names (spaces → underscores)
    df = df.rename(columns={"lon vor": "lon", "lat vor": "lat"})

    n_tracks = df["track_id"].nunique()
    print(f"  {len(df):,} rows | {n_tracks:,} unique tracks")

    # Year from track_id (format YYYYNNNN)
    df["year"] = (df["track_id"] // 10000).astype(int)

    # Sort so each group is time-ordered
    df = df.sort_values(["track_id", "date"]).reset_index(drop=True)

    # ── Compute quantile thresholds from track-level max vor42 ──────────────
    print("  Computing intensity quantile thresholds …")
    track_max_vor42 = df.groupby("track_id")["vor42"].max()
    thresholds = {
        "p25": float(track_max_vor42.quantile(0.25)),
        "p50": float(track_max_vor42.quantile(0.50)),
        "p75": float(track_max_vor42.quantile(0.75)),
        "p90": float(track_max_vor42.quantile(0.90)),
        "p95": float(track_max_vor42.quantile(0.95)),
    }
    print(f"  vor42 thresholds: { {k: round(v,3) for k,v in thresholds.items()} }")

    # ── Prepare output dirs ──────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    DETAILS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Process each track ───────────────────────────────────────────────────
    print(f"  Processing {n_tracks:,} tracks …")
    track_summaries = []
    year_details: dict = {}   # year (int) → {str(track_id): {timesteps: [...]}}

    grouped = df.groupby("track_id", sort=False)
    for i, (track_id, grp) in enumerate(grouped):
        if i % 1000 == 0:
            print(f"    {i}/{n_tracks}")

        grp = grp.reset_index(drop=True)
        n = len(grp)

        first = grp.iloc[0]
        last = grp.iloc[-1]

        year = int(first["year"])
        genesis_lat = round(float(first["lat"]), COORD_DECIMALS)
        genesis_lon = round(float(first["lon"]), COORD_DECIMALS)
        lysis_lat   = round(float(last["lat"]),  COORD_DECIMALS)
        lysis_lon   = round(float(last["lon"]),  COORD_DECIMALS)

        start_dt = first["date"]
        end_dt   = last["date"]
        genesis_month = int(start_dt.month)
        duration_h = int((end_dt - start_dt).total_seconds() / 3600)

        genesis_region = assign_genesis_region(genesis_lat, genesis_lon)
        max_vor42 = float(grp["vor42"].max())
        q_label = quantile_label(max_vor42, thresholds)

        coords = downsample_coords(grp["lon"].tolist(), grp["lat"].tolist())

        track_summaries.append({
            "id":             int(track_id),
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

        # ── Per-timestep detail (full data, for on-demand load) ─────────────
        phases = compute_phases(grp["vor42"])
        timesteps = []
        for j, row in grp.iterrows():
            ts: dict = {
                "date":  row["date"].strftime("%Y-%m-%dT%H:%M:%S"),
                "lon":   round(float(row["lon"]),   COORD_DECIMALS),
                "lat":   round(float(row["lat"]),   COORD_DECIMALS),
                "vor42": round(float(row["vor42"]), VOR42_DECIMALS),
                "phase": phases[j - grp.index[0]],
            }
            # Include energetics only when present (sparse — ~33 % of timesteps)
            for col in ["Kz", "Ke", "Ck", "Ca", "BAe", "BKe", "Ge"]:
                v = safe_float(row.get(col), ENERGETICS_DECIMALS)
                if v is not None:
                    ts[col] = v
            timesteps.append(ts)

        if year not in year_details:
            year_details[year] = {}
        year_details[year][str(int(track_id))] = {"timesteps": timesteps}

    # ── Write summary.json ───────────────────────────────────────────────────
    all_years   = sorted({s["year"]           for s in track_summaries})
    all_months  = sorted({s["month"]          for s in track_summaries})
    all_regions = sorted({s["genesis_region"] for s in track_summaries})

    summary_obj = {
        "generated":          datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "total_tracks":       len(track_summaries),
        "date_range":         {
            "start": min(s["start"] for s in track_summaries),
            "end":   max(s["end"]   for s in track_summaries),
        },
        "years":              all_years,
        "months":             all_months,
        "regions":            all_regions,
        "quantile_thresholds": {k: round(v, 4) for k, v in thresholds.items()},
        "tracks":             track_summaries,
    }

    out_summary = OUTPUT_DIR / "summary.json"
    with open(out_summary, "w") as f:
        json.dump(summary_obj, f, separators=(",", ":"))
    print(f"\n  → {out_summary}  ({out_summary.stat().st_size / 1e6:.1f} MB)")

    # ── Write details/{year}.json ────────────────────────────────────────────
    for year in sorted(year_details):
        out_detail = DETAILS_DIR / f"{year}.json"
        with open(out_detail, "w") as f:
            json.dump({"year": year, "tracks": year_details[year]},
                      f, separators=(",", ":"))
        sz = out_detail.stat().st_size / 1e6
        print(f"  → {out_detail}  ({sz:.1f} MB)")

    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Done. "
          f"{len(track_summaries)} tracks, {len(year_details)} year files.")


if __name__ == "__main__":
    main()
