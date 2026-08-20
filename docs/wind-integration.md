# Wind integration (10 m and 100 m)

How the cyclone-relative wind diagnostics get from Zenodo into the monitor.

Two datasets, one pipeline. They are companion releases by the same author,
built with the same method and shipped in the same layout, so the pipeline is
parameterised by *level* rather than duplicated per height. Adding a third level
is one entry in `scripts/data/wind_levels.py`.

---

## 1. Sources

| Level | DOI | Archive | MD5 |
|---|---|---|---|
| wind10 | [10.5281/zenodo.19378255](https://doi.org/10.5281/zenodo.19378255) | `wind10.tar.gz` (177.5 MB) | `753030a447d337e6375bd14463ac3a23` |
| wind100 | [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037) | `wind100.tar.gz` (182.3 MB) | `4eaef49b4c53b5ef81cece06680fca31` |

Both by **Paredes Quispe, Jonathan Aaron** (Universidade de São Paulo,
ORCID 0000-0001-8660-745X), CC-BY-4.0, v1.0.0.

> **Attribution note.** Earlier revisions of this repository credited the 100 m
> dataset to Gramcianinov & Couto de Souza. That was wrong; both records are
> authored by Paredes Quispe. Corrected 2026-08.

### Method (identical at both heights)

Derived from ERA5. For each cyclone a **20°×20° Lagrangian domain** is centred
on the core, tracked by relative vorticity at 850 hPa. Fields are extracted at
every timestep of the life cycle. Within a **circular mask of 9.5° radius**,
after Gaussian smoothing (σ = 0.25), two statistics are computed **separately in
each of the four quadrants**:

- `max` — the absolute maximum wind speed
- `p99` — the 99th percentile

Because the method is identical, the two heights are directly comparable. Across
the catalogue, `max_wind100 > max_wind10` for **all 6,789 cyclones**, mean ratio
**1.295** — consistent with a marine log-wind profile, and a useful end-to-end
check that the two were joined correctly.

---

## 2. Archive layout

Neither Zenodo record describes the nesting. Both are a **tarball of tarballs**
and need two extraction passes:

```
wind{L}.tar.gz
  └── {YYYY}_wind{L}.tar.gz          (43 of them, 1979–2021)
        └── {YYYY}_wind{L}/
              ├── {track_id}_wind{L}_max.csv
              └── {track_id}_wind{L}_p99.csv
```

`scripts/data/download_wind.py` handles both passes, verifies the MD5, and
validates the extracted tree. Result per level: 43 year directories, 15,974 CSV
files, 7,987 track_ids.

The two levels were verified to hold **exactly the same 7,987 track_ids**, with
identical per-year counts and identical column headers.

---

## 3. File contents

18 columns, same order at both levels:

| Column | Meaning | Unit |
|---|---|---|
| `{QD}_lo_{metric}_wind{L}` | longitude of the extremum | degrees |
| `{QD}_la_{metric}_wind{L}` | latitude of the extremum | degrees |
| `{QD}_mx_{metric}_wind{L}` | wind speed | m s⁻¹ |
| `{QD}_dis_{metric}_wind{L}` | distance to the cyclone centre | degrees |
| `timestamp` | UTC-naive, 1-hourly | — |
| `mx_mx_{metric}` | **quadrant label** — see below | — |

for `QD ∈ {NW, NE, SW, SE}` and `metric ∈ {max, p99}`.

The `track_id` is **not a column**: it comes from the filename (`YYYYNNNN`, the
same scheme as the main catalogue).

### Three conventions that are easy to get wrong

**1. `mx_mx_max` / `mx_mx_p99` hold a quadrant NAME, not a value.**
The Zenodo description for the 10 m record states they "contain the maximum
value across all quadrants". They do not — the cell reads `"NE"`, `"SW"`, and so
on. The numeric timestep maximum must be taken across the four
`{QD}_mx_{metric}_wind{L}` columns. Verified: the label is *exactly* the argmax
of those four values over **74,242** timestep-metric comparisons, zero
mismatches, zero ties.

**2. `dis` is Euclidean degrees, not great-circle.**
It is `hypot(Δlon, Δlat)` where Δ is relative to the tracked centre. Verified to
a maximum error of **1e-14°** over 13,968 timestep-quadrant comparisons. (An
earlier revision of this document claimed great-circle; that was wrong.) This is
why the site does not store the field and recomputes it.

**3. Quadrant N/S labels are inverted** relative to geographic convention. A
position stored as `NW` is in fact *south*-west of the centre; E/W is correct.
The stored data keep the source's labels so they remain a faithful copy of the
archive. The correction is applied **only where a label is shown**, in
`site/src/lib/windQuadrants.ts`.

---

## 4. Merge into the consolidated base

`scripts/data/merge_wind.py` LEFT-joins every configured level onto the
consolidated catalogue on `(track_id, timestamp ↔ date)`.

- **No main-data row is ever dropped**; the row count is asserted unchanged.
- Both sides are UTC-naive; no timezone conversion.
- Wind timestamps with no catalogue counterpart are discarded — the archives
  carry 1,198 track_ids outside this catalogue.
- **Nothing is interpolated.** The wind series are already 1-hourly. NaN is
  preserved wherever no record matches.

Column standardisation:

```
{QD}_lo_{metric}_wind{L}   ->  {prefix}{metric}_{QD}_lon
{QD}_la_{metric}_wind{L}   ->  {prefix}{metric}_{QD}_lat
{QD}_mx_{metric}_wind{L}   ->  {prefix}{metric}_{QD}_val
{QD}_dis_{metric}_wind{L}  ->  {prefix}{metric}_{QD}_dist
mx_mx_{metric}             ->  {prefix}{metric}_global_quad
```

with `prefix` = `w10` / `w100`. 34 columns per level.

### Coverage

Both levels: **6,789 / 6,789 tracks**, **631,009 / 631,009 timesteps (100.0 %)**,
for both `max` and `p99`. Zero partial, zero missing.

---

## 5. Track intensity

```
max_wind{L} = max over timesteps of ( max over the four quadrant maxima )
```

Equivalently, the value at the `global_quad` quadrant, maximised over the track.
This mirrors `max_vor42` (the maximum of vor42 over the track) exactly, so the
three display variables rank cyclones on the same principle.

**The `max` statistic only.** `p99` describes a wind field at an instant and is
the more robust of the two for that purpose, but it is never used to classify how
strong a whole system got. It remains available per quadrant in the sidebar.

Observed ranges across the catalogue: 10 m **9.37 – 42.61 m s⁻¹**,
100 m **11.62 – 53.98 m s⁻¹**.

---

## 6. Site artefact

`scripts/generate_wind_json.py` reads the **consolidated Parquet base**, not the
raw archive. That keeps the site artefact a derivative of the base rather than a
second independent path from the source, and restricts it automatically to the
6,789 catalogue cyclones.

```
site/public/data/wind/{year}.json     one file per year, BOTH levels
site/public/data/wind/meta.json       per-level global maxima for the colour scale
```

```json
{"year": 1979, "levels": ["wind10","wind100"],
 "tracks": {"19790001": {"1979-01-01T00:00:00": {
   "w10":  {"max": {"NW": [dlon, dlat, val], "NE": [...], "SW": [...], "SE": [...]},
            "p99": {...}},
   "w100": {"max": {...}, "p99": {...}}}}}}
```

Note the year key is `track_id // 10000`, the year the site addresses a cyclone
by — **not** the genesis year. Cyclone `20210007` has its genesis in December
2020 but lives in `wind/2021.json`.

### What is stored, and what is recomputed

Quadrant entries are `[dlon, dlat, val]`:

- **Offsets, not absolute coordinates.** The centre is already on the timestep in
  `details/{year}.json`, so absolute position is `centre + offset`. Lossless, and
  cheaper in bytes because the numbers are small.
- **`dist` is not stored** — it is exactly `hypot(dlon, dlat)` (§3).
- **The global-quadrant label is not stored** — it is exactly the argmax (§3).
- Speeds are rounded to 2 decimals, which is what the interface renders.

Both heights in one file means switching the display variable costs no fetch.
Total **305 MB** across 43 years, against 261 MB for the single-level artefact it
replaced.

---

## 7. Limitations

- The records state 1979–2020; a `2021_wind{L}` directory holding one cyclone
  (`20210007`) is present locally and is consistent with the catalogue ending
  2021-01-07. Treated as valid, not independently validated.
- The archives cover 7,987 track_ids; **1,198 are outside this catalogue** and
  are skipped. They have no position, energetics or phase here, so they cannot
  be rendered.
- `max` is a single grid point and is therefore sensitive to isolated ERA5 grid
  artefacts. `p99` is the more robust description of the wind field.
- The spatial extent each quadrant statistic summarises is documented only as
  "within the 9.5° circular mask"; no finer breakdown is published.
