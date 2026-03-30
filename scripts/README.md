# Scripts Directory

This directory contains all data processing, transformation, and utility scripts for the South Atlantic Cyclone Monitor.

## 🎯 Purpose

Scripts in this directory handle:
- Data ingestion and validation
- Format conversion (CSV → GeoJSON, etc.)
- Metadata extraction and indexing
- Statistical computations
- Dataset generation for the web application

## 📁 Planned Structure

```
scripts/
├── ingest/                 # Data ingestion and validation
│   ├── validate_tracks.py  # Check CSV integrity
│   └── import_data.py      # Move data to proper locations
├── transform/              # Data transformation
│   ├── csv_to_geojson.py   # Convert tracks to GeoJSON
│   ├── compute_metadata.py # Extract track statistics
│   └── generate_index.py   # Create searchable indices
├── analysis/               # Analytical computations
│   ├── track_statistics.py # Compute climatologies
│   └── energetics.py       # Process energy cycle data
├── utils/                  # Shared utilities
│   ├── io.py               # File I/O helpers
│   ├── validators.py       # Data validation functions
│   └── config.py           # Configuration management
└── README.md              # This file
```

## 🚀 Current Status

**Phase**: Not yet implemented

This directory is prepared for future development. Scripts will be added as the data pipeline is designed.

## 🔧 Development Guidelines

### Script Organization

Each script should:
- Have a single, well-defined purpose
- Accept inputs via command-line arguments or configuration files
- Log operations clearly (use Python's `logging` module)
- Handle errors gracefully
- Document inputs, outputs, and usage

### Example Script Template

```python
#!/usr/bin/env python3
"""
Script: process_tracks.py
Purpose: Convert cyclone track CSV to GeoJSON format
Author: [Your name]
Date: YYYY-MM-DD
"""

import argparse
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main(input_file: Path, output_dir: Path):
    """Main processing function."""
    logging.info(f"Processing {input_file}")
    # Processing logic here
    logging.info(f"Output saved to {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process cyclone tracks")
    parser.add_argument("input", type=Path, help="Input CSV file")
    parser.add_argument("-o", "--output", type=Path, default=Path("data/processed"),
                        help="Output directory")
    args = parser.parse_args()
    
    main(args.input, args.output)
```

### Naming Conventions

- **Python scripts**: `lowercase_with_underscores.py`
- **Shell scripts**: `lowercase-with-dashes.sh`
- **Utilities**: Prefix with `util_` or place in `utils/` subdirectory

### Dependencies

When scripts require Python packages:
1. Document in a `requirements.txt` at repository root
2. Use virtual environments for isolation
3. Pin versions for reproducibility

Example `requirements.txt`:
```
pandas>=2.0.0
geopandas>=0.14.0
numpy>=1.24.0
```

## 🔄 Typical Workflow

Future data processing pipeline:

1. **Validation**: `ingest/validate_tracks.py` checks CSV integrity
2. **Transformation**: `transform/csv_to_geojson.py` converts to web format
3. **Metadata**: `transform/compute_metadata.py` extracts track info
4. **Analysis**: `analysis/track_statistics.py` computes climatologies
5. **Indexing**: `transform/generate_index.py` creates search indices

## 📊 Input/Output Conventions

- **Inputs**: Read from `data/raw/` or accept file paths via CLI arguments
- **Outputs**: Write to `data/processed/` with clear subdirectory structure
- **Logs**: Output to `logs/` directory (gitignored)
- **Configurations**: Store in `config/` directory or `.env` file

## 🧪 Testing

Scripts should include:
- Input validation
- Error handling for common issues
- Sample test data in `tests/fixtures/`
- Unit tests where applicable

## 📝 Documentation

Each script should have:
- Docstring explaining purpose and usage
- Example command-line invocation in comments or `--help`
- Input/output format specifications

## 🔗 Integration with Web App

Scripts will generate web-ready data:
- **GeoJSON**: For Leaflet map rendering
- **JSON metadata**: For filtering and search
- **Statistics**: For dashboard displays

## ⚡ Performance Considerations

For large datasets:
- Use chunked processing (pandas `chunksize`)
- Implement progress bars (`tqdm`)
- Cache intermediate results
- Parallelize where appropriate (`multiprocessing`, `dask`)

## 📧 Questions?

For scripting conventions or pipeline design, refer to the main repository documentation.
