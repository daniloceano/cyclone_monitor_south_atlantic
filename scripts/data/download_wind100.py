#!/usr/bin/env python3
"""
Download the wind100 dataset from Zenodo for the South Atlantic Cyclone Monitor.

    DOI: 10.5281/zenodo.19353037

Maximum and 99th-percentile 100 m wind speed statistics associated with
extratropical cyclones in the South Atlantic, derived from ERA5 in a Lagrangian
(cyclone-centred) reference frame, reported per quadrant (NW/NE/SW/SE).

Archive layout (important — it is NOT a flat archive)
-----------------------------------------------------
The Zenodo record holds a SINGLE file, `wind100.tar.gz`, which is a tarball of
tarballs. Two extraction passes are required:

    wind100.tar.gz
      └── {YYYY}_wind100.tar.gz          (43 of them, 1979–2021)
            └── {YYYY}_wind100/
                  ├── {track_id}_wind100_max.csv
                  └── {track_id}_wind100_p99.csv

This nesting is not described anywhere in the Zenodo record, which is why this
script exists: without it the dataset has to be unpacked by hand and the
directory layout expected by scripts/data/load_wind100.py is easy to get wrong.

Output:
    data/raw/wind100/{YYYY}_wind100/*.csv     (~15,974 files, ~483 MB)
    data/raw/wind100.tar.gz                   (~174 MB, kept for re-extraction)

Run from project root:
    python scripts/data/download_wind100.py

Options:
    --force        Re-download even if the tarball is already present
    --keep-inner   Keep the intermediate per-year tarballs (default: removed)
    --no-verify    Skip the MD5 check (not recommended)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import hashlib
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
TARBALL = RAW_DIR / "wind100.tar.gz"
OUTPUT_DIR = RAW_DIR / "wind100"
STAGE_DIR = RAW_DIR / "_wind100_stage"

# Zenodo source
ZENODO_DOI = "10.5281/zenodo.19353037"
ZENODO_RECORD_ID = "19353037"
ZENODO_FILE = "wind100.tar.gz"
DOWNLOAD_URL = f"https://zenodo.org/records/{ZENODO_RECORD_ID}/files/{ZENODO_FILE}"

# Published checksum and size (from the Zenodo record metadata)
EXPECTED_MD5 = "4eaef49b4c53b5ef81cece06680fca31"
EXPECTED_BYTES = 182_331_000

# Post-extraction expectations
EXPECTED_MIN_CSV = 15_000
EXPECTED_YEAR_DIRS = 43  # 1979–2021


def download_file(url: str, output_path: Path) -> bool:
    """Download a file using curl, wget, or requests (in that order)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("curl"):
        print("  Downloading with curl...")
        result = subprocess.run(
            ["curl", "-L", "--fail", "--retry", "3", "--progress-bar",
             "-o", str(output_path), url],
            capture_output=False,
        )
        if result.returncode == 0:
            return True
        print(f"  curl failed with code {result.returncode}")

    if shutil.which("wget"):
        print("  Downloading with wget...")
        result = subprocess.run(
            ["wget", "-c", "--progress=bar:force", "-O", str(output_path), url],
            capture_output=False,
        )
        if result.returncode == 0:
            return True
        print(f"  wget failed with code {result.returncode}")

    try:
        import requests
        from tqdm import tqdm

        print("  Downloading with Python requests...")
        response = requests.get(url, stream=True, timeout=600)
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        with open(output_path, "wb") as f:
            with tqdm(total=total, unit="B", unit_scale=True, desc="  Downloading") as bar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    bar.update(len(chunk))
        return True
    except ImportError:
        print("  Error: requests/tqdm not available")
    except Exception as exc:
        print(f"  Error: {exc}")

    return False


def md5sum(path: Path, chunk: int = 1 << 20) -> str:
    """Streaming MD5 of a file."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def verify_tarball(path: Path, check_md5: bool = True) -> bool:
    """Validate size and (optionally) the published MD5."""
    if not path.exists():
        print("  ✗ Tarball not found")
        return False

    size = path.stat().st_size
    print(f"  Size: {size / 1e6:.1f} MB")
    if size < EXPECTED_BYTES * 0.95:
        print(f"  ✗ Too small (expected ~{EXPECTED_BYTES / 1e6:.1f} MB) — likely truncated")
        return False

    if check_md5:
        print("  Computing MD5 (this takes a few seconds)...")
        digest = md5sum(path)
        if digest != EXPECTED_MD5:
            print(f"  ✗ MD5 mismatch\n      got      {digest}\n      expected {EXPECTED_MD5}")
            return False
        print(f"  ✓ MD5 matches ({digest})")

    return True


def extract(tarball: Path, keep_inner: bool = False) -> bool:
    """
    Two-pass extraction: outer tarball → per-year tarballs → CSV tree.

    Returns True on success.
    """
    # ── Pass 1: outer → staging ───────────────────────────────────────────────
    if STAGE_DIR.exists():
        shutil.rmtree(STAGE_DIR)
    STAGE_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\n  [1/2] Extracting outer archive → {STAGE_DIR.name}/ ...")
    try:
        with tarfile.open(tarball, "r:gz") as tf:
            tf.extractall(STAGE_DIR)
    except Exception as exc:
        print(f"  ✗ Failed to extract outer archive: {exc}")
        return False

    inner = sorted(STAGE_DIR.glob("*_wind100.tar.gz"))
    print(f"        {len(inner)} per-year archives found")
    if not inner:
        print("  ✗ No per-year archives inside — unexpected archive layout")
        return False

    # ── Pass 2: per-year → data/raw/wind100/ ──────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  [2/2] Extracting {len(inner)} per-year archives → {OUTPUT_DIR.name}/ ...")

    failed = []
    for i, arc in enumerate(inner, 1):
        try:
            with tarfile.open(arc, "r:gz") as tf:
                tf.extractall(OUTPUT_DIR)
        except Exception as exc:
            failed.append((arc.name, str(exc)))
        if i % 10 == 0 or i == len(inner):
            print(f"        {i}/{len(inner)}")

    if failed:
        print(f"  ⚠ {len(failed)} archive(s) failed:")
        for name, err in failed[:5]:
            print(f"      {name}: {err}")

    if not keep_inner:
        shutil.rmtree(STAGE_DIR, ignore_errors=True)
        print(f"        staging directory removed")

    return not failed


def validate_extraction() -> bool:
    """Check the extracted tree against the documented layout."""
    print("\n  Validating extracted tree...")

    if not OUTPUT_DIR.is_dir():
        print("  ✗ Output directory missing")
        return False

    year_dirs = sorted(d for d in OUTPUT_DIR.iterdir()
                       if d.is_dir() and d.name.endswith("_wind100"))
    csvs = list(OUTPUT_DIR.rglob("*.csv"))

    print(f"  Year directories : {len(year_dirs)}")
    if year_dirs:
        print(f"  Range            : {year_dirs[0].name} .. {year_dirs[-1].name}")
    print(f"  CSV files        : {len(csvs):,}")

    ok = True
    if len(year_dirs) < EXPECTED_YEAR_DIRS:
        print(f"  ⚠ Expected {EXPECTED_YEAR_DIRS} year directories, found {len(year_dirs)}")
        ok = False
    if len(csvs) < EXPECTED_MIN_CSV:
        print(f"  ✗ Expected >{EXPECTED_MIN_CSV:,} CSV files, found {len(csvs):,}")
        ok = False

    # Spot-check that the naming matches what load_wind100.py expects
    sample = next((c for c in csvs if c.name.endswith("_wind100_max.csv")), None)
    if sample is None:
        print("  ✗ No *_wind100_max.csv found — naming does not match loader expectations")
        ok = False
    else:
        print(f"  Sample           : {sample.parent.name}/{sample.name}")

    if ok:
        print("  ✓ Validation passed")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download and unpack the wind100 dataset from Zenodo"
    )
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if the tarball is present")
    parser.add_argument("--keep-inner", action="store_true",
                        help="Keep the intermediate per-year tarballs")
    parser.add_argument("--no-verify", action="store_true",
                        help="Skip the MD5 check")
    args = parser.parse_args()

    print("=" * 70)
    print("Download wind100 Dataset from Zenodo")
    print("=" * 70)
    print(f"\nSource: {ZENODO_DOI}")
    print(f"URL:    {DOWNLOAD_URL}")
    print(f"Output: {OUTPUT_DIR}")
    print()

    # ── Download ──────────────────────────────────────────────────────────────
    need_download = True

    if TARBALL.exists() and not args.force:
        print(f"⚠ Tarball already present: {TARBALL}")
        if verify_tarball(TARBALL, check_md5=not args.no_verify):
            print("\n✓ Existing tarball is valid. Skipping download.")
            need_download = False
        else:
            print("\n  Existing tarball is invalid. Re-downloading...")

    if args.force and TARBALL.exists():
        print("  --force: removing existing tarball")
        TARBALL.unlink()

    if need_download:
        print(f"\n[{datetime.now():%H:%M:%S}] Starting download (~182 MB)...")
        if not download_file(DOWNLOAD_URL, TARBALL):
            print("\n✗ Download failed!")
            print("\nManual download instructions:")
            print(f"  1. Visit: https://zenodo.org/records/{ZENODO_RECORD_ID}")
            print(f"  2. Download: {ZENODO_FILE}")
            print(f"  3. Save to: {TARBALL}")
            print(f"  4. Re-run this script (it will skip the download and unpack)")
            return 1
        print(f"[{datetime.now():%H:%M:%S}] Download complete")

        if not verify_tarball(TARBALL, check_md5=not args.no_verify):
            print("\n✗ Downloaded tarball failed verification!")
            return 1

    # ── Extract ───────────────────────────────────────────────────────────────
    if OUTPUT_DIR.exists() and any(OUTPUT_DIR.iterdir()):
        n_existing = len(list(OUTPUT_DIR.rglob("*.csv")))
        if n_existing >= EXPECTED_MIN_CSV:
            print(f"\n⚠ {OUTPUT_DIR} already contains {n_existing:,} CSV files.")
            print("  Skipping extraction. Delete the directory to force a re-extract.")
            return 0 if validate_extraction() else 1
        print(f"\n⚠ {OUTPUT_DIR} exists but holds only {n_existing:,} CSV files — re-extracting")

    if not extract(TARBALL, keep_inner=args.keep_inner):
        print("\n✗ Extraction failed!")
        return 1

    if not validate_extraction():
        print("\n✗ Extracted tree failed validation!")
        return 1

    print("\n" + "=" * 70)
    print("✓ wind100 ready")
    print("=" * 70)
    print(f"\n  {OUTPUT_DIR}")
    print("\nNext steps:")
    print("  1. Merge into per-cyclone Parquet:")
    print("     python scripts/data/run_pipeline.py --skip-download --wind100")
    print("  2. Generate the web app wind100 JSON:")
    print("     python scripts/generate_wind100_json.py")

    return 0


if __name__ == "__main__":
    sys.exit(main())
