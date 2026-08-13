#!/usr/bin/env python3
"""
Download the full Gramcianinov extratropical cyclone track catalogue.

    Mendeley Data DOI: 10.17632/kwcvfr52hp.4

This is the RAW tracking catalogue: every cyclone the TRACK algorithm found,
with no filtering by energetics, lifecycle detectability or genesis region. It
is far larger than the monitor's own catalogue (29,967 vs 6,789 cyclones for the
South Atlantic) and carries only position and vorticity.

How to reach the data
---------------------
The Mendeley public API does NOT enumerate a record's subfolders — listing the
root returns only README.txt, which is why the per-file download route is a dead
end. The bulk endpoint works and is what this script uses:

    https://data.mendeley.com/public-api/zip/{record}/download/{version}

It 302-redirects to a *signed* S3 URL. Hitting the S3 bucket directly returns
403, because the signature is generated per request by that endpoint.

Archive layout
--------------
    README.txt
    {ERA5,CFS}/{ExSAt,ExNAt}/ff_cyc_{area}_{source}_YYYYMM.csv

    ERA5  — ECMWF reanalysis, 1-hourly, 1979–2019
    CFS   — NCEP CFSR (to May/2011) + CFSv2 (from Apr/2011)
    ExSAt — extratropical South Atlantic     ExNAt — North Atlantic

    Monthly files hold every track that STARTS in that month, even if it ends in
    the next one.

CSV format: no header. Columns are
    track_id, date (UTC), longitude (0–360°), latitude, T42 vorticity

    The vorticity is the filtered field used for detection and tracking (Hoskins
    and Hodges 2002), not a physical vorticity, and is stored positive.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠ CRITICAL — this catalogue is a DIFFERENT TRACKING VINTAGE from the monitor's

The monitor's 6,789 cyclones do NOT share this catalogue's track_id numbering.
Measured against the current consolidated CSV:

    IDs present in both                          4,072
    ... of which the trajectories agree              0     (0.000 %)
    monitor tracks matched by GEOMETRY           5,923     (92.0 % of timesteps)
    ... matching >= 90 % of their timesteps      5,922
    ... that happen to share the same ID             5

  Example: cyclone 19810002 sits at (-57.7, -29.1) in the monitor and at
  (-68.2, -54.4) in this catalogue. Same ID, different storms.

  715 monitor cyclones inside this catalogue's period have no counterpart here
  at all, plus 151 that start after it ends (2020-01-05).

  CONSEQUENCE: never join these two datasets on track_id — it silently pairs
  unrelated cyclones. Match on (date, lat, lon) instead; positions agree to
  ~1e-6 degrees when it is genuinely the same system. Any ingestion into the
  monitor must also re-namespace the IDs, since they collide with the monitor's
  primary key.

  The README of this record points to ftp://masterftp.iag.usp.br/EXWAV for more
  up-to-date tracks; the monitor's vintage is presumably from there.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Output:
    data/raw/gramcianinov_catalogue_v4.zip          (~171 MB, kept)
    data/raw/gramcianinov_catalogue/{SOURCE}/{AREA}/*.csv

Run from project root:
    python scripts/data/download_full_catalogue.py

Options:
    --source {ERA5,CFS,both}   Reanalysis to extract (default: ERA5)
    --area {ExSAt,ExNAt,both}  Region to extract (default: ExSAt)
    --force                    Re-download even if the zip is present
    --keep-zip / --no-keep-zip Keep the archive after extraction (default: keep)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
ZIP_PATH = RAW_DIR / "gramcianinov_catalogue_v4.zip"
OUTPUT_DIR = RAW_DIR / "gramcianinov_catalogue"

MENDELEY_DOI = "10.17632/kwcvfr52hp.4"
RECORD_ID = "kwcvfr52hp"
VERSION = 4
DOWNLOAD_URL = f"https://data.mendeley.com/public-api/zip/{RECORD_ID}/download/{VERSION}"

# Verified against the record on 2026-08-13
EXPECTED_BYTES = 179_262_383
# 41 years x 12 months, per source/area combination
EXPECTED_FILES_PER_AREA = 492


def download_file(url: str, output_path: Path) -> bool:
    """Download using curl, wget, or requests (in that order)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("curl"):
        print("  Downloading with curl...")
        r = subprocess.run(
            ["curl", "-L", "--fail", "--retry", "3", "--progress-bar",
             "-o", str(output_path), url]
        )
        if r.returncode == 0:
            return True
        print(f"  curl failed with code {r.returncode}")

    if shutil.which("wget"):
        print("  Downloading with wget...")
        r = subprocess.run(["wget", "-c", "--progress=bar:force", "-O", str(output_path), url])
        if r.returncode == 0:
            return True
        print(f"  wget failed with code {r.returncode}")

    try:
        import requests
        from tqdm import tqdm

        print("  Downloading with Python requests...")
        resp = requests.get(url, stream=True, timeout=600)
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        with open(output_path, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc="  Downloading"
        ) as bar:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
                bar.update(len(chunk))
        return True
    except ImportError:
        print("  Error: requests/tqdm not available")
    except Exception as exc:
        print(f"  Error: {exc}")

    return False


def verify_zip(path: Path) -> bool:
    """Check the archive size and that it opens cleanly."""
    if not path.exists():
        print("  ✗ Archive not found")
        return False

    size = path.stat().st_size
    print(f"  Size: {size / 1e6:.1f} MB")
    if size != EXPECTED_BYTES:
        print(f"  ⚠ Size differs from the recorded {EXPECTED_BYTES:,} bytes")
        if size < EXPECTED_BYTES * 0.95:
            print("  ✗ Too small — likely truncated")
            return False

    try:
        with zipfile.ZipFile(path) as z:
            bad = z.testzip()
            if bad is not None:
                print(f"  ✗ Corrupt entry: {bad}")
                return False
            n = len([m for m in z.namelist() if m.endswith(".csv")])
            print(f"  CSV entries: {n:,}")
    except zipfile.BadZipFile as exc:
        print(f"  ✗ Not a valid zip: {exc}")
        return False

    print("  ✓ Archive valid")
    return True


def extract(path: Path, sources: list[str], areas: list[str]) -> bool:
    """Extract the requested {source}/{area} subtrees plus the README."""
    prefixes = [f"{s}/{a}/" for s in sources for a in areas]
    print(f"\n  Extracting: {', '.join(p.rstrip('/') for p in prefixes)}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        members = [m for m in names
                   if m.endswith(".csv") and any(m.startswith(p) for p in prefixes)]
        if "README.txt" in names:
            members.append("README.txt")

        if not members:
            print("  ✗ Nothing matched — check --source / --area")
            return False

        z.extractall(OUTPUT_DIR, members=members)

    print(f"  Extracted {len(members):,} entries")
    return True


def validate_extraction(sources: list[str], areas: list[str]) -> bool:
    """Confirm the extracted tree looks like the documented layout."""
    print("\n  Validating extracted tree...")
    ok = True

    for s in sources:
        for a in areas:
            d = OUTPUT_DIR / s / a
            if not d.is_dir():
                print(f"  ✗ Missing directory: {s}/{a}")
                ok = False
                continue
            csvs = sorted(d.glob("*.csv"))
            print(f"  {s}/{a}: {len(csvs):,} monthly files")
            if len(csvs) < EXPECTED_FILES_PER_AREA * 0.98:
                print(f"    ⚠ expected ~{EXPECTED_FILES_PER_AREA}")
                ok = False
            if csvs:
                # The files carry no header; a valid row has 5 comma-separated fields
                first = csvs[0].read_text().splitlines()[:1]
                if first and len(first[0].split(",")) != 5:
                    print(f"    ✗ {csvs[0].name}: expected 5 columns, got "
                          f"{len(first[0].split(','))}")
                    ok = False
                else:
                    print(f"    sample: {csvs[0].name} → {first[0] if first else '(empty)'}")

    if ok:
        print("  ✓ Validation passed")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download the full Gramcianinov cyclone track catalogue"
    )
    parser.add_argument("--source", choices=["ERA5", "CFS", "both"], default="ERA5")
    parser.add_argument("--area", choices=["ExSAt", "ExNAt", "both"], default="ExSAt")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if the archive is present")
    parser.add_argument("--no-keep-zip", dest="keep_zip", action="store_false",
                        help="Delete the archive after extraction")
    parser.set_defaults(keep_zip=True)
    args = parser.parse_args()

    sources = ["ERA5", "CFS"] if args.source == "both" else [args.source]
    areas = ["ExSAt", "ExNAt"] if args.area == "both" else [args.area]

    print("=" * 70)
    print("Download Full Cyclone Track Catalogue (Gramcianinov et al.)")
    print("=" * 70)
    print(f"\nSource:  {MENDELEY_DOI}")
    print(f"URL:     {DOWNLOAD_URL}")
    print(f"Extract: {', '.join(sources)} / {', '.join(areas)}")
    print(f"Output:  {OUTPUT_DIR}")
    print()
    print("⚠ This catalogue uses a DIFFERENT track_id numbering from the monitor's")
    print("  own dataset. Never join them on track_id — see the module docstring.")
    print()

    if args.force and ZIP_PATH.exists():
        print("  --force: removing existing archive")
        ZIP_PATH.unlink()

    if ZIP_PATH.exists():
        print(f"⚠ Archive already present: {ZIP_PATH.name}")
        if verify_zip(ZIP_PATH):
            print("\n✓ Existing archive is valid. Skipping download.")
        else:
            print("\n  Invalid. Re-downloading...")
            ZIP_PATH.unlink()

    if not ZIP_PATH.exists():
        print(f"\n[{datetime.now():%H:%M:%S}] Starting download (~171 MB)...")
        if not download_file(DOWNLOAD_URL, ZIP_PATH):
            print("\n✗ Download failed!")
            print("\nManual download instructions:")
            print(f"  1. Visit: https://data.mendeley.com/datasets/{RECORD_ID}/{VERSION}")
            print("  2. Use the 'Download All' button")
            print(f"  3. Save to: {ZIP_PATH}")
            print("  4. Re-run this script to unpack")
            return 1
        print(f"[{datetime.now():%H:%M:%S}] Download complete")
        if not verify_zip(ZIP_PATH):
            return 1

    if not extract(ZIP_PATH, sources, areas):
        return 1
    if not validate_extraction(sources, areas):
        return 1

    if not args.keep_zip:
        ZIP_PATH.unlink()
        print(f"\n  Archive removed (--no-keep-zip)")

    print("\n" + "=" * 70)
    print("✓ Catalogue ready")
    print("=" * 70)
    print(f"\n  {OUTPUT_DIR}")
    print("\nReminder: these tracks are NOT yet ingested into the monitor. Doing so")
    print("requires re-namespacing their IDs and matching against the monitor's")
    print("catalogue geometrically, not by ID.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
