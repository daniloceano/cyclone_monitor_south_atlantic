#!/usr/bin/env python3
"""
Download and unpack the cyclone-relative wind datasets from Zenodo.

Replaces the wind100-only download_wind100.py. Levels, DOIs, checksums and the
archive layout all come from scripts/data/wind_levels.py, so a new level needs
an entry there and nothing here.

    wind10   DOI 10.5281/zenodo.19378255
    wind100  DOI 10.5281/zenodo.19353037

Both records hold a SINGLE file that is a tarball of tarballs. Two extraction
passes are required; the nesting is not described in either Zenodo record,
which is why this script exists:

    wind{L}.tar.gz
      +-- {YYYY}_wind{L}.tar.gz          (43 of them, 1979-2021)
            +-- {YYYY}_wind{L}/
                  +-- {track_id}_wind{L}_{max,p99}.csv

Output:
    data/raw/wind{L}/{YYYY}_wind{L}/*.csv     (~15,974 files per level)
    data/raw/wind{L}.tar.gz                   (kept for re-extraction)

Run from project root:
    python scripts/data/download_wind.py                 # every level
    python scripts/data/download_wind.py --level wind10  # just one

Options:
    --level NAME   Only this level (default: all, in registry order)
    --force        Re-download even if the tarball is already present
    --keep-inner   Keep the intermediate per-year tarballs (default: removed)
    --no-verify    Skip the MD5 check (not recommended)

------------------------------------------------------------------------------
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from wind_levels import (  # noqa: E402
    EXPECTED_MIN_CSV,
    EXPECTED_YEAR_DIRS,
    LEVEL_ORDER,
    level_config,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"


def download_file(url: str, output_path: Path) -> bool:
    """Download using curl, wget, or requests (in that order)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("curl"):
        print("  Downloading with curl...")
        r = subprocess.run(
            ["curl", "-L", "--fail", "--retry", "3", "--progress-bar",
             "-o", str(output_path), url],
            capture_output=False,
        )
        if r.returncode == 0:
            return True
        print(f"  curl failed with code {r.returncode}")

    if shutil.which("wget"):
        print("  Downloading with wget...")
        r = subprocess.run(
            ["wget", "-c", "--progress=bar:force", "-O", str(output_path), url],
            capture_output=False,
        )
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


def md5sum(path: Path, chunk: int = 1 << 20) -> str:
    """Streaming MD5 of a file."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def verify_tarball(path: Path, cfg: dict, check_md5: bool = True) -> bool:
    """Validate size and (optionally) the published MD5 for one level."""
    if not path.exists():
        print("  x Tarball not found")
        return False

    size = path.stat().st_size
    print(f"  Size: {size / 1e6:.1f} MB")
    if size < cfg["bytes"] * 0.95:
        print(f"  x Too small (expected ~{cfg['bytes'] / 1e6:.1f} MB) - likely truncated")
        return False

    if check_md5:
        print("  Computing MD5 (this takes a few seconds)...")
        digest = md5sum(path)
        if digest != cfg["md5"]:
            print(f"  x MD5 mismatch\n      got      {digest}\n      expected {cfg['md5']}")
            return False
        print(f"  ok MD5 matches ({digest})")

    return True


def extract(tarball: Path, level: str, output_dir: Path, stage_dir: Path,
            keep_inner: bool = False) -> bool:
    """Two-pass extraction: outer tarball -> per-year tarballs -> CSV tree."""
    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    stage_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n  [1/2] Extracting outer archive -> {stage_dir.name}/ ...")
    try:
        with tarfile.open(tarball, "r:gz") as tf:
            tf.extractall(stage_dir)
    except Exception as exc:
        print(f"  x Failed to extract outer archive: {exc}")
        return False

    inner = sorted(stage_dir.glob(f"*_{level}.tar.gz"))
    print(f"        {len(inner)} per-year archives found")
    if not inner:
        print("  x No per-year archives inside - unexpected archive layout")
        return False

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"  [2/2] Extracting {len(inner)} per-year archives -> {output_dir.name}/ ...")

    failed = []
    for i, arc in enumerate(inner, 1):
        try:
            with tarfile.open(arc, "r:gz") as tf:
                tf.extractall(output_dir)
        except Exception as exc:
            failed.append((arc.name, str(exc)))
        if i % 10 == 0 or i == len(inner):
            print(f"        {i}/{len(inner)}")

    if failed:
        print(f"  ! {len(failed)} archive(s) failed:")
        for name, err in failed[:5]:
            print(f"      {name}: {err}")

    if not keep_inner:
        shutil.rmtree(stage_dir, ignore_errors=True)
        print("        staging directory removed")

    return not failed


def validate_extraction(level: str, output_dir: Path) -> bool:
    """Check the extracted tree against the documented layout."""
    print("\n  Validating extracted tree...")

    if not output_dir.is_dir():
        print("  x Output directory missing")
        return False

    year_dirs = sorted(d for d in output_dir.iterdir()
                       if d.is_dir() and d.name.endswith(f"_{level}"))
    csvs = list(output_dir.rglob("*.csv"))

    print(f"  Year directories : {len(year_dirs)}")
    if year_dirs:
        print(f"  Range            : {year_dirs[0].name} .. {year_dirs[-1].name}")
    print(f"  CSV files        : {len(csvs):,}")

    ok = True
    if len(year_dirs) < EXPECTED_YEAR_DIRS:
        print(f"  ! Expected {EXPECTED_YEAR_DIRS} year directories, found {len(year_dirs)}")
        ok = False
    if len(csvs) < EXPECTED_MIN_CSV:
        print(f"  x Expected >{EXPECTED_MIN_CSV:,} CSV files, found {len(csvs):,}")
        ok = False

    sample = next((c for c in csvs if c.name.endswith(f"_{level}_max.csv")), None)
    if sample is None:
        print(f"  x No *_{level}_max.csv found - naming does not match the loader")
        ok = False
    else:
        print(f"  Sample           : {sample.parent.name}/{sample.name}")

    if ok:
        print("  ok Validation passed")
    return ok


def process_level(level: str, args) -> int:
    """Download, verify, extract and validate one level. Returns 0 on success."""
    cfg = level_config(level)
    tarball = RAW_DIR / cfg["archive"]
    output_dir = RAW_DIR / level
    stage_dir = RAW_DIR / f"_{level}_stage"
    url = f"https://zenodo.org/records/{cfg['zenodo_record']}/files/{cfg['archive']}"

    print("\n" + "=" * 70)
    print(f"{cfg['label']}  ({level})")
    print("=" * 70)
    print(f"Source: {cfg['doi']}")
    print(f"URL:    {url}")
    print(f"Output: {output_dir}")

    need_download = True
    if tarball.exists() and not args.force:
        print(f"\n! Tarball already present: {tarball.name}")
        if verify_tarball(tarball, cfg, check_md5=not args.no_verify):
            print("\n  ok Existing tarball is valid. Skipping download.")
            need_download = False
        else:
            print("\n  Existing tarball is invalid. Re-downloading...")

    if args.force and tarball.exists():
        print("  --force: removing existing tarball")
        tarball.unlink()

    if need_download:
        print(f"\n[{datetime.now():%H:%M:%S}] Starting download (~{cfg['bytes'] / 1e6:.0f} MB)...")
        if not download_file(url, tarball):
            print("\nx Download failed!")
            print("\nManual download instructions:")
            print(f"  1. Visit: https://zenodo.org/records/{cfg['zenodo_record']}")
            print(f"  2. Download: {cfg['archive']}")
            print(f"  3. Save to: {tarball}")
            print("  4. Re-run this script (it will skip the download and unpack)")
            return 1
        print(f"[{datetime.now():%H:%M:%S}] Download complete")

        if not verify_tarball(tarball, cfg, check_md5=not args.no_verify):
            print("\nx Downloaded tarball failed verification!")
            return 1

    if output_dir.exists() and any(output_dir.iterdir()):
        n_existing = len(list(output_dir.rglob("*.csv")))
        if n_existing >= EXPECTED_MIN_CSV:
            print(f"\n! {output_dir} already contains {n_existing:,} CSV files.")
            print("  Skipping extraction. Delete the directory to force a re-extract.")
            return 0 if validate_extraction(level, output_dir) else 1
        print(f"\n! {output_dir} exists but holds only {n_existing:,} CSV files - re-extracting")

    if not extract(tarball, level, output_dir, stage_dir, keep_inner=args.keep_inner):
        print("\nx Extraction failed!")
        return 1

    if not validate_extraction(level, output_dir):
        print("\nx Extracted tree failed validation!")
        return 1

    print(f"\nok {level} ready -> {output_dir}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download and unpack the cyclone-relative wind datasets from Zenodo"
    )
    parser.add_argument("--level", choices=LEVEL_ORDER, default=None,
                        help="Only this level (default: all)")
    parser.add_argument("--force", action="store_true",
                        help="Re-download even if the tarball is present")
    parser.add_argument("--keep-inner", action="store_true",
                        help="Keep the intermediate per-year tarballs")
    parser.add_argument("--no-verify", action="store_true",
                        help="Skip the MD5 check")
    args = parser.parse_args()

    levels = [args.level] if args.level else LEVEL_ORDER

    print("=" * 70)
    print("Download cyclone-relative wind datasets from Zenodo")
    print("=" * 70)
    print(f"Levels: {', '.join(levels)}")

    failures = [lv for lv in levels if process_level(lv, args) != 0]

    print("\n" + "=" * 70)
    if failures:
        print(f"x Failed: {', '.join(failures)}")
        return 1
    print(f"ok All levels ready: {', '.join(levels)}")
    print("=" * 70)
    print("\nNext steps:")
    print("  1. Merge into the per-cyclone Parquet base:")
    print("     python scripts/data/merge_wind.py")
    print("  2. Generate the web app wind JSON:")
    print("     python scripts/generate_wind_json.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
