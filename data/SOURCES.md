<!-- GENERATED FILE — do not edit by hand.
     Source: data/metadata/sources.json
     Regenerate: python scripts/preprocess_data.py -->

# Data provenance

Every dataset behind the South Atlantic Cyclone Monitor, where it came
from, which monitor variables it supplies, and what the pipeline does to
it locally.

_Generated 2026-08-20 18:46:17._

## Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979-2020)

**Authors:** Couto de Souza, Danilo; Gramcianinov, Carolina B. (2025)  
**Repository:** Zenodo  
**Licence:** CC-BY-4.0  
**DOI:** [10.5281/zenodo.18133432](https://doi.org/10.5281/zenodo.18133432)  

The catalogue itself: every cyclone in the monitor, its track, and its energetics.

**Coverage**

- period: 1979-01-01 to 2021-01-07
- cyclones: 6789
- timesteps: 631009
- native resolution: tracks 1-hourly; LEC terms 3-hourly

**Monitor variables from this source**

- `track_id`
- `date`
- `lon`
- `lat`
- `vor42`
- `region`
- `period`
- `Az`
- `Ae`
- `Kz`
- `Ke`
- `Cz`
- `Ca`
- `Ck`
- `Ce`
- `BAz`
- `BAe`
- `BKz`
- `BKe`
- `BPhiZ`
- `BPhiE`
- `Gz`
- `Ge`
- `dAzdt`
- `dAedt`
- `dKzdt`
- `dKedt`
- `RGz`
- `RGe`
- `RKz`
- `RKe`

**Local transformations**

- Column names standardised (e.g. 'lon vor' -> 'lon', 'dAz/dt (finite diff.)' -> 'dAzdt').
- The 24 LEC terms are linearly interpolated from their native 3-hourly step to 1-hourly within each track; 'lec_original' is True on the original values. Coverage after interpolation is 97.8%, the remainder being track first/last hours where interpolation has nothing to bracket.
- No spatial or temporal subsetting.

## Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases

**Authors:** Gramcianinov, Carolina B.; Campos, Ricardo M.; de Camargo, Ricardo; Hodges, Kevin I.; Guedes Soares, Carlos; Peliz, Alvaro (2020)  
**Repository:** Mendeley Data  
**Version:** V4  
**DOI:** [10.17632/kwcvfr52hp.4](https://doi.org/10.17632/kwcvfr52hp.4)  

The published cyclone-tracking dataset and method behind the catalogue: feature tracking of relative vorticity at 850 hPa, spectrally filtered to T42 - which is what 'vor42' means.

**Monitor variables from this source**

- `vor42`
- `track geometry`

## The properties and genesis environments of South Atlantic cyclones

**Authors:** Gramcianinov, Carolina B.; Hodges, Kevin I.; Camargo, Ricardo de (2019)  
**Published in:** Climate Dynamics, 53(7), 4115-4140  
**DOI:** [10.1007/s00382-019-04778-7](https://doi.org/10.1007/s00382-019-04778-7)  

Definition of the genesis hotspots used to label each cyclone.

**Monitor variables from this source**

- `region`

**Local transformations**

- Short codes in the source are mapped to display names: ARG -> Southeastern Argentina, LA-PLATA -> La Plata River Discharge, SE-BR -> Southeast Brazil.

## Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones

**Authors:** De Souza, Danilo C.; Silva Dias, Pedro L. da; Gramcianinov, Carolina B.; Camargo, Ricardo de (2025)  
**Published in:** Climate Dynamics, 63(11), 1-26  
**DOI:** [10.1007/s00382-024-07555-z](https://doi.org/10.1007/s00382-024-07555-z)  

How the semi-Lagrangian Lorenz Energy Cycle terms are computed and what they mean.

**Monitor variables from this source**

- `Az`
- `Ae`
- `Kz`
- `Ke`
- `conversion, generation, boundary and residual terms`

## CycloPhaser: A Python package for detecting extratropical cyclone life cycles

**Authors:** de Souza, Danilo C.; da Silva Dias, Pedro L.; Gramcianinov, Carolina B.; de Camargo, Ricardo (2025)  
**Published in:** Journal of Open Source Software, 10(108), 7363  
**DOI:** [10.21105/joss.07363](https://doi.org/10.21105/joss.07363)  

Objective per-timestep lifecycle phase labels derived from the vorticity evolution.

**Monitor variables from this source**

- `period`

## Cyclone Phase Space classification of Southwestern Atlantic cyclones (1979-2020)

**Authors:** Rodriguez, Andres; Couto de Souza, Danilo (2026)  
**Repository:** IAG-USP, paper_energy_patterns project  
**DOI:** _not minted yet._  
> Being prepared for deposit on Zenodo. Until then it is exported by hand from the paper_energy_patterns project (scripts/cps_analysis/export_cps_for_monitor.py) into data/raw/, and is not reproducible from a public download.  

Thermal-structure diagnostics in the Hart (2003) Cyclone Phase Space, at two distinct grains: a per-timestep state and a per-cyclone category.

**Coverage**

- cyclones with cps: 6776
- cyclones total: 6789
- timesteps: 212996
- native resolution: 3-hourly

**Monitor variables from this source**

- `cps_B`
- `cps_VTL`
- `cps_VTU`
- `cps_size_km`
- `cps_dir`
- `cps_over_ocean`
- `cps_class (per-timestep raw threshold label)`
- `cps_state (per-timestep guarded persistent state)`
- `phase_class (per-cyclone category)`
- `class_kind`
- `is_identified`

**Local transformations**

- Parameters are merged onto the 1-hourly catalogue by (track_id, date); 100% of CPS keys match a catalogue row.
- B/VTL/VTU/SIZE are linearly interpolated to 1-hourly, 'dir' circularly, 'over_ocean' by fill; 'cps_original' is True on computed values. cps_class is re-derived from the thresholds at interpolated rows only.
- The 13 cyclones without a CPS series are carried explicitly with phase_class = 'no_cps_data' so a join on track_id never silently loses them.

**Conventions to respect**

- Southern-Hemisphere sign convention: VTL and VTU hold Hart's signed -V_T, so positive means warm core.
- A '*_like' class (EC_like, SC_like, TC_like) means the structure was dominant but never sustained for 36 h. It is a description of characteristics, NOT an identification: grouping SC_like under 'Subtropical' asserts something the classification explicitly refuses to assert. Use class_kind / is_identified, never a string prefix match.
- A cyclone's category (phase_class) and its state at a given hour (cps_state) are different things and are stored separately.

## Maximum and 99th percentile wind speeds at 10 meters within a Lagrangian domain centered on extratropical cyclones in the South Atlantic (1979-2020)

**Authors:** Paredes Quispe, Jonathan Aaron (2026)  
**ORCID:** 0000-0001-8660-745X  
**Affiliation:** Universidade de Sao Paulo  
**Repository:** Zenodo  
**Version:** 1.0.0  
**Date:** 2026-04-01  
**Licence:** CC-BY-4.0  
**DOI:** [10.5281/zenodo.19378255](https://doi.org/10.5281/zenodo.19378255)  
**Archive MD5:** `753030a447d337e6375bd14463ac3a23`  

Per-quadrant 10 m wind extrema at every timestep: the Wind 10 m display variable, its intensity filter, the map markers and the sidebar quadrant statistics.

**Coverage**

- period: 1979-2020 per the record; a 2021 directory holding one cyclone is present and consistent with the catalogue ending 2021-01-07
- track ids: 7987
- native resolution: 1-hourly

**Monitor variables from this source**

- `w10max_* (16 quadrant fields + global quadrant)`
- `w10p99_* (idem)`

**Local transformations**

- Two-pass extraction (the record is a tarball of per-year tarballs).
- Columns renamed to the standardised {prefix}{metric}_{quadrant}_{field} scheme.
- LEFT-joined onto the catalogue by (track_id, timestamp). Never interpolated: NaN is preserved where no wind record matches.
- The 1,198 track_ids present only in the wind archives are not in the energetics catalogue and are skipped.

**Conventions to respect**

- Method: a 20x20 degree Lagrangian domain centred on the cyclone core (tracked by relative vorticity at 850 hPa); absolute maxima and 99th percentiles taken within a circular mask of 9.5 degree radius after Gaussian smoothing (sigma = 0.25).
- 'dis' is a Euclidean distance in degrees, hypot(dlon, dlat) - NOT great-circle. Verified locally to 1e-14 deg.
- The Zenodo description states that mx_mx_max / mx_mx_p99 hold 'the maximum value across all quadrants'. They do not: the column holds the NAME of the quadrant carrying the extremum. Verified to be exactly the argmax of the four quadrant values over 74,242 comparisons.
- The producer's N/S quadrant labels are inverted relative to the geographic convention; the correction is applied in the presentation layer only, so stored data stay a faithful copy of the archive.

## Maximum wind speeds and 99th percentile values at 100 meters associated with extratropical cyclones in the South Atlantic (1979-2020)

**Authors:** Paredes Quispe, Jonathan Aaron (2026)  
**ORCID:** 0000-0001-8660-745X  
**Affiliation:** Universidade de Sao Paulo  
**Repository:** Zenodo  
**Version:** 1.0.0  
**Date:** 2026-03-31  
**Licence:** CC-BY-4.0  
**DOI:** [10.5281/zenodo.19353037](https://doi.org/10.5281/zenodo.19353037)  
**Archive MD5:** `4eaef49b4c53b5ef81cece06680fca31`  

Per-quadrant 100 m wind extrema at every timestep: the Wind 100 m display variable, its intensity filter, the map markers, the sidebar quadrant statistics and the sedimentary-basin wind filter.

**Coverage**

- period: 1979-2020 per the record; a 2021 directory holding one cyclone is present and consistent with the catalogue ending 2021-01-07
- track ids: 7987
- native resolution: 1-hourly

**Monitor variables from this source**

- `w100max_* (16 quadrant fields + global quadrant)`
- `w100p99_* (idem)`

**Local transformations**

- Identical to wind10 - the two datasets share a producer, a method and a layout.

**Conventions to respect**

- Same as wind10: 20x20 degree Lagrangian domain, 9.5 degree circular mask, Gaussian smoothing; Euclidean 'dis' in degrees; mx_mx_* is a quadrant label, not a value; inverted N/S labels corrected in the presentation layer.

## The ERA5 global reanalysis

**Authors:** Hersbach, Hans; and co-authors (2020)  
**Published in:** Quarterly Journal of the Royal Meteorological Society, 146(730), 1999-2049  
**Repository:** Copernicus Climate Data Store  
**DOI:** [10.1002/qj.3803](https://doi.org/10.1002/qj.3803)  

The underlying reanalysis from which the tracking, the energetics, the phase-space parameters and both wind datasets are derived. The monitor never reads ERA5 directly.

## Brazilian offshore sedimentary basins

**Authors:** Agencia Nacional do Petroleo, Gas Natural e Biocombustiveis (ANP)  
**Repository:** ANP Geographic Information System (gishub)  
**URL:** <https://gishub.anp.gov.br/>  

Basin polygons used by the sedimentary-basin filter.

**Coverage**

- basins: 16

**Monitor variables from this source**

- `basin id`
- `basin geometry`

**Local transformations**

- Shapefiles converted to GeoJSON; geometries repaired with make_valid(); CRS verified as EPSG:4326 with no reprojection; basin ids normalised.

---

## Further references

- Hart, Robert E. (2003). *A cyclone phase space derived from thermal wind and thermal asymmetry*. Monthly Weather Review, 131(4), 585-616. [10.1175/1520-0493(2003)131<0585:ACPSDF>2.0.CO;2](https://doi.org/10.1175/1520-0493(2003)131<0585:ACPSDF>2.0.CO;2)
  - The Cyclone Phase Space framework itself.
- Lorenz, Edward N. (1955). *Available potential energy and the maintenance of the general circulation*. Tellus, 7(2), 157-167. [10.3402/tellusa.v7i2.8796](https://doi.org/10.3402/tellusa.v7i2.8796)
  - The energy-cycle formulation the LEC diagnostics implement.
- Hodges, Kevin I. (1999). *Adaptive constraints for feature tracking*. Monthly Weather Review, 127(6), 1362-1373. [10.1175/1520-0493(1999)127<1362:ACFFT>2.0.CO;2](https://doi.org/10.1175/1520-0493(1999)127<1362:ACFFT>2.0.CO;2)
  - The TRACK feature-tracking algorithm behind the cyclone catalogue.
- Gozzo, Luiz F.; da Rocha, Rosmeri P.; Reboita, Michelle S.; Sugahara, Shigetoshi (2014). *Subtropical cyclones over the southwestern South Atlantic: climatological aspects and case study*. Journal of Climate, 27(22), 8543-8562. [10.1175/JCLI-D-14-00149.1](https://doi.org/10.1175/JCLI-D-14-00149.1)
  - Source of the subtropical thresholds and of the genesis-band and ocean-fraction identification criteria.
- Guishard, Mark P.; Evans, Jenni L.; Hart, Robert E. (2009). *Atlantic subtropical storms. Part II: Climatology*. Journal of Climate, 22(13), 3574-3594. [10.1175/2008JCLI2346.1](https://doi.org/10.1175/2008JCLI2346.1)
  - Source of the 36 h persistence requirement applied to phase-space classes.
- Couto de Souza, Danilo; and co-authors (2024). *New perspectives on South Atlantic storm track through an automatic method for detecting extratropical cyclones' lifecycle*. International Journal of Climatology, 44(10), 3568-3588. [10.1002/joc.8566](https://doi.org/10.1002/joc.8566)
  - The lifecycle-phase framework and its colour convention.
- Gramcianinov, Carolina B.; Campos, Ricardo M.; Guedes Soares, Carlos; de Camargo, Ricardo (2020). *Analysis of Atlantic extratropical storm tracks characteristics in 41 years of ERA5 and CFSR/CFSv2 databases*. Ocean Engineering, 216, 108111. [10.1016/j.oceaneng.2020.108111](https://doi.org/10.1016/j.oceaneng.2020.108111)
  - Companion analysis of the tracking dataset.
