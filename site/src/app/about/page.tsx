"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { loadSources } from "@/lib/dataLoader";
import type { SourceEntry, SourcesRegistry } from "@/types/cyclone";

export default function AboutPage() {
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  // Provenance is rendered from data/metadata/sources.json rather than written
  // out here, so a DOI cannot be corrected in the registry and stay wrong on
  // this page.
  const [sources, setSources] = useState<SourcesRegistry | null>(null);
  useEffect(() => {
    loadSources().then(setSources);
  }, []);
  const src = (key: string): SourceEntry | null =>
    sources?.sources?.[key] ?? null;

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
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-2">
              Data Sources
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Grouped by what they contribute. Each group names its origin and
              what was done to it locally; the full citations are collected once
              in the <a href="#references" className="text-blue-600 hover:underline">References</a>.
            </p>
            <div className="space-y-6">
              <DataSourceGroup
                title="Cyclone tracking"
                lead={
                  <>
                    Every cyclone shown here comes from one catalogue of
                    Southwestern Atlantic tracks, distributed together with its
                    energetics. Systems were identified by feature tracking of
                    relative vorticity at 850&nbsp;hPa in ERA5, spectrally
                    filtered to T42 — which is what the interface calls{" "}
                    <em>central relative vorticity</em>. Positions are 1-hourly.
                    Column names are standardised on ingest; no track is
                    subsetted, resampled or reprojected.
                  </>
                }
                entries={[
                  { key: "tracks_lec", label: "Distributed dataset", entry: src("tracks_lec") },
                  { key: "tracking_method", label: "Tracking dataset and method", entry: src("tracking_method") },
                  { key: "genesis_regions", label: "Genesis regions", entry: src("genesis_regions") },
                ]}
              />

              <DataSourceGroup
                title="Lorenz Energy Cycle"
                lead={
                  <>
                    Semi-Lagrangian energetics computed in a box that follows
                    each cyclone: the four reservoirs (A<sub>Z</sub>, A<sub>E</sub>,
                    K<sub>Z</sub>, K<sub>E</sub>), the conversion, generation and
                    boundary terms, and the residuals. They ship inside the same
                    archive as the tracks, so the data and the method it
                    implements are one origin, not two. Native resolution is
                    3-hourly; values are linearly interpolated to 1-hourly within
                    each track and every timestep carries a flag saying whether
                    it was computed or interpolated.
                  </>
                }
                entries={[
                  { key: "tracks_lec", label: "Distributed dataset", entry: src("tracks_lec") },
                  { key: "lec_method", label: "Method and climatology", entry: src("lec_method") },
                ]}
              />

              <DataSourceGroup
                title="Cyclone Phase Space"
                lead={
                  <>
                    Thermal-structure diagnostics in the Hart (2003) framework —
                    the thickness asymmetry <em>B</em> and the lower and upper
                    thermal winds <em>V<sub>T</sub><sup>L</sup></em> and{" "}
                    <em>V<sub>T</sub><sup>U</sup></em> — at two deliberately
                    separate grains: a <strong>state at each timestep</strong> and
                    a <strong>category for the cyclone as a whole</strong>.
                    Parameters are 3-hourly and are joined to the hourly track by
                    exact timestamp.
                  </>
                }
                entries={[
                  { key: "cyclone_phase_space", label: "Classification dataset", entry: src("cyclone_phase_space") },
                ]}
              />

              <DataSourceGroup
                title="Wind diagnostics"
                lead={
                  <>
                    Per-quadrant wind extrema at <strong>10&nbsp;m</strong> and{" "}
                    <strong>100&nbsp;m</strong>. Two companion datasets by the
                    same author, built with the same method: for every cyclone a
                    20°×20° domain is centred on the core, and within a circular
                    mask of 9.5° radius — after Gaussian smoothing (σ&nbsp;=&nbsp;0.25)
                    — the absolute maximum and the 99th percentile are taken in
                    each of the four quadrants, at every hour of the life cycle.
                    Both statistics are shown in the track panel; only the maximum
                    is used to rank a whole cyclone.
                  </>
                }
                entries={[
                  { key: "wind10", label: "10 m", entry: src("wind10") },
                  { key: "wind100", label: "100 m", entry: src("wind100") },
                ]}
              />

              <DataSourceGroup
                title="Lifecycle phases and underlying reanalysis"
                lead={
                  <>
                    Lifecycle phases are assigned objectively from the vorticity
                    evolution of each track. Every dataset above is ultimately
                    derived from the same reanalysis; the monitor never reads it
                    directly.
                  </>
                }
                entries={[
                  { key: "lifecycle_phases", label: "Lifecycle phases", entry: src("lifecycle_phases") },
                  { key: "era5", label: "Reanalysis", entry: src("era5") },
                  { key: "sedimentary_basins", label: "Sedimentary basins", entry: src("sedimentary_basins") },
                ]}
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
                      <td className="px-4 py-2">Track position &amp; central relative vorticity</td>
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
                      <td className="px-4 py-2">6,776 (99.8 %)</td>
                      <td className="px-4 py-2">3-hourly</td>
                      <td className="px-4 py-2">
                        interpolated to 1-hourly, 87.3 % coverage; 6,761 carry at
                        least one computed timestep
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">10 m wind (quadrants)</td>
                      <td className="px-4 py-2">6,789 (100 %)</td>
                      <td className="px-4 py-2">1-hourly</td>
                      <td className="px-4 py-2">as published, no interpolation</td>
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
                filtered set, which is why it never exceeds it. The two wind
                datasets, computed over a broader tracking catalogue, each contain{" "}
                <strong>1,198 additional cyclones</strong> that are not shown here:
                they have no position, vorticity, phase or energetics in this build,
                so they cannot be rendered as tracks.
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
                    <strong>Track data (lon, lat, central relative vorticity):</strong>{" "}
                    1-hourly resolution throughout.
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
                      The interface calls this quantity{" "}
                      <strong>central relative vorticity</strong>: relative
                      vorticity at 850&nbsp;hPa, spectrally filtered to T42 — the
                      truncation the tracking is performed at, and the origin of
                      the internal column name{" "}
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">vor42</code>.
                      It is stored as a magnitude, so values are positive
                      (×10⁻⁵&nbsp;s⁻¹) for Southern-Hemisphere cyclones; the sign
                      convention is not altered anywhere in the interface.
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
                      <li><strong>Mature:</strong> Peak intensity window (vorticity near maximum)</li>
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
                      persistent hybrid runs, 271 survived and the rest were
                      rejected — most for out-of-band genesis, the remainder as
                      warm seclusions. Counting cyclones rather than runs,{" "}
                      <strong>147</strong> had at least one run rejected as a warm
                      seclusion; the interface exposes those as their own filter.
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
                title="Wind diagnostics (10 m and 100 m)"
                content={
                  <>
                    <p className="mb-3">
                      For every cyclone and every hour of its life cycle, a
                      20°×20° domain is centred on the core. Within a circular
                      mask of 9.5° radius — after Gaussian smoothing with
                      σ&nbsp;=&nbsp;0.25 — two statistics are extracted{" "}
                      <strong>separately in each of the four quadrants</strong>:
                      the absolute maximum wind speed and the 99th percentile.
                      The same procedure is applied at both heights, so the two
                      levels are directly comparable.
                    </p>
                    <p className="mb-3">
                      <strong>Maximum and 99th percentile answer different
                      questions.</strong> The maximum is the single strongest grid
                      point and is therefore sensitive to isolated artefacts of the
                      reanalysis grid; the 99th percentile is more robust and better
                      describes the broad strength of the wind field. Both are
                      reported per quadrant in the track panel, and the MAX / P99
                      toggle switches between them.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                      <p className="text-blue-900 font-medium mb-1">
                        Ranking a whole cyclone uses the maximum only
                      </p>
                      <p className="text-blue-800 leading-relaxed">
                        When wind is the display variable, a cyclone&apos;s intensity
                        is the largest of the four quadrant maxima, taken over all
                        of its timesteps. That mirrors exactly how the vorticity
                        intensity is defined — the peak value along the track — so
                        the three display variables rank cyclones on the same
                        principle. The 99th percentile is never used for this: it is
                        a description of a wind field at an instant, not a measure
                        of how strong a system got.
                      </p>
                    </div>
                    <p className="mb-3">
                      <strong>Distances are Euclidean degrees.</strong> The
                      distance from a quadrant extremum to the cyclone centre is
                      the plain hypotenuse of the longitude and latitude offsets,
                      not a great-circle distance. It is reported as published.
                    </p>
                    <p>
                      <strong>Quadrant labels are corrected for display.</strong>{" "}
                      The source files label quadrants with north and south
                      inverted relative to geographic convention. The stored data
                      keep the original labels so they remain a faithful copy of
                      the archive; the correction is applied only where a label is
                      shown, so the label on screen always matches the position of
                      the marker on the map.
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
                    1,198 cyclones present in the 100 m wind dataset are still absent
                    from the map: they carry no centre position in any ingested
                    source. Their centres are in principle recoverable from the wind
                    quadrant geometry, but that has not been done.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          {/* References */}
          <section id="references">
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              References
            </h2>
            <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Datasets
              </p>
              <Reference
                authors="Couto de Souza, D., & Gramcianinov, C. B."
                year="2025"
                title="Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020) [Data set]"
                journal="Zenodo"
                doi="10.5281/zenodo.18133432"
              />
              <Reference
                authors="Gramcianinov, C. B., Campos, R. M., de Camargo, R., Hodges, K. I., Guedes Soares, C., & Peliz, Á."
                year="2020"
                title="Atlantic extratropical cyclone tracks in 41 years of ERA5 and CFSR/CFSv2 databases, V4 [Data set]"
                journal="Mendeley Data"
                doi="10.17632/kwcvfr52hp.4"
              />
              <Reference
                authors="Paredes Quispe, J. A."
                year="2026"
                title="Maximum and 99th percentile wind speeds at 10 meters within a Lagrangian domain centered on extratropical cyclones in the South Atlantic (1979–2020) [Data set]"
                journal="Zenodo"
                doi="10.5281/zenodo.19378255"
              />
              <Reference
                authors="Paredes Quispe, J. A."
                year="2026"
                title="Maximum wind speeds and 99th percentile values at 100 meters associated with extratropical cyclones in the South Atlantic (1979–2020) [Data set]"
                journal="Zenodo"
                doi="10.5281/zenodo.19353037"
              />

              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 pt-2">
                Methods and background
              </p>
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
              <Reference
                authors="Hersbach, H., Bell, B., Berrisford, P., Hirahara, S., Horányi, A., Muñoz-Sabater, J., et al."
                year="2020"
                title="The ERA5 global reanalysis"
                journal="Quarterly Journal of the Royal Meteorological Society"
                volume="146(730)"
                pages="1999–2049"
                doi="10.1002/qj.3803"
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

/**
 * One thematic group of sources.
 *
 * Grouping is the point: several entries here share an origin (the tracks and
 * the energetics ship in one archive; the two wind heights are companion
 * releases by one author), and listing them as independent "sources" implied a
 * provenance that does not exist. The lead paragraph says what the information
 * is, where it comes from and what was done to it; the rows below carry the
 * formal identifiers.
 *
 * Every row is rendered from the provenance registry, so the DOIs on this page
 * cannot drift from the ones the pipeline records.
 */
function DataSourceGroup({
  title,
  lead,
  entries,
}: {
  title: string;
  lead: React.ReactNode;
  entries: { key: string; label: string; entry: SourceEntry | null }[];
}) {
  const present = entries.filter((e) => e.entry !== null);
  const anyPending = present.some((e) => e.entry?.pending);

  return (
    <div
      className={`bg-white border rounded-lg p-5 ${
        anyPending ? "border-amber-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {anyPending && (
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide
                           bg-amber-100 text-amber-800 border border-amber-300 rounded px-1.5 py-0.5">
            Includes unpublished data
          </span>
        )}
      </div>

      <div className="text-gray-600 text-sm mb-4 leading-relaxed">{lead}</div>

      {present.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Loading provenance…</p>
      ) : (
        <dl className="space-y-2.5 border-t border-gray-100 pt-3">
          {present.map(({ key, label, entry }) => (
            <div key={key} className="text-sm">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {label}
              </dt>
              <dd className="text-gray-700">
                <span className="italic">{entry!.name}</span>
                {entry!.authors && entry!.authors.length > 0 && (
                  <span className="text-gray-500">
                    {" "}— {entry!.authors.join("; ")}
                    {entry!.year ? ` (${entry!.year})` : ""}
                  </span>
                )}
                {entry!.doi ? (
                  <>
                    {" "}
                    <a
                      href={entry!.url ?? `https://doi.org/${entry!.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline whitespace-nowrap"
                    >
                      {entry!.doi}
                    </a>
                  </>
                ) : entry!.pending ? (
                  /* Unpublished: flag it, because the data cannot be obtained
                     from a public download and the result is not yet citable. */
                  <span className="block mt-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-xs">
                    <span className="font-medium">No DOI yet.</span>{" "}
                    {entry!.pending_note ??
                      "Being prepared for deposit; the identifier will appear here once published."}
                  </span>
                ) : entry!.url ? (
                  /* Published but not DOI-minted — e.g. an agency data portal.
                     A link is the right identifier; the amber warning is not. */
                  <>
                    {" "}
                    <a
                      href={entry!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {entry!.url.replace(/^https?:\/\//, "")}
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      )}
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
