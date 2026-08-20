# Cleanup inventory

Artefacts that became redundant when the pipeline was consolidated (wind10
integration, `tracks_by_id` as the single analysis product, track-only removal).

> **STATUS: executed 2026-08-20.** Categories A and the two wind
> tarballs from B were removed with explicit authorisation, recovering
> **879 MB**. The consolidated CSV was deliberately kept — the pipeline reads it
> — and everything in category C is untouched. The tables below are retained as
> the record of what was removed and why.

Sizes measured 2026-08-20 on swell, before removal. `data/` totalled **3.2 GB**.

---

## A. Safe to remove

Redundant with certainty, and either regeneratable from a public source or
superseded by a product that is already verified.

| Path | Size | What it was | Superseded by | Regenerable? | Risk |
|---|---|---|---|---|---|
| `data/processed/tracks_raw_catalogue.csv` | **167.4 MB** | Deduplicated track-only catalogue — the 24,044 cyclones the removed "track only" population was built from | Nothing. The feature is gone end to end. | Yes, but only by restoring the two deleted ingest scripts from git history *and* re-downloading the Mendeley archive | **None** — no code path reads it |
| `data/raw/gramcianinov_catalogue_v4.zip` | **179.3 MB** | Mendeley v4 bulk download, the source of the track-only catalogue | Nothing | Yes — public download, `10.17632/kwcvfr52hp.4` | **None** |
| `data/raw/gramcianinov_catalogue/` | **170.8 MB** | The extracted `ERA5/ExSAt` tree from the zip above | Nothing | Yes — re-extract from the zip, or re-download | **None** |
| `site/public/data/basins.debug.geojson` | **2.5 MB** | Debug variant of the basin polygons | Never fetched by any component (grep-verified across `site/src` and `scripts/`) | Yes — `scripts/process_sedimentary_basins.py` | **None**. It was **git-tracked**, so removing it also shrank the deployed assets. The generator now writes this copy to `data/interim/` instead, so it cannot return to git |

**Subtotal: ~520 MB**, of which 2.5 MB also leaves git.

> The three track-only artefacts are the whole reason this section exists. The
> feature was removed from the site, the pipeline and the docs; these are the
> last traces of it on disk. The scientific *source* — the Gramcianinov tracking
> dataset — remains cited as provenance for the processed cyclones, as it should:
> what was removed is the second, partially-processed population, not the
> lineage of the data.

---

## B. Probably redundant — worth your review

Defensible to keep, but nothing in the current pipeline reads them.

| Path | Size | Rationale to remove | Rationale to keep |
|---|---|---|---|
| `data/raw/wind10.tar.gz` | **177.5 MB** | The extracted tree `data/raw/wind10/` is what the loader reads; the tarball is only needed to re-extract | Re-downloading is ~3 min and needs Zenodo reachable; the local copy makes the MD5 check reproducible offline |
| `data/raw/wind100.tar.gz` | **182.3 MB** | Same | Same |
| `data/processed/tracks_south_atlantic_consolidated.csv` | **389.2 MB** | Every column in it is present in `tracks_by_id/`, which is the product everything now reads for analysis | **Recommend keeping.** `scripts/preprocess_data.py` reads it directly to build `summary.json` and `details/`, and `merge_wind.py` reads it as its left side. Removing it makes both steps re-run the upstream preprocessing. Listed here only for completeness |

**Removed: the two tarballs, ~360 MB.** The extracted trees were verified present
(15,974 CSV files each) before deleting, and `download_wind.py` re-fetches and
re-verifies them on demand.

---

## C. Must stay

| Path | Size | Why |
|---|---|---|
| `data/processed/tracks_by_id/` | **901.7 MB** | The consolidated per-cyclone product. 6,789 files × 109 columns. Everything downstream derives from it |
| `data/processed/cyclones.parquet` | 0.7 MB | Per-cyclone table; source of the taxonomy index and of the wind intensities in `summary.json` |
| `data/raw/wind10/`, `data/raw/wind100/` | **468.0 + 472.7 MB** | The extracted archives the merge reads. Regeneratable from the tarballs, but only if those are kept |
| `data/raw/tracks_SAt_source.csv` | 180.8 MB | The primary catalogue as published. Everything starts here |
| `data/raw/cps_parameters_SAt.csv` | 25.4 MB | **Not reproducible from any public download.** Hand-exported from `paper_energy_patterns`; the CPS dataset has no DOI yet |
| `data/raw/cps_classification_SAt.csv` | 1.3 MB | Same — and it is the only per-cyclone CPS classification the monitor has |
| `data/sedimentary_basins/` | 0.9 MB | Source shapefiles, git-tracked |

> ⚠️ The two CPS files are the single most important thing **not** to delete. They
> cannot be re-downloaded; regenerating them means re-running the CPS pipeline in
> `paper_energy_patterns`, whose own ERA5 inputs are documented there as gone.

---

## `tracks_by_id/` grew, as expected

The directory now holds **901.7 MB** against 603 MB before this work. The schema
went from 74 to 109 columns — `cps_state` plus the 34 wind10 columns — and
603 × 109/74 = 888 MB, so the observed ratio of 1.50 against an expected 1.47 is
column growth and nothing else. File count is exactly 6,789.

---

## Summary

| Category | Recoverable |
|---|---|
| A — safe to remove | **~520 MB** |
| B — tarballs, if you accept re-downloading | ~360 MB |
| B — consolidated CSV (**not** recommended) | 389 MB |
| **Realistic total (A + tarballs)** | **~880 MB** |

**Executed 2026-08-20: 879 MB recovered.** After removal every
pipeline script still parses, and `merge_wind.py --dry-run` still indexes 7,987
track IDs per level at 100 % timestep coverage.
