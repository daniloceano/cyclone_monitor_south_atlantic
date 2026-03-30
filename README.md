# South Atlantic Cyclone Monitor

An interactive web-based monitor for tracking and visualizing extratropical cyclone trajectories in the Southwest Atlantic Ocean.

## 🎯 Project Overview

This project provides an interactive platform to explore cyclone tracks in the South Atlantic region, with focus on analyzing trajectory patterns, energetics, and lifecycle characteristics of extratropical systems. The monitor is designed to support meteorological research and operational analysis by providing intuitive visualization and filtering capabilities.

## 📊 Data Source

The primary dataset is `tracks_SAt_filtered_with_energetics.csv`, which contains:
- Cyclone trajectory information (lat/lon coordinates, timestamps)
- Energetic parameters (intensity metrics, energy conversions)
- Lifecycle stages (genesis, maturation, decay)
- Track identification and classification

Additional data sources may include:
- ERA5 reanalysis data for environmental context
- Regional climatological boundaries
- Ocean-atmosphere interaction metrics

## 🏗️ Current Stage: Foundation

**This is the initial scaffolding stage.** The repository structure and documentation are prepared, but the interactive web application is **not yet implemented**.

### What's Ready
✅ Clean, scalable directory structure  
✅ Comprehensive documentation framework  
✅ Version control setup  
✅ Development environment configuration  
✅ Data organization guidelines  

### What's Coming Next
🔜 Interactive web application (Next.js + Leaflet)  
🔜 Cyclone track visualization on dynamic maps  
🔜 Advanced filtering and search capabilities  
🔜 Password-protected access  
🔜 Vercel deployment with CI/CD  

## 📁 Repository Structure

```
cyclone_monitor_south_atlantic/
├── data/                    # Raw and processed datasets
│   ├── tracks_SAt_filtered_with_energetics.csv (to be added)
│   └── README.md           # Data organization guide
├── scripts/                # Data ingestion and preprocessing
│   └── README.md           # Scripts documentation
├── src/                    # Application source code (future)
│   └── README.md           # Source code architecture
├── docs/                   # Technical documentation
│   └── README.md           # Documentation index
├── public/                 # Static assets (images, icons, etc.)
│   └── README.md           # Assets guidelines
├── types/                  # TypeScript type definitions (future)
│   └── README.md           # Type system documentation
├── .gitignore              # Version control exclusions
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🔧 Development Conventions

### Data Management
- **Raw data**: Place unmodified source files in `data/raw/`
- **Processed data**: Generated artifacts go in `data/processed/`
- **Version control**: Avoid committing files larger than 50MB; use Git LFS or external storage if needed

### Code Organization
- **Scripts**: One script per well-defined task; document inputs/outputs
- **Source code**: Modular architecture with clear separation of concerns
- **Documentation**: Keep technical decisions in `docs/decisions/`

### Naming Conventions
- **Files**: Use lowercase with underscores (e.g., `process_tracks.py`)
- **Directories**: Lowercase, descriptive names
- **Variables**: Follow language-specific conventions (snake_case for Python, camelCase for JavaScript/TypeScript)

## 🗺️ Roadmap

### Phase 1: Foundation (Current)
- [x] Repository structure
- [x] Documentation framework
- [ ] Add primary dataset (`tracks_SAt_filtered_with_energetics.csv`)

### Phase 2: Data Pipeline
- [ ] CSV parsing and validation scripts
- [ ] Data transformation to web-friendly formats (GeoJSON)
- [ ] Metadata extraction and indexing

### Phase 3: Web Application
- [ ] Next.js application setup
- [ ] Leaflet map integration
- [ ] Track visualization components
- [ ] Interactive filtering UI

### Phase 4: Advanced Features
- [ ] Password authentication
- [ ] Multi-track comparison
- [ ] Export capabilities (PNG, CSV, GeoJSON)
- [ ] Statistics dashboard

### Phase 5: Deployment
- [ ] Vercel deployment configuration
- [ ] CI/CD pipeline
- [ ] Performance optimization
- [ ] Production monitoring

## 🚀 Getting Started (Current Stage)

At this stage, the repository is ready for data population:

1. **Add your dataset**:
   ```bash
   # Place the main track file
   cp /path/to/your/tracks_SAt_filtered_with_energetics.csv data/
   ```

2. **Set up environment** (when implementing scripts):
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your configurations
   nano .env
   ```

3. **Explore the structure**:
   - Review `data/README.md` for data organization
   - Check `scripts/README.md` for planned automation
   - Read `docs/README.md` for technical documentation

## 📚 Documentation

- **`data/README.md`**: Dataset organization and guidelines
- **`scripts/README.md`**: Data processing pipeline documentation
- **`src/README.md`**: Application architecture and components
- **`docs/README.md`**: Comprehensive technical documentation index

## 🤝 Contributing

This is a research project. Contributions should:
- Follow the established directory structure
- Include appropriate documentation
- Maintain code quality and scientific rigor
- Document any new data sources or methodologies

## 📝 License

[To be determined - consider MIT, GPL, or academic license based on institutional requirements]

## 📧 Contact

For questions about this project, please contact the research team at IAG-USP.

---

**Note**: This repository is under active development. The interactive monitor will be implemented in subsequent phases. This README will be updated as features are added.
