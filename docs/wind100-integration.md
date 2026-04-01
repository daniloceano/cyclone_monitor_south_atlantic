# Wind100 Data Integration

Technical documentation for the integration of 100 m wind statistics (wind100)
into the South Atlantic Cyclone Monitor data pipeline.

---

## 1. Source Dataset

**DOI**: [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037)

**Description**: Maximum and 99th-percentile statistics of 100 m wind speed
associated with extratropical cyclones in the South Atlantic. Derived from ERA5
reanalysis in a Lagrangian (cyclone-centred) reference frame.

**Tracking basis**: relative vorticity at 850 hPa (vor42), consistent with the
main LEC dataset.

**Stated temporal coverage**: 1979–2020

**Local temporal coverage**: 1979–2021 (see §6 for discrepancy note)

**Local path**: `data/raw/wind100/` (482 MB, ~15,974 CSV files)

---

## 2. What the Variables Mean

### wind100_max

At each timestep, for each quadrant (NW, NE, SW, SE) relative to the cyclone
centre, the **absolute maximum** 100 m wind speed recorded within that quadrant.

- `w100max_{QD}_val` : maximum wind speed in quadrant QD (m s⁻¹)
- `w100max_{QD}_lon` : longitude of the grid point where that maximum occurs (°)
- `w100max_{QD}_lat` : latitude of the grid point where that maximum occurs (°)
- `w100max_{QD}_dist` : angular distance from the grid point to the cyclone
  centre (°, great-circle distance)
- `w100max_global_quad` : which quadrant holds the overall timestep maximum
  (one of NW, NE, SW, SE)

### wind100_p99

Same spatial organisation but reporting the **99th-percentile** wind speed
across all ERA5 grid points within each quadrant instead of the absolute maximum.

- `w100p99_{QD}_val` : 99th-percentile wind speed in quadrant QD (m s⁻¹)
- `w100p99_{QD}_lon`, `w100p99_{QD}_lat` : position of the p99 value (°)
- `w100p99_{QD}_dist` : distance from that position to cyclone centre (°)
- `w100p99_global_quad` : quadrant with the highest p99 across all four quadrants

where QD ∈ {NW, NE, SW, SE}

### Physical interpretation

- wind100_max is sensitive to localised extreme gusts; it captures the single
  strongest event in each quadrant but may be influenced by single-pixel
  artefacts.
- wind100_p99 is more robust: it represents the near-extreme wind level over
  the area, smoothing out single-pixel extremes. It is better for
  climatological comparisons.
- The quadrant decomposition reflects the known asymmetry in extratropical
  cyclone wind fields (strongest winds typically in the cold sector, i.e., SW
  or NW quadrant in the Southern Hemisphere).

---

## 3. How Files Are Organised

```
data/raw/wind100/
  {YYYY}_wind100/                ← one directory per year
    {YYYYNNNN}_wind100_max.csv   ← per-cyclone, per-metric
    {YYYYNNNN}_wind100_p99.csv
```

The track identifier `YYYYNNNN` follows the same scheme as the main dataset:
year (4 digits) + track sequence number within that year (4 digits). Verified
by cross-checking 1979 track IDs between the two datasets.

Each CSV file contains all timesteps of one cyclone. The number of rows equals
the track duration in hours. There is no "all tracks" aggregate file.

---

## 4. Column Renaming

All column names are standardised on load. The mapping is defined in
`scripts/data/load_wind100.py` as `COLUMN_RENAME_MAX` and `COLUMN_RENAME_P99`.

### Max files

| Original column | Standardised column | Notes |
|----------------|---------------------|-------|
| `NW_lo_max_wind100` | `w100max_NW_lon` | Longitude (°) |
| `NW_la_max_wind100` | `w100max_NW_lat` | Latitude (°) |
| `NW_mx_max_wind100` | `w100max_NW_val` | Wind speed (m s⁻¹) |
| `NW_dis_max_wind100` | `w100max_NW_dist` | Distance to centre (°) |
| `NE_lo_max_wind100` | `w100max_NE_lon` | |
| `NE_la_max_wind100` | `w100max_NE_lat` | |
| `NE_mx_max_wind100` | `w100max_NE_val` | |
| `NE_dis_max_wind100` | `w100max_NE_dist` | |
| `SW_lo_max_wind100` | `w100max_SW_lon` | |
| `SW_la_max_wind100` | `w100max_SW_lat` | |
| `SW_mx_max_wind100` | `w100max_SW_val` | |
| `SW_dis_max_wind100` | `w100max_SW_dist` | |
| `SE_lo_max_wind100` | `w100max_SE_lon` | |
| `SE_la_max_wind100` | `w100max_SE_lat` | |
| `SE_mx_max_wind100` | `w100max_SE_val` | |
| `SE_dis_max_wind100` | `w100max_SE_dist` | |
| `mx_mx_max` | `w100max_global_quad` | String: NW / NE / SW / SE |
| `timestamp` | _(merge key, not retained)_ | UTC, naive |

### p99 files

Identical structure; `max` → `p99` in all original names and `w100max_` → `w100p99_`
in all standardised names. Renaming is defined in `COLUMN_RENAME_P99`.

---

## 5. Merge Strategy

### Join key

Each main-data row is uniquely identified by `(track_id, date)`. Each wind100
file contains rows for one `track_id` with a `timestamp` column.

The merge is:

```
main_data  LEFT JOIN  wind100_max  ON  date == timestamp
           LEFT JOIN  wind100_p99  ON  date == timestamp
```

One left join per metric. Both joins are keyed on the timestamp.

### Left-join semantics

- Every row in the main dataset is preserved.
- Wind100 columns are NaN for any main-data timestep that has no matching
  wind100 row (e.g., hours not covered by the wind100 file, or tracks absent
  from the wind100 dataset entirely).
- Wind100 rows with a timestamp not present in the main data are discarded.
  These are reported as "extra timestamps" in the merge report.

### Timezone handling

Both datasets use UTC-naive datetimes (no timezone attached). No conversion is
applied. If a future update introduces tz-aware timestamps, both sides must be
explicitly aligned before merging.

### Duplicate timestamps

`load_wind100_file()` warns if a wind100 file contains duplicate timestamps.
No deduplication is applied automatically; duplicates would cause the left join
to produce extra rows, which is caught by an assertion in `_merge_wind100_onto_track()`.

### What is NOT done

- No interpolation of missing wind100 values.
- No extrapolation beyond the track's temporal extent.
- No filling of NaN from adjacent timesteps.
- No timezone conversion.

All of these are deliberate. NaN is the correct representation of "no data here".

---

## 6. Track ID Overlap and Discrepancies

### 2021 data

The Zenodo record for DOI 10.5281/zenodo.19353037 states coverage for
1979–2020. A local `2021_wind100/` folder exists with **1 track** (ID 20210007).
Cross-checking with the main dataset (which ends 2021-01-07) confirms that
track 20210007 exists in both datasets. The 2021 data is therefore treated as
valid and included in the output.

This discrepancy is noted in the merge report (`merge_report.txt`) and in this
document. Possible explanations: the Zenodo record was published before the
2021 data was added, or the stated range is inclusive of a partial 2021.

### Track count mismatch

The wind100 dataset contains **~7,987 unique track IDs** while the main LEC
dataset contains **6,789 tracks**. The wind100 dataset therefore covers more
tracks than the LEC dataset.

Likely cause: the two datasets use different filtering criteria or minimum
duration thresholds in the tracking algorithm. Tracks that exist in wind100
but not in the main data are indexed and reported but not processed (no main
data to merge with).

Tracks in the main dataset that have no wind100 counterpart receive NaN for
all 34 wind100 columns in the output Parquet file.

### Temporal resolution consistency

Both datasets are 1-hourly. No resolution mismatch requires interpolation.
The LEC energetics in the main dataset are 3-hourly in the raw source and were
already interpolated to 1-hourly by `preprocess_data.py`; the `lec_original`
flag distinguishes original (3-hourly) from interpolated values and is preserved
in all output files.

---

## 7. Output: Per-Cyclone Parquet Files

### Location

```
data/processed/tracks_by_id/{YYYY}/{MM:02d}/{track_id}.parquet
```

Year and month are from the **first timestep** of the cyclone (i.e., genesis
date). Multi-month cyclones are filed under their genesis month.

### Format

Parquet via pyarrow. Column dtypes are preserved automatically:
- `track_id`: int64
- `date`: datetime64[ns] (UTC-naive)
- float columns: float64
- `lec_original`: bool
- `region`, `period`, `w100max_global_quad`, `w100p99_global_quad`: object (string)

### Reading example

```python
import pandas as pd

# Read one track
df = pd.read_parquet("data/processed/tracks_by_id/2005/08/20050612.parquet")

# Read all tracks for a year using glob
import glob
files = glob.glob("data/processed/tracks_by_id/2005/**/*.parquet", recursive=True)
all_2005 = pd.concat([pd.read_parquet(f) for f in files], ignore_index=True)

# Find the track with the highest instantaneous wind in the NE quadrant
df.nlargest(5, "w100max_NE_val")[["date", "w100max_NE_val", "w100max_NE_lon", "w100max_NE_lat"]]

# Filter to timesteps where the global maximum was in the SW quadrant
df[df["w100max_global_quad"] == "SW"]
```

---

## 8. Validation and Coverage Report

After running `merge_wind100.py`, a report is saved to:
```
data/processed/tracks_by_id/merge_report.txt
```

It contains:
- Total tracks in main dataset vs wind100 index
- Tracks in both / main only / wind100 only
- wind100_max and wind100_p99 coverage at track and timestep level
- Count of extra timestamps discarded from wind100
- Merge errors (if any)
- Known discrepancies (2021 data, track count mismatch)

Run `--dry-run` to generate the report without writing Parquet files:
```bash
conda run -n data python scripts/data/merge_wind100.py --dry-run
```

---

## 9. Limitations

1. **Coverage asymmetry**: Not every main-dataset track has wind100 data. Wind100
   columns will be NaN for tracks missing from the wind100 index. Downstream
   analyses should use `w100max_NE_val.notna()` or similar masks.

2. **No wind100 for interpolated LEC timesteps**: Wind100 data are available at
   1-hourly resolution, so they align with both original-3-hourly and
   interpolated LEC timesteps. There is no additional coverage concern here.

3. **Quadrant extent unknown**: The wind100 files do not document the spatial
   extent of each quadrant (e.g., radius in degrees). This information must be
   retrieved from the original Zenodo dataset description.

4. **ERA5 resolution artefacts in wind100_max**: Because `wind100_max` is the
   absolute maximum in each quadrant, it can be influenced by sub-grid-scale
   variability at a single ERA5 point. Use `wind100_p99` for more robust
   climatological comparisons.

5. **2021 data quality**: The single 2021 track (20210007) has not been
   independently validated against the Zenodo archive. It is included as
   received.
