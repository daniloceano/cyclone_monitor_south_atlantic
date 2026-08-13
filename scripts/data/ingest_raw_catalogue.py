#!/usr/bin/env python3
"""
Ingest the raw Gramcianinov catalogue as "track only" cyclones.

Input:
    data/raw/gramcianinov_catalogue/ERA5/ExSAt/ff_cyc_ExSAt_era5_YYYYMM.csv
    (fetch with scripts/data/download_full_catalogue.py)
    data/processed/tracks_south_atlantic_consolidated.csv

Output:
    data/processed/tracks_raw_catalogue.csv
    data/processed/tracks_raw_catalogue.txt   (validation report)

Why this is not a simple concatenation
--------------------------------------
The raw catalogue is a DIFFERENT TRACKING VINTAGE from the monitor's own
dataset. Their track_id numbering does not agree: of 4,072 IDs present in both,
zero refer to the same storm. Joining on track_id would pair unrelated cyclones.

So this script does two things instead:

1. DEDUPLICATION BY GEOMETRY. Positions agree to ~1e-6 degrees when both
   vintages tracked the same physical system, so cyclones are paired on
   (date, lat, lon) rounded to 3 decimals (~100 m). A catalogue track is
   considered already-processed when at least MATCH_THRESHOLD of its timesteps
   coincide with a single monitor track. Those are dropped: the monitor already
   shows them, with the full diagnostic stack.

2. ID RE-NAMESPACING. The surviving tracks keep their identity in `source_id`
   but receive `track_id = source_id + ID_OFFSET`, moving them into a disjoint
   numeric range so they cannot collide with the monitor's primary key.
   19810002 (catalogue) becomes 119810002.

Output schema
-------------
    track_id    int    namespaced ID (source_id + 100,000,000)
    source_id   int    original catalogue ID (YYYYNNNN)
    date        datetime (UTC, 1-hourly)
    lon         float  degrees, converted from the catalogue's 0–360 convention
    lat         float  degrees
    vor42       float  filtered T42 vorticity used for tracking, stored positive

No energetics, no lifecycle phase, no genesis region, no phase space — that is
the whole point of the "track only" level.

Run from project root:
    python scripts/data/ingest_raw_catalogue.py

Options:
    --match-threshold F   Fraction of timesteps that must coincide for a
                          catalogue track to count as already processed (0.5)
    --dry-run             Report the numbers without writing anything

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import glob
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CATALOGUE_DIR = PROJECT_ROOT / "data" / "raw" / "gramcianinov_catalogue" / "ERA5" / "ExSAt"
MAIN_CSV = PROJECT_ROOT / "data" / "processed" / "tracks_south_atlantic_consolidated.csv"
OUTPUT_FILE = PROJECT_ROOT / "data" / "processed" / "tracks_raw_catalogue.csv"
REPORT_FILE = OUTPUT_FILE.with_suffix(".txt")

# The catalogue CSVs carry no header.
CATALOGUE_COLS = ["track_id", "date", "lon360", "lat", "vor42"]

# Namespacing offset. Chosen so that a namespaced ID stays readable: 19810002
# becomes 119810002, i.e. the original is recoverable by subtraction and the
# leading 1 marks the track-only level at a glance.
ID_OFFSET = 100_000_000

# Position rounding for the geometric match (~100 m at these latitudes).
MATCH_DECIMALS = 3
DEFAULT_MATCH_THRESHOLD = 0.5


def load_catalogue() -> pd.DataFrame:
    """Read every monthly file and normalise the coordinate convention."""
    files = sorted(glob.glob(str(CATALOGUE_DIR / "*.csv")))
    if not files:
        print(f"\n✗ No catalogue files found in {CATALOGUE_DIR}")
        print("  Run: python scripts/data/download_full_catalogue.py")
        sys.exit(1)

    print(f"  Reading {len(files)} monthly files ...")
    df = pd.concat(
        [pd.read_csv(f, header=None, names=CATALOGUE_COLS) for f in files],
        ignore_index=True,
    )
    df["date"] = pd.to_datetime(df["date"])

    # The catalogue stores longitude in 0–360; the monitor uses -180–180.
    df["lon"] = np.where(df["lon360"] > 180, df["lon360"] - 360, df["lon360"])
    df = df.drop(columns=["lon360"])

    print(f"  {len(df):,} timesteps, {df['track_id'].nunique():,} tracks, "
          f"{df['date'].min():%Y-%m-%d} → {df['date'].max():%Y-%m-%d}")
    return df


def _spatiotemporal_key(df: pd.DataFrame) -> pd.Series:
    """Key identifying a cyclone position in space and time."""
    return (
        (df["date"].astype("int64") // 10**9).astype(str)
        + "_" + df["lat"].round(MATCH_DECIMALS).astype(str)
        + "_" + df["lon"].round(MATCH_DECIMALS).astype(str)
    )


def find_already_processed(cat: pd.DataFrame, threshold: float) -> tuple[set, pd.DataFrame]:
    """
    Identify catalogue tracks that the monitor already carries.

    Returns (set of catalogue track_ids to drop, pairing table for the report).
    """
    print("\n  Loading the monitor's catalogue for comparison ...")
    mon = pd.read_csv(MAIN_CSV, usecols=["track_id", "date", "lon", "lat"])
    mon["date"] = pd.to_datetime(mon["date"])
    print(f"  {len(mon):,} timesteps, {mon['track_id'].nunique():,} tracks")

    print("\n  Matching on (date, lat, lon) ...")
    cat_k = pd.DataFrame({"k": _spatiotemporal_key(cat), "cat_id": cat["track_id"]})
    mon_k = pd.DataFrame({"k": _spatiotemporal_key(mon), "mon_id": mon["track_id"]})

    joined = cat_k.merge(mon_k, on="k", how="inner")
    print(f"  {len(joined):,} timesteps coincide")

    if joined.empty:
        return set(), pd.DataFrame(columns=["cat_id", "mon_id", "n", "frac"])

    # For each catalogue track, the monitor track it overlaps most
    pairs = joined.groupby(["cat_id", "mon_id"]).size().reset_index(name="n")
    best = pairs.sort_values("n", ascending=False).drop_duplicates("cat_id")

    cat_len = cat.groupby("track_id").size()
    best["frac"] = best["n"] / best["cat_id"].map(cat_len)

    drop = set(best.loc[best["frac"] >= threshold, "cat_id"])

    print(f"  catalogue tracks with any overlap      : {len(best):,}")
    print(f"  ... reaching the {threshold:.0%} threshold          : {len(drop):,}  [dropped as already processed]")
    print(f"  ... below it (kept as track-only)      : {len(best) - len(drop):,}")

    same_id = int((best["cat_id"] == best["mon_id"]).sum())
    print(f"  pairs that happen to share an ID       : {same_id:,}  "
          f"← confirms the numbering schemes differ")

    return drop, best


def build_report(cat: pd.DataFrame, raw: pd.DataFrame, drop: set,
                 best: pd.DataFrame, threshold: float, elapsed: float) -> str:
    r = []
    r.append("=" * 70)
    r.append("Raw Catalogue Ingestion — Validation Report")
    r.append("=" * 70)
    r.append(f"Generated : {datetime.now():%Y-%m-%d %H:%M:%S}")
    r.append(f"Elapsed   : {elapsed:.1f} s")
    r.append("")
    r.append("─" * 70)
    r.append("Source")
    r.append("─" * 70)
    r.append("  Gramcianinov et al., Mendeley DOI 10.17632/kwcvfr52hp.4 (v4)")
    r.append("  Subset: ERA5 / ExSAt (extratropical South Atlantic)")
    r.append(f"  Timesteps read : {len(cat):,}")
    r.append(f"  Tracks read    : {cat['track_id'].nunique():,}")
    r.append(f"  Period         : {cat['date'].min():%Y-%m-%d} → {cat['date'].max():%Y-%m-%d}")
    r.append("")
    r.append("─" * 70)
    r.append("Deduplication against the monitor's catalogue")
    r.append("─" * 70)
    r.append("  The two datasets are DIFFERENT TRACKING VINTAGES and their")
    r.append("  track_id numbering does not agree, so pairing is done on")
    r.append(f"  (date, lat, lon) rounded to {MATCH_DECIMALS} decimals, requiring")
    r.append(f"  >= {threshold:.0%} of a catalogue track's timesteps to coincide.")
    r.append("")
    r.append(f"  Catalogue tracks with any overlap  : {len(best):,}")
    r.append(f"  Dropped as already processed       : {len(drop):,}")
    r.append(f"  Retained as track-only             : {raw['track_id'].nunique():,}")
    if len(best):
        same_id = int((best['cat_id'] == best['mon_id']).sum())
        r.append(f"  Matched pairs sharing the same ID  : {same_id:,}")
        r.append("    (near-zero is expected and confirms the renumbering)")
    r.append("")
    r.append("─" * 70)
    r.append("Output")
    r.append("─" * 70)
    r.append(f"  Timesteps : {len(raw):,}")
    r.append(f"  Tracks    : {raw['track_id'].nunique():,}")
    if len(raw):
        r.append(f"  Period    : {raw['date'].min():%Y-%m-%d} → {raw['date'].max():%Y-%m-%d}")
        r.append(f"  ID range  : {raw['track_id'].min()} .. {raw['track_id'].max()}")
        r.append(f"  Offset    : source_id + {ID_OFFSET:,}")
        r.append(f"  lon       : {raw['lon'].min():.2f} .. {raw['lon'].max():.2f}")
        r.append(f"  lat       : {raw['lat'].min():.2f} .. {raw['lat'].max():.2f}")
        r.append(f"  vor42     : {raw['vor42'].min():.3f} .. {raw['vor42'].max():.3f}")
    r.append("")
    r.append("─" * 70)
    r.append("Caveats")
    r.append("─" * 70)
    r.append("  • These tracks come from the 2020 Mendeley vintage of the TRACK")
    r.append("    run. The monitor's processed cyclones come from a later vintage")
    r.append("    (the record's README points to ftp://masterftp.iag.usp.br/EXWAV")
    r.append("    for updated tracks). The two are NOT the same tracking dataset.")
    r.append("")
    r.append("  • The catalogue ends 2020-01-05 while the monitor runs to")
    r.append("    2021-01-07, so 2020 and 2021 carry almost no track-only cyclones.")
    r.append("")
    r.append("  • Deduplication is geometric and therefore imperfect at the margin:")
    r.append("    a system tracked with a different length or a slightly shifted")
    r.append("    centre between vintages may fall below the threshold and appear")
    r.append("    as track-only despite already being present as processed.")
    r.append("")
    r.append("=" * 70)
    return "\n".join(r)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ingest the raw Gramcianinov catalogue as track-only cyclones"
    )
    parser.add_argument("--match-threshold", type=float, default=DEFAULT_MATCH_THRESHOLD,
                        metavar="F",
                        help="Fraction of timesteps that must coincide (default: 0.5)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report the numbers without writing anything")
    args = parser.parse_args()

    print("=" * 70)
    print("Ingest Raw Catalogue as Track-Only Cyclones")
    print("=" * 70)
    print(f"\nStarted : {datetime.now():%Y-%m-%d %H:%M:%S}")
    if args.dry_run:
        print("Mode    : DRY RUN")
    print()

    t0 = datetime.now()

    if not MAIN_CSV.exists():
        print(f"✗ Monitor catalogue not found: {MAIN_CSV}")
        print("  Run: python scripts/data/run_pipeline.py")
        return 1

    print("─" * 70)
    print("Step 1 — Read the raw catalogue")
    print("─" * 70)
    cat = load_catalogue()

    print("\n" + "─" * 70)
    print("Step 2 — Drop cyclones the monitor already carries")
    print("─" * 70)
    drop, best = find_already_processed(cat, args.match_threshold)

    raw = cat[~cat["track_id"].isin(drop)].copy()

    print("\n" + "─" * 70)
    print("Step 3 — Re-namespace IDs")
    print("─" * 70)
    raw = raw.rename(columns={"track_id": "source_id"})
    raw["track_id"] = raw["source_id"] + ID_OFFSET
    raw = raw[["track_id", "source_id", "date", "lon", "lat", "vor42"]]
    raw = raw.sort_values(["track_id", "date"]).reset_index(drop=True)
    print(f"  {raw['track_id'].nunique():,} tracks offset by +{ID_OFFSET:,}")
    print(f"  ID range: {raw['track_id'].min()} .. {raw['track_id'].max()}")

    # Guard: the namespaced IDs must not collide with the monitor's
    mon_ids = set(pd.read_csv(MAIN_CSV, usecols=["track_id"])["track_id"].unique())
    collisions = mon_ids & set(raw["track_id"].unique())
    if collisions:
        print(f"  ✗ {len(collisions)} ID collisions after offsetting — aborting")
        return 1
    print("  ✓ No collisions with the monitor's IDs")

    elapsed = (datetime.now() - t0).total_seconds()
    report = build_report(cat, raw, drop, best, args.match_threshold, elapsed)

    if not args.dry_run:
        print("\n" + "─" * 70)
        print("Step 4 — Write output")
        print("─" * 70)
        OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
        raw.to_csv(OUTPUT_FILE, index=False)
        size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
        print(f"  {OUTPUT_FILE.name}  ({size_mb:.1f} MB)")
        REPORT_FILE.write_text(report)
        print(f"  {REPORT_FILE.name}")

    print("\n")
    print(report)

    if args.dry_run:
        print("\n(dry run — nothing written)")
    else:
        print("\nNext step: regenerate the web app JSON")
        print("  python scripts/preprocess_data.py")

    return 0


if __name__ == "__main__":
    sys.exit(main())
