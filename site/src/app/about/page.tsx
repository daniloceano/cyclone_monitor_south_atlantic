"use client";

import Link from "next/link";
import { useCallback } from "react";

export default function AboutPage() {
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-4 z-10 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="w-5 h-5 text-blue-600 flex-shrink-0"
          >
            <path strokeLinecap="round" d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9" />
            <path strokeLinecap="round" d="M12 7.5C9.5 7.5 7.5 9.5 7.5 12S9.5 16.5 12 16.5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 truncate">
            South Atlantic Cyclone Monitor
          </span>
          <span className="hidden sm:block text-xs text-gray-400 flex-shrink-0">
            1979–2020
          </span>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 transition"
          >
            ← Map
          </Link>
          <span className="text-blue-600 font-medium">About</span>
        </nav>

        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded hover:bg-gray-100 ml-2"
        >
          Log out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
          {/* Title section */}
          <section className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Data &amp; Methodology
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              This page documents the data sources, preprocessing steps, and scientific methodology 
              underlying the South Atlantic Cyclone Monitor.
            </p>
          </section>

          {/* Data Sources */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Data Sources
            </h2>
            <div className="space-y-6">
              <DataSourceCard
                title="Cyclone Track Database"
                description="Extratropical cyclone tracks identified using a feature-tracking algorithm based on relative vorticity at 850 hPa. Derived from ERA5 reanalysis and CFSR/CFSv2 data covering 1979–2020."
                citation="Gramcianinov, C. B., Campos, R. M., de Camargo, R., Hodges, K. I., Guedes Soares, C., & Peliz, Á. (2020). Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases. Mendeley Data, V4."
                doi="10.17632/kwcvfr52hp.4"
                doiUrl="https://doi.org/10.17632/kwcvfr52hp.4"
                role="Primary source for track positions, timestamps, and vor42 intensity"
              />

              <DataSourceCard
                title="Lorenz Energy Cycle (LEC) Diagnostics"
                description="Semi-Lagrangian energetics computed for each cyclone following the system's center. Contains energy reservoirs (Az, Ae, Kz, Ke), conversion terms (Ca, Ck, Ce, Cz), boundary fluxes, and generation terms. LEC climatology for the region is documented in a dedicated study."
                citation="De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R. (2025). Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones. Climate Dynamics, 63(11), 1–26."
                doi="10.1007/s00382-024-07555-z"
                doiUrl="https://doi.org/10.1007/s00382-024-07555-z"
                role="LEC methodology and climatology reference"
              />

              <DataSourceCard
                title="LEC Data Archive"
                description="Dataset containing the semi-Lagrangian LEC diagnostics for all 6,789 cyclones. Originally at 3-hourly resolution, interpolated to 1-hourly for this visualization."
                citation="Couto de Souza, D. (2025). Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020). Zenodo."
                doi="10.5281/zenodo.18133432"
                doiUrl="https://doi.org/10.5281/zenodo.18133432"
                role="All LEC energetics terms (interpolated from 3-hourly to 1-hourly)"
              />

              <DataSourceCard
                title="Genesis Region Classification"
                description="Cyclone genesis regions identified based on the location of cyclogenesis, following regional hotspot definitions for the South Atlantic."
                citation="Gramcianinov, C. B., Hodges, K. I., & Camargo, R. (2019). The properties and genesis environments of South Atlantic cyclones. Climate Dynamics, 53(7), 4115–4140."
                doi="10.1007/s00382-019-04778-7"
                doiUrl="https://doi.org/10.1007/s00382-019-04778-7"
                role="Classification: Argentina/Patagonia, SE South America, SE Brazil Coast"
              />

              <DataSourceCard
                title="Lifecycle Phase Detection"
                description="Objective determination of cyclone lifecycle phases (incipient, intensification, mature, decay) based on relative vorticity evolution using the Cyclophaser algorithm."
                citation="de Souza, D. C., da Silva Dias, P. L., Gramcianinov, C. B., & de Camargo, R. (2025). Cyclophaser: A Python package for detecting extratropical cyclone life cycles. Journal of Open Source Software, 10(108), 7363."
                doi="10.21105/joss.07363"
                doiUrl="https://doi.org/10.21105/joss.07363"
                role="Phase labels per timestep"
              />

              <DataSourceCard
                title="100 m Wind Statistics (wind100)"
                description="Maximum and 99th-percentile 100 m wind speed associated with each cyclone, derived from ERA5 in a Lagrangian (cyclone-centred) reference frame and reported separately for the four quadrants around the centre."
                citation="Gramcianinov, C. B., & Couto de Souza, D. (2026). Maximum wind speeds and 99th percentile values at 100 meters associated with extratropical cyclones in the South Atlantic (1979–2020). Zenodo."
                doi="10.5281/zenodo.19353037"
                doiUrl="https://doi.org/10.5281/zenodo.19353037"
                role="Quadrant wind extrema shown on the map and in the timestep panel; also drives the sedimentary-basin wind filter"
              />

              <DataSourceCard
                title="Cyclone Phase Space Classification"
                description="Thermal-structure diagnostics for every cyclone in the catalogue, following the Hart (2003) Cyclone Phase Space: the thickness asymmetry B and the lower/upper thermal winds VTL and VTU, plus a per-timestep and a per-cyclone structural classification."
                citation="Rodriguez, A., & Couto de Souza, D. (in preparation). Cyclone Phase Space classification of Southwestern Atlantic cyclones (1979–2020). Computed within the paper_energy_patterns project, IAG-USP."
                pending
                pendingNote="The dataset is being prepared for deposit on Zenodo. Until then it is copied into data/raw/ by hand and is not reproducible from a public download — see the placeholder note in scripts/data/preprocess_data.py."
                role="Cyclone type filter, the phase-space diagram in the track panel, and the per-timestep structural label"
              />
            </div>
          </section>

          {/* Data Coverage */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Data Coverage
            </h2>
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">
              Not every diagnostic covers every cyclone, and not every diagnostic
              shares the same temporal resolution. This table is the honest
              summary of what exists behind each panel of the interface.
            </p>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left font-medium text-gray-600 px-4 py-2">Layer</th>
                      <th className="text-left font-medium text-gray-600 px-4 py-2">Cyclones</th>
                      <th className="text-left font-medium text-gray-600 px-4 py-2">Native step</th>
                      <th className="text-left font-medium text-gray-600 px-4 py-2">In this build</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    <tr>
                      <td className="px-4 py-2">Track position &amp; vor42</td>
                      <td className="px-4 py-2">6,789 (100 %)</td>
                      <td className="px-4 py-2">1-hourly</td>
                      <td className="px-4 py-2">as published</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Lifecycle phases</td>
                      <td className="px-4 py-2">6,789 (100 %)</td>
                      <td className="px-4 py-2">1-hourly</td>
                      <td className="px-4 py-2">~7.9 % of timesteps unlabelled at track edges</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">LEC energetics</td>
                      <td className="px-4 py-2">6,789 (100 %)</td>
                      <td className="px-4 py-2">3-hourly</td>
                      <td className="px-4 py-2">interpolated to 1-hourly, 97.8 % coverage</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">Cyclone Phase Space</td>
                      <td className="px-4 py-2">6,761 (99.6 %)</td>
                      <td className="px-4 py-2">3-hourly</td>
                      <td className="px-4 py-2">interpolated to 1-hourly, 87.3 % coverage</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">100 m wind (quadrants)</td>
                      <td className="px-4 py-2">6,789 (100 %)</td>
                      <td className="px-4 py-2">1-hourly</td>
                      <td className="px-4 py-2">as published, no interpolation</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-900 mb-1">
                Why exactly 6,789 cyclones?
              </p>
              <p className="text-amber-800 leading-relaxed">
                Because the LEC computation <em>is</em> the filter that produced this
                catalogue — the source file is literally named{" "}
                <code className="bg-amber-100 px-1 rounded text-xs">
                  tracks_SAt_filtered_with_energetics
                </code>
                . The phase-space classification was then computed over that same
                filtered set, which is why it never exceeds it. The 100 m wind
                dataset, computed over a broader tracking catalogue, contains{" "}
                <strong>1,198 additional cyclones</strong> that are not shown here:
                they have no position, vorticity, phase or energetics in this build,
                so they cannot be rendered as tracks.
              </p>
            </div>

            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-gray-800 mb-1">
                Processing levels — and what is still missing
              </p>
              <p className="text-gray-600 leading-relaxed">
                The interface distinguishes <strong>processed</strong> cyclones
                (full diagnostic stack: energetics, phases, genesis region) from{" "}
                <strong>track-only</strong> cyclones taken from the raw tracking
                catalogue. In the current build every cyclone is processed and the
                track-only count is zero: the full unfiltered catalogue
                (Gramcianinov et al., Mendeley{" "}
                <code className="bg-gray-100 px-1 rounded text-xs">10.17632/kwcvfr52hp.4</code>
                ) has <strong>not been ingested yet</strong>. The filter and the
                data model are already in place, so those tracks appear as soon as
                the catalogue is merged in. Note also that the published Mendeley
                version covers ERA5 only through <strong>2019</strong>, while this
                catalogue runs to January 2021 — the two do not span the same period.
              </p>
            </div>
          </section>

          {/* Preprocessing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Processing Pipeline
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Data Integration</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  The consolidated dataset merges cyclone tracks with LEC energetics by <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">track_id</code> and <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">date</code>. 
                  Genesis regions and lifecycle phases are obtained directly from the source data, having been pre-computed using 
                  established methodologies (see Data Sources above).
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Temporal Resolution &amp; Interpolation</h3>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-2">
                  <p className="text-blue-800 leading-relaxed">
                    <strong>Track data (lon, lat, vor42):</strong> 1-hourly resolution throughout.
                  </p>
                  <p className="text-blue-800 leading-relaxed">
                    <strong>LEC energetics (Az, Ae, Kz, Ke, Ca, Ce, Ck, Cz, BAz, BAe, BKz, BKe, Gz, Ge):</strong>{" "}
                    originally computed at <strong>3-hourly</strong> intervals (~33 % of track timesteps).
                    To provide a continuous time series, the 3-hourly values are{" "}
                    <strong>linearly interpolated</strong> to 1-hourly during preprocessing
                    (per-track, no extrapolation beyond the first/last available LEC value).
                    After interpolation, LEC coverage reaches ~97.8 % of all timesteps.
                  </p>
                  <p className="text-blue-800 leading-relaxed">
                    <strong>The original 3-hourly values are preserved exactly.</strong>{" "}
                    Interpolated values are physically reasonable estimates but carry additional uncertainty.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Identifying Original vs. Interpolated LEC Values</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-2">
                  The web interface distinguishes original and interpolated LEC values at each timestep:
                </p>
                <div className="bg-white border border-gray-200 rounded p-3 text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>Solid blue dot</strong> in the timestep list — LEC value from the original
                      3-hourly computation. Highest confidence.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 w-2.5 h-2.5 rounded-full border-2 border-blue-400 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>Open blue ring</strong> in the timestep list — LEC value was linearly
                      interpolated from the adjacent 3-hourly points. Use with care for detailed analysis.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 w-2.5 h-2.5 flex-shrink-0" />
                    <span className="text-gray-700">
                      <strong>No dot</strong> — no LEC data available at this timestep (first/last
                      timesteps of a track, where interpolation cannot be applied without extrapolating).
                    </span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                  The phase-averaged LEC diagrams and tables (Box Diagram view) report both the total
                  number of timesteps and the number of <em>original</em> timesteps used in each average,
                  so you can assess how much of the average comes from directly-computed values.
                </p>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                  For JSON files generated before the <code className="bg-gray-100 px-1 rounded">lec_original</code> flag
                  was added, the interface approximates original timesteps using the
                  heuristic <code className="bg-gray-100 px-1 rounded">UTC hour % 3 = 0</code>,
                  which is accurate because LEC is computed at 00, 03, 06 … 21 UTC.
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Column Standardization</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  The raw data columns are standardized during preprocessing:
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc list-inside">
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">lon vor</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">lon</code></li>
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded text-xs">lat vor</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">lat</code></li>
                  <li>Energetics derivative notation simplified (e.g., <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">∂Az/∂t</code> → <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">dAzdt</code>)</li>
                  <li>The <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">geometry</code> column (WKT) is dropped as redundant with lon/lat</li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Output Format</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  The final consolidated CSV (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">tracks_south_atlantic_consolidated.csv</code>) 
                  contains 631,009 timesteps across 6,789 cyclone tracks. For the web application, this is 
                  converted to static JSON files: a summary file (~10 MB) for map rendering and per-year detail 
                  files (~2 MB each) loaded on demand when inspecting individual tracks.
                </p>
              </div>
            </div>
          </section>

          {/* Methodology */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Scientific Methodology
            </h2>
            <div className="space-y-5">
              <MethodCard
                title="Cyclone Tracking"
                content={
                  <>
                    <p className="mb-3">
                      Extratropical cyclones are identified and tracked using the TRACK algorithm (Hodges, 1999) 
                      applied to 850 hPa relative vorticity fields. The algorithm detects local maxima (in the 
                      Southern Hemisphere, cyclonic systems correspond to positive vorticity anomalies after 
                      sign inversion) and links them across time to form coherent tracks.
                    </p>
                    <p>
                      The intensity metric <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">vor42</code> 
                      represents <strong>filtered and normalized relative vorticity</strong>. The absolute value 
                      is used to maintain positive values (×10⁻⁵ s⁻¹), providing a consistent intensity measure 
                      across the Southern Hemisphere cyclone dataset.
                    </p>
                  </>
                }
              />

              <MethodCard
                title="Genesis Regions"
                content={
                  <>
                    <p className="mb-3">
                      Cyclone genesis regions follow the classification of Gramcianinov et al. (2019), which 
                      identifies three main cyclogenesis hotspots in the Southwestern Atlantic:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Argentina / Patagonia (ARG):</strong> South of 45°S, associated with lee cyclogenesis downstream of the Andes</li>
                      <li><strong>SE South America (LA-PLATA):</strong> Over the La Plata basin and adjacent ocean (25–45°S)</li>
                      <li><strong>SE Brazil Coast (SE-BR):</strong> Near the Brazil–Malvinas Confluence (20–35°S)</li>
                    </ul>
                  </>
                }
              />

              <MethodCard
                title="Lifecycle Phases"
                content={
                  <>
                    <p className="mb-3">
                      Lifecycle phases are determined using the Cyclophaser algorithm (de Souza et al., JOSS 2025; 
                      de Souza et al., Int. J. Climatol. 2024), which objectively identifies phase transitions 
                      based on the temporal evolution of intensity:
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Incipient:</strong> Initial development, before the system reaches significant intensity</li>
                      <li><strong>Intensification:</strong> Rapid deepening phase with increasing vorticity</li>
                      <li><strong>Mature:</strong> Peak intensity window (vor42 near maximum)</li>
                      <li><strong>Decay:</strong> Weakening phase after the mature stage</li>
                    </ul>
                    <p className="mt-3 text-gray-500 text-sm">
                      Note: The source data may also include additional phases (intensification 2, mature 2, decay 2, 
                      residual) for systems with multiple intensification cycles.
                    </p>
                  </>
                }
              />

              <MethodCard
                title="Lorenz Energy Cycle (LEC)"
                content={
                  <>
                    <p className="mb-3">
                      The Lorenz Energy Cycle diagnostics quantify the energetics of each cyclone following a 
                      semi-Lagrangian approach: the atmosphere is partitioned into a cyclone-centered domain 
                      that moves with the system, and energy budget terms are computed relative to zonal (Az, Kz) 
                      and eddy (Ae, Ke) components.
                    </p>
                    <p className="mb-3">
                      The LEC climatology for South Atlantic cyclones is documented in De Souza et al. (2025, Climate Dynamics), 
                      which provides a comprehensive analysis of the energetic patterns across different genesis regions and 
                      lifecycle phases.
                    </p>
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                      <p className="font-medium mb-2">LEC Terms (sign conventions from LorenzCycleToolkit):</p>
                      <ul className="space-y-1">
                        <li><strong>Reservoirs:</strong> Az (zonal APE), Ae (eddy APE), Kz (zonal KE), Ke (eddy KE) — in J m⁻²</li>
                        <li><strong>Conversions:</strong> Ca (Az→Ae), Ce (Ae→Ke), Cz (Az→Kz) — positive = forward direction</li>
                        <li>
                          <strong>Ck:</strong> positive = Ke→Kz (barotropic <em>dissipation</em>);{" "}
                          <strong>negative = Kz→Ke</strong> (barotropic <em>development</em>, cyclone-growth pathway).
                          This convention is from LorenzCycleToolkit (de Souza et al., JOSS 2024):
                          the more negative Ck becomes, the stronger the barotropic conversion driving the cyclone.
                        </li>
                        <li><strong>Boundaries:</strong> BAz, BAe, BKz, BKe — net import through the moving domain boundary (W m⁻²). Positive = net import.</li>
                        <li><strong>Generation:</strong> Gz (zonal APE generation from meridional heating), Ge (eddy APE generation) — in W m⁻²</li>
                      </ul>
                    </div>
                    <p className="mt-3 text-gray-500 text-sm">
                      The LEC framework follows Lorenz (1955) as applied to extratropical cyclones in the
                      semi-Lagrangian formulation. The classical intensification pathway is:
                      Gz→Az →(Ca)→ Ae →(Ce)→ Ke, i.e., baroclinic conversion of available potential energy
                      into eddy kinetic energy. This appears as positive Ca and Ce during intensification.
                    </p>
                  </>
                }
              />

              <MethodCard
                title="Cyclone Phase Space (thermal structure)"
                content={
                  <>
                    <p className="mb-3">
                      Every cyclone is also placed in the{" "}
                      <strong>Cyclone Phase Space</strong> of Hart (2003), which
                      describes a system by three numbers rather than by a name:
                    </p>
                    <ul className="list-disc list-inside space-y-1 mb-3">
                      <li>
                        <strong>B</strong> — storm-motion-relative 900–600 hPa
                        thickness asymmetry (m). Large positive = frontal.
                      </li>
                      <li>
                        <strong>V<sub>T</sub><sup>L</sup></strong> — lower-tropospheric
                        thermal wind (900–600 hPa). Positive = warm core.
                      </li>
                      <li>
                        <strong>V<sub>T</sub><sup>U</sup></strong> — upper-tropospheric
                        thermal wind (600–300 hPa). Positive = warm core.
                      </li>
                    </ul>
                    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm mb-3">
                      <p className="font-medium mb-2">
                        Thresholds — de Souza et al. (2026), taking
                        extratropical/tropical from Wood et al. (2023) and
                        subtropical from Gozzo et al. (2014):
                      </p>
                      <ul className="space-y-1 font-mono text-xs">
                        <li>extratropical &nbsp; B &gt; 10, VTL &lt; 0, VTU &lt; 0</li>
                        <li>subtropical &nbsp;&nbsp;&nbsp; −25 &lt; B &lt; 25, VTL &gt; −50, VTU &lt; −10</li>
                        <li>tropical &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; B &lt; 10, VTL &gt; 0, VTU &gt; 0</li>
                      </ul>
                      <p className="mt-2 text-gray-600">
                        A timestep matching more than one specification is resolved
                        by the precedence tropical &gt; subtropical &gt; extratropical.
                      </p>
                    </div>
                    <p className="mb-3">
                      A class only becomes a <em>state</em> of the cyclone when it is
                      held for <strong>≥ 36 consecutive hours</strong> (Guishard et al.
                      2009; Gozzo et al. 2014). Persistent runs are then guarded,
                      because the phase space alone cannot separate a genuine
                      diabatic warm core from a Shapiro–Keyser{" "}
                      <strong>warm seclusion</strong>. A hybrid run is accepted only
                      if the cyclone underwent <em>cyclogenesis</em> between 20°S and
                      40°S (Gozzo criterion 1 — a condition on genesis, not on where
                      the run happens), spent at least half the run over ocean, and
                      began no more than 12 h after the cyclone&apos;s own intensity
                      peak. That last clause is the physical one: a diabatically built
                      warm core re-energises the system, so peak intensity follows the
                      structure, whereas a secluded warm core is the terminal stage of
                      a baroclinic life cycle and the peak has already passed. Of 804
                      persistent hybrid runs, 271 survived; 395 were rejected for
                      out-of-band genesis and 138 as warm seclusions. The interface
                      exposes the rejected warm-seclusion systems as their own filter.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm mb-3">
                      <p className="font-medium mb-1">
                        Identification vs description
                      </p>
                      <p className="text-gray-700">
                        The classes ending in{" "}
                        <code className="bg-white px-1 rounded text-xs">_like</code> —{" "}
                        <code className="bg-white px-1 rounded text-xs">SC_like</code>,{" "}
                        <code className="bg-white px-1 rounded text-xs">TC_like</code>,{" "}
                        <code className="bg-white px-1 rounded text-xs">EC_like</code> —
                        are <strong>not</strong> claims that the cyclone is of that type.
                        They record a structure that was shown but never sustained for
                        36 h, and none of the guards above was applied to them: 68% of{" "}
                        <code className="bg-white px-1 rounded text-xs">SC_like</code>{" "}
                        cyclones formed outside the 20–40°S band, and both{" "}
                        <code className="bg-white px-1 rounded text-xs">TC_like</code>{" "}
                        systems formed at 44°S and 52°S. They are therefore filtered
                        under <strong>Not sustained (&lt;36 h)</strong>, never under
                        Subtropical or Tropical.
                      </p>
                      <p className="text-gray-700 mt-2">
                        The same distinction exists per timestep. The Hart diagram
                        colours each point by its <em>raw</em> threshold label, which is
                        the correct thing to plot; the cyclone-level type comes from the
                        guarded classification, which is the correct thing to count.
                      </p>
                    </div>
                    <p className="text-gray-500 text-sm">
                      Two caveats worth carrying: the subtropical count is
                      threshold-sensitive by a factor of 6–8 across the threshold
                      sets tested, so any subtropical number should be quoted with
                      its threshold set attached; and the two cyclones classified{" "}
                      <code className="bg-gray-100 px-1 rounded text-xs">TC</code> are{" "}
                      <strong>unverified candidates</strong>, not identifications.
                    </p>
                  </>
                }
              />

              <MethodCard
                title="Interpolation of 3-hourly diagnostics"
                content={
                  <>
                    <p className="mb-3">
                      Both the LEC energetics and the phase-space parameters are
                      computed at <strong>3-hourly</strong> intervals while the
                      tracks are 1-hourly. Both are linearly interpolated to
                      1-hourly within each track, never across track boundaries and
                      never extrapolated beyond the first or last computed value.
                      Each carries a provenance flag —{" "}
                      <code className="bg-gray-100 px-1 rounded text-xs">lec_original</code>{" "}
                      and{" "}
                      <code className="bg-gray-100 px-1 rounded text-xs">cps_original</code>{" "}
                      — so a computed value is always distinguishable from an
                      interpolated one, in the interface and in the underlying files.
                    </p>
                    <p className="mb-3">
                      The phase-space parameters need extra care because they feed a
                      threshold classification. Structural labels at{" "}
                      <strong>original</strong> timesteps are carried through
                      verbatim from the upstream classifier; only interpolated
                      timesteps are labelled here, by applying the thresholds above
                      to the interpolated parameters. Re-deriving the labels at
                      original timesteps reproduces the upstream classifier for{" "}
                      <strong>100 % of 188,573 rows</strong>, which is the check that
                      keeps the two consistent.
                    </p>
                    <p className="text-gray-500 text-sm">
                      Anything persistence-based — including the ≥ 36 h gate behind
                      the per-cyclone classification — is computed on the original
                      3-hourly values only. Interpolated points inflate run lengths
                      and must never be fed to that test.
                    </p>
                  </>
                }
              />
            </div>
          </section>

          {/* Limitations */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Known Limitations
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    <strong>LEC interpolation:</strong> Energetics are originally at 3-hourly resolution (~33 % of timesteps).
                    The remaining ~65 % are linearly interpolated. The interface marks original timesteps
                    with a solid blue dot and interpolated ones with an open ring. Phase-averaged diagrams
                    report the split explicitly. Do not over-interpret individual interpolated values.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Approximately 7.9% of timesteps have null lifecycle phase labels (edge cases at track boundaries).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Track detection depends on the tracking algorithm's sensitivity thresholds; very weak or short-lived systems may be excluded.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>The reanalysis data (ERA5/CFSR) inherits limitations of the underlying assimilation systems, particularly in data-sparse oceanic regions.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>Static JSON files are publicly accessible by direct URL, bypassing password protection (Vercel CDN limitation).</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    <strong>CPS interpolation:</strong> phase-space parameters are
                    interpolated to 1-hourly the same way the energetics are, but
                    they feed a threshold classification. Labels at interpolated
                    timesteps are derived, not computed. Use the{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">cps_original</code>{" "}
                    flag to restrict to computed values, and never run
                    persistence-based statistics on the interpolated series.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    <strong>CPS dataset is unpublished.</strong> It has no DOI yet
                    and is copied into the repository by hand, so this part of the
                    pipeline is not reproducible from a public download. The
                    identifier will replace the placeholder once the Zenodo record
                    is minted.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    <strong>Subtropical counts are threshold-sensitive</strong> by a
                    factor of 6–8 across the threshold sets tested. The two{" "}
                    <code className="bg-gray-100 px-1 rounded text-xs">TC</code>{" "}
                    cyclones are unverified candidates. The 500 km phase-space
                    radius may not represent small, shallow SE-BR systems well.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>
                    <strong>The raw tracking catalogue is not ingested yet</strong>,
                    so the processing-level filter currently reports zero track-only
                    cyclones, and 1,198 cyclones present in the 100 m wind dataset
                    are absent from the map.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* References */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              References
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 text-sm">
              <Reference
                authors="Couto de Souza, D., da Silva Dias, P. L., Gramcianinov, C. B., & de Camargo, R."
                year="2024"
                title="New perspectives on South Atlantic storm track through an automatic method for detecting extratropical cyclones' lifecycle"
                journal="International Journal of Climatology"
                volume="44(10)"
                pages="3568–3588"
                doi="10.1002/joc.8566"
              />
              <Reference
                authors="De Souza, D. C., Silva Dias, P. L. D., Gramcianinov, C. B., & Camargo, R."
                year="2025"
                title="Lorenz Energy Cycle Climatology for the Southwestern Atlantic Cyclones"
                journal="Climate Dynamics"
                volume="63(11)"
                pages="1–26"
                doi="10.1007/s00382-024-07555-z"
              />
              <Reference
                authors="de Souza, D. C., da Silva Dias, P. L., Gramcianinov, C. B., & de Camargo, R."
                year="2025"
                title="Cyclophaser: A Python package for detecting extratropical cyclone life cycles"
                journal="Journal of Open Source Software"
                volume="10(108)"
                pages="7363"
                doi="10.21105/joss.07363"
              />
              <Reference
                authors="Gramcianinov, C. B., Hodges, K. I., & Camargo, R."
                year="2019"
                title="The properties and genesis environments of South Atlantic cyclones"
                journal="Climate Dynamics"
                volume="53(7)"
                pages="4115–4140"
                doi="10.1007/s00382-019-04778-7"
              />
              <Reference
                authors="Gramcianinov, C. B., Campos, R. M., de Camargo, R., Hodges, K. I., Guedes Soares, C., & Peliz, Á."
                year="2020"
                title="Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases"
                journal="Mendeley Data, V4"
                doi="10.17632/kwcvfr52hp.4"
              />
              <Reference
                authors="Hodges, K. I."
                year="1999"
                title="Adaptive constraints for feature tracking"
                journal="Monthly Weather Review"
                volume="127(6)"
                pages="1362–1373"
                doi="10.1175/1520-0493(1999)127<1362:ACFFT>2.0.CO;2"
              />
              <Reference
                authors="Lorenz, E. N."
                year="1955"
                title="Available potential energy and the maintenance of the general circulation"
                journal="Tellus"
                volume="7(2)"
                pages="157–167"
                doi="10.3402/tellusa.v7i2.8796"
              />
              <Reference
                authors="Hart, R. E."
                year="2003"
                title="A cyclone phase space derived from thermal wind and thermal asymmetry"
                journal="Monthly Weather Review"
                volume="131(4)"
                pages="585–616"
                doi="10.1175/1520-0493(2003)131<0585:ACPSDF>2.0.CO;2"
              />
              <Reference
                authors="Gozzo, L. F., da Rocha, R. P., Reboita, M. S., & Sugahara, S."
                year="2014"
                title="Subtropical cyclones over the southwestern South Atlantic: Climatological aspects and case study"
                journal="Journal of Climate"
                volume="27(22)"
                pages="8543–8562"
                doi="10.1175/JCLI-D-14-00149.1"
              />
              <Reference
                authors="Guishard, M. P., Evans, J. L., & Hart, R. E."
                year="2009"
                title="Atlantic subtropical storms. Part II: Climatology"
                journal="Journal of Climate"
                volume="22(13)"
                pages="3574–3594"
                doi="10.1175/2008JCLI2346.1"
              />
              <Reference
                authors="Gramcianinov, C. B., Campos, R. M., de Camargo, R., Hodges, K. I., Guedes Soares, C., & da Silva Dias, P. L."
                year="2020"
                title="Analysis of Atlantic extratropical storm tracks characteristics in 41 years of ERA5 and CFSR/CFSv2 databases"
                journal="Ocean Engineering"
                volume="216C"
                pages="108111"
                doi="10.1016/j.oceaneng.2020.108111"
              />
            </div>
            <p className="text-xs text-gray-400 mt-3 leading-relaxed">
              The subtropical/tropical threshold set attributed here to Wood et al.
              (2023) and to de Souza et al. (2026) follows the protocol documented in
              the <code className="bg-gray-100 px-1 rounded">paper_energy_patterns</code>{" "}
              project. Full bibliographic details for those two entries are pending
              alongside the CPS dataset deposit.
            </p>
          </section>

          {/* Footer */}
          <footer className="text-center text-xs text-gray-400 pt-8 pb-4">
            <p>
              South Atlantic Cyclone Monitor — IAG-USP / Petrobras–CENPES Cooperation
            </p>
            <p className="mt-1">
              Source code and data pipeline:{" "}
              <a
                href="https://github.com/daniloceano/cyclone_monitor_south_atlantic"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 transition"
              >
                GitHub
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────────────────────────

function DataSourceCard({
  title,
  description,
  citation,
  doi,
  doiUrl,
  role,
  pending = false,
  pendingNote,
}: {
  title: string;
  description: string;
  citation: string;
  /** Omit when the dataset has no DOI yet — pass `pending` instead. */
  doi?: string;
  doiUrl?: string;
  role: string;
  /** True when the dataset is used here but not yet formally published. */
  pending?: boolean;
  pendingNote?: string;
}) {
  return (
    <div
      className={`bg-white border rounded-lg p-5 ${
        pending ? "border-amber-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {pending && (
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide
                           bg-amber-100 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5">
            Unpublished
          </span>
        )}
      </div>
      <p className="text-gray-600 text-sm mb-3">{description}</p>
      <div className="text-sm space-y-2">
        <p className="text-gray-500">
          <span className="font-medium">Citation:</span>{" "}
          <span className="italic">{citation}</span>
        </p>
        {doi && doiUrl ? (
          <p>
            <span className="font-medium text-gray-500">DOI:</span>{" "}
            <a
              href={doiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {doi}
            </a>
          </p>
        ) : (
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <span className="font-medium">DOI:</span> not minted yet.{" "}
            {pendingNote ??
              "This dataset is still being prepared for deposit; the identifier will be added here once published."}
          </p>
        )}
        <p className="text-gray-500">
          <span className="font-medium">Role in this tool:</span> {role}
        </p>
      </div>
    </div>
  );
}

function MethodCard({
  title,
  content,
}: {
  title: string;
  content: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="text-gray-600 text-sm leading-relaxed">{content}</div>
    </div>
  );
}

function Reference({
  authors,
  year,
  title,
  journal,
  volume,
  pages,
  doi,
}: {
  authors: string;
  year: string;
  title: string;
  journal: string;
  volume?: string;
  pages?: string;
  doi: string;
}) {
  return (
    <p className="text-gray-700 leading-relaxed">
      {authors} ({year}). {title}. <em>{journal}</em>
      {volume && `, ${volume}`}
      {pages && `, ${pages}`}.{" "}
      <a
        href={`https://doi.org/${doi}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
      >
        https://doi.org/{doi}
      </a>
    </p>
  );
}
