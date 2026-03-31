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
                description="Semi-Lagrangian energetics computed for each cyclone following the system's center. Contains 24 terms including energy reservoirs (Az, Ae, Kz, Ke), conversion terms (Ca, Ck, Ce, Cz), boundary fluxes, generation terms, and residuals."
                citation="Couto de Souza, D. (2025). Southwestern Atlantic Cyclone Tracks and Semi-Lagrangian LEC diagnostics (1979–2020). Zenodo."
                doi="10.5281/zenodo.18133432"
                doiUrl="https://doi.org/10.5281/zenodo.18133432"
                role="All LEC energetics terms at 3-hourly resolution"
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
            </div>
          </section>

          {/* Preprocessing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-200 pb-2 mb-4">
              Data Preprocessing
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
                <h3 className="font-medium text-gray-900 mb-2">Temporal Resolution</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                  <p className="text-yellow-800 leading-relaxed">
                    <strong>Important:</strong> Track positions (lon, lat, vor42) are recorded at <strong>1-hourly</strong> intervals. 
                    LEC energetics are computed at <strong>3-hourly</strong> intervals. This means approximately 
                    <strong> 33% of timesteps</strong> contain energetics data — the remaining 67% have NaN values 
                    for energetics columns. This is expected behavior, not missing data.
                  </p>
                </div>
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
                      The 400 hPa vorticity (<code className="bg-gray-100 px-1 py-0.5 rounded text-xs">vor42</code>) 
                      is used as the primary intensity metric, capturing the cyclone's strength at mid-tropospheric 
                      levels where the systems are typically most intense.
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
                    <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-3 text-sm">
                      <p className="font-medium mb-2">LEC Terms:</p>
                      <ul className="space-y-1">
                        <li><strong>Reservoirs:</strong> Az (zonal APE), Ae (eddy APE), Kz (zonal KE), Ke (eddy KE) — in J m⁻²</li>
                        <li><strong>Conversions:</strong> Ca (APE conversion), Ck (Kz→Ke), Ce, Cz — in W m⁻²</li>
                        <li><strong>Boundaries:</strong> BAz, BAe, BKz, BKe (boundary fluxes), BΦZ, BΦE (pressure work) — in W m⁻²</li>
                        <li><strong>Generation:</strong> Gz (zonal), Ge (eddy) — in W m⁻²</li>
                      </ul>
                    </div>
                    <p className="mt-3 text-gray-500 text-sm">
                      The LEC framework follows Lorenz (1955) as applied to extratropical cyclones in the 
                      semi-Lagrangian formulation. Positive Ck and Ca indicate baroclinic conversion from 
                      available potential energy to eddy kinetic energy — the classical energetic pathway of 
                      intensifying extratropical cyclones.
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
                  <span>LEC energetics are only available at 3-hourly resolution (~33% of timesteps). Intermediate hours show NaN.</span>
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
            </div>
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
}: {
  title: string;
  description: string;
  citation: string;
  doi: string;
  doiUrl: string;
  role: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm mb-3">{description}</p>
      <div className="text-sm space-y-2">
        <p className="text-gray-500">
          <span className="font-medium">Citation:</span>{" "}
          <span className="italic">{citation}</span>
        </p>
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
