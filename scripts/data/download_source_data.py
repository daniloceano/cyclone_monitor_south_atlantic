#!/usr/bin/env python3
"""
Download source data from Zenodo for the South Atlantic Cyclone Monitor.

This script downloads the complete tracks dataset with energetics from Zenodo:
    DOI: 10.5281/zenodo.18133432

The dataset contains:
    - 631,009 track timesteps
    - 6,789 unique cyclones (1979–2020)
    - Track positions (lon/lat, 1-hourly)
    - Vorticity (vor42, 1-hourly)
    - Genesis region classification (ARG, LA-PLATA, SE-BR)
    - Lifecycle phase per timestep (incipient, intensification, mature, decay)
    - Full LEC energetics (24 terms, 3-hourly resolution — NaN at intermediate hours)

Output:
    data/raw/tracks_SAt_source.csv

Run from project root:
    python scripts/data/download_source_data.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_FILE = OUTPUT_DIR / "tracks_SAt_source.csv"

# Zenodo source
ZENODO_DOI = "10.5281/zenodo.18133432"
ZENODO_RECORD_ID = "18133432"
ZENODO_FILE = "tracks_SAt_filtered_with_energetics.csv"
DOWNLOAD_URL = f"https://zenodo.org/records/{ZENODO_RECORD_ID}/files/{ZENODO_FILE}"

# Expected file characteristics
EXPECTED_MIN_ROWS = 600_000
EXPECTED_COLUMNS = [
    "track_id", "date", "lon vor", "lat vor", "vor42",
    "region", "period", "Az", "Ae", "Kz", "Ke"
]


def download_file(url: str, output_path: Path) -> bool:
    """
    Download a file from URL using curl or wget.
    
    Returns True on success, False on failure.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Try curl first
    if shutil.which("curl"):
        print(f"  Downloading with curl...")
        result = subprocess.run(
            ["curl", "-L", "--progress-bar", "-o", str(output_path), url],
            capture_output=False
        )
        if result.returncode == 0:
            return True
        print(f"  curl failed with code {result.returncode}")
    
    # Fall back to wget
    if shutil.which("wget"):
        print(f"  Downloading with wget...")
        result = subprocess.run(
            ["wget", "-c", "--progress=bar:force", "-O", str(output_path), url],
            capture_output=False
        )
        if result.returncode == 0:
            return True
        print(f"  wget failed with code {result.returncode}")
    
    # Python requests fallback
    try:
        import requests
        from tqdm import tqdm
        
        print(f"  Downloading with Python requests...")
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()
        
        total_size = int(response.headers.get("content-length", 0))
        
        with open(output_path, "wb") as f:
            with tqdm(total=total_size, unit="B", unit_scale=True, desc="  Downloading") as pbar:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    pbar.update(len(chunk))
        return True
        
    except ImportError:
        print("  Error: requests library not available")
    except Exception as e:
        print(f"  Error: {e}")
    
    return False


def validate_download(file_path: Path) -> bool:
    """
    Validate the downloaded CSV file.
    
    Returns True if valid, False otherwise.
    """
    import csv
    
    print(f"\n  Validating {file_path.name}...")
    
    # Check file exists and has size
    if not file_path.exists():
        print("  ✗ File does not exist")
        return False
    
    size_mb = file_path.stat().st_size / (1024 * 1024)
    print(f"  File size: {size_mb:.1f} MB")
    
    if size_mb < 50:
        print("  ✗ File too small (expected >50 MB)")
        return False
    
    # Check header columns
    with open(file_path, "r") as f:
        reader = csv.reader(f)
        header = next(reader)
    
    missing_cols = [col for col in EXPECTED_COLUMNS if col not in header]
    if missing_cols:
        print(f"  ✗ Missing expected columns: {missing_cols}")
        return False
    
    print(f"  Columns found: {len(header)}")
    
    # Count rows (quick check)
    with open(file_path, "r") as f:
        row_count = sum(1 for _ in f) - 1  # Subtract header
    
    print(f"  Rows: {row_count:,}")
    
    if row_count < EXPECTED_MIN_ROWS:
        print(f"  ✗ Too few rows (expected >{EXPECTED_MIN_ROWS:,})")
        return False
    
    print("  ✓ Validation passed")
    return True


def main() -> int:
    """Main download function."""
    print("=" * 70)
    print("Download Source Data from Zenodo")
    print("=" * 70)
    print(f"\nSource: {ZENODO_DOI}")
    print(f"URL: {DOWNLOAD_URL}")
    print(f"Output: {OUTPUT_FILE}")
    print()
    
    # Check if file already exists
    if OUTPUT_FILE.exists():
        size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
        print(f"⚠ File already exists: {OUTPUT_FILE}")
        print(f"  Size: {size_mb:.1f} MB")
        
        if validate_download(OUTPUT_FILE):
            print("\n✓ Existing file is valid. Skipping download.")
            print("  (Delete the file manually to force re-download)")
            return 0
        else:
            print("\n  Existing file is invalid. Re-downloading...")
    
    # Download
    print(f"\n[{datetime.now():%H:%M:%S}] Starting download...")
    print(f"  This may take a few minutes (~180 MB)...")
    
    success = download_file(DOWNLOAD_URL, OUTPUT_FILE)
    
    if not success:
        print("\n✗ Download failed!")
        print("\nManual download instructions:")
        print(f"  1. Visit: https://zenodo.org/records/{ZENODO_RECORD_ID}")
        print(f"  2. Download: {ZENODO_FILE}")
        print(f"  3. Save to: {OUTPUT_FILE}")
        return 1
    
    print(f"\n[{datetime.now():%H:%M:%S}] Download complete")
    
    # Validate
    if not validate_download(OUTPUT_FILE):
        print("\n✗ Downloaded file validation failed!")
        return 1
    
    print("\n" + "=" * 70)
    print("✓ Download successful")
    print("=" * 70)
    print(f"\nNext step: Run preprocessing")
    print(f"  python scripts/data/preprocess_data.py")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
