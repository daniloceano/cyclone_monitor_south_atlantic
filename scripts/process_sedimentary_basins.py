#!/usr/bin/env python3
"""
Process Brazilian sedimentary basin shapefiles into a web-ready GeoJSON file.

This script reads individual basin shapefiles from data/sedimentary_basins/,
validates and standardizes them, then produces a combined GeoJSON file
suitable for display in the web application.

Input:
    data/sedimentary_basins/{basin_folder}/bacias_gishub_db.shp

Output:
    site/public/data/basins.geojson

Data source: Brazilian offshore sedimentary basins (all maritime/offshore)
CRS: All input shapefiles are EPSG:4326 (WGS84), output maintains this CRS.

Author: Cyclone Monitor Team
Date: 2026-04
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
from shapely.validation import make_valid

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
BASINS_INPUT_DIR = PROJECT_ROOT / "data" / "sedimentary_basins"
GEOJSON_OUTPUT = PROJECT_ROOT / "site" / "public" / "data" / "basins.geojson"


def normalize_basin_id(name: str) -> str:
    """
    Convert basin name to a normalized ID.
    
    Examples:
        "Santos" -> "santos"
        "Espírito Santo" -> "espirito-santo"
        "Pará-Maranhão" -> "para-maranhao"
        "SEAL_Mar" -> "seal"
    """
    # Remove _Mar suffix
    name = re.sub(r'_Mar$', '', name)
    # Convert to lowercase
    name = name.lower()
    # Replace accented characters
    replacements = {
        'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
        'é': 'e', 'ê': 'e',
        'í': 'i',
        'ó': 'o', 'ô': 'o', 'õ': 'o',
        'ú': 'u',
        'ç': 'c',
    }
    for acc, plain in replacements.items():
        name = name.replace(acc, plain)
    # Replace underscores and spaces with hyphens
    name = re.sub(r'[_\s]+', '-', name)
    # Remove any remaining non-alphanumeric except hyphens
    name = re.sub(r'[^a-z0-9-]', '', name)
    # Clean up multiple hyphens
    name = re.sub(r'-+', '-', name)
    return name.strip('-')


def format_display_name(name: str) -> str:
    """
    Create a user-friendly display name for a basin.
    
    Examples:
        "Santos" -> "Bacia de Santos"
        "Campos_Mar" -> "Bacia de Campos"
        "Espírito Santo" -> "Bacia do Espírito Santo"
    """
    # Remove _Mar suffix
    clean_name = re.sub(r'_Mar$', '', name)
    
    # Special cases for grammatical agreement in Portuguese
    # "do" is used before masculine names starting with consonant
    # "da" before feminine names
    # "de" before names starting with vowel or that don't take articles
    special_cases = {
        'santos': 'Bacia de Santos',
        'campos': 'Bacia de Campos',
        'pelotas': 'Bacia de Pelotas',
        'espirito santo': 'Bacia do Espírito Santo',
        'ceara': 'Bacia do Ceará',
        'para-maranhao': 'Bacia do Pará-Maranhão',
        'seal': 'Bacia de Sergipe-Alagoas (SEAL)',
    }
    
    normalized = normalize_basin_id(clean_name)
    if normalized in special_cases:
        return special_cases[normalized]
    
    # Default: "Bacia de {name}"
    return f"Bacia de {clean_name}"


def load_and_process_basins() -> gpd.GeoDataFrame:
    """
    Load all basin shapefiles and combine into a single GeoDataFrame.
    
    Returns:
        GeoDataFrame with standardized columns and validated geometries.
    """
    basins = []
    errors = []
    
    # Find all basin folders
    if not BASINS_INPUT_DIR.exists():
        raise FileNotFoundError(f"Basins directory not found: {BASINS_INPUT_DIR}")
    
    folders = [f for f in BASINS_INPUT_DIR.iterdir() 
               if f.is_dir() and not f.name.startswith('.')]
    
    if not folders:
        raise FileNotFoundError(f"No basin folders found in {BASINS_INPUT_DIR}")
    
    print(f"Found {len(folders)} basin folders")
    
    for folder in sorted(folders):
        shp_path = folder / "bacias_gishub_db.shp"
        
        if not shp_path.exists():
            errors.append(f"Shapefile not found: {shp_path}")
            continue
        
        try:
            gdf = gpd.read_file(shp_path)
            
            # Validate CRS
            if gdf.crs is None:
                print(f"  WARNING: {folder.name} has no CRS, assuming EPSG:4326")
                gdf = gdf.set_crs("EPSG:4326")
            elif gdf.crs.to_epsg() != 4326:
                print(f"  WARNING: {folder.name} has CRS {gdf.crs}, reprojecting to EPSG:4326")
                gdf = gdf.to_crs("EPSG:4326")
            
            # Get basin name from the 'name' attribute
            if 'name' not in gdf.columns:
                errors.append(f"{folder.name}: missing 'name' attribute")
                continue
            
            raw_name = gdf['name'].iloc[0]
            basin_id = normalize_basin_id(raw_name)
            display_name = format_display_name(raw_name)
            
            # Validate and fix geometry if needed
            geometry = gdf.geometry.iloc[0]
            if not geometry.is_valid:
                print(f"  Fixing invalid geometry for {raw_name}")
                geometry = make_valid(geometry)
            
            # Compute bounding box
            bounds = geometry.bounds  # (minx, miny, maxx, maxy)
            bbox = [round(b, 6) for b in bounds]
            
            # Create standardized record
            basin_record = {
                'id': basin_id,
                'name': raw_name,
                'display_name': display_name,
                'bbox': bbox,
                'area_km2': round(geometry.area * 111.32**2, 1),  # rough km² at equator
                'geometry': geometry,
            }
            
            basins.append(basin_record)
            print(f"  ✓ {raw_name} -> {basin_id}")
            
        except Exception as e:
            errors.append(f"{folder.name}: {e}")
    
    if errors:
        print("\nErrors encountered:")
        for err in errors:
            print(f"  ✗ {err}")
    
    if not basins:
        raise ValueError("No basins were successfully loaded")
    
    # Create combined GeoDataFrame
    combined = gpd.GeoDataFrame(basins, crs="EPSG:4326")
    
    # Sort by latitude (south to north) for consistent ordering
    combined['sort_lat'] = combined.geometry.centroid.y
    combined = combined.sort_values('sort_lat', ascending=True)
    combined = combined.drop(columns=['sort_lat'])
    combined = combined.reset_index(drop=True)
    
    return combined


def save_geojson(gdf: gpd.GeoDataFrame, output_path: Path) -> None:
    """
    Save GeoDataFrame as GeoJSON with custom properties.
    
    The output includes metadata and properly structured features
    optimized for web consumption.
    """
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Build custom GeoJSON structure
    features = []
    for _, row in gdf.iterrows():
        feature = {
            "type": "Feature",
            "id": row['id'],
            "properties": {
                "id": row['id'],
                "name": row['name'],
                "display_name": row['display_name'],
                "bbox": row['bbox'],
                "area_km2": row['area_km2'],
            },
            "geometry": row['geometry'].__geo_interface__,
        }
        features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(timespec='seconds'),
            "crs": "EPSG:4326",
            "description": "Brazilian offshore sedimentary basins",
            "source": "data/sedimentary_basins/ shapefiles",
            "total_basins": len(features),
        },
        "features": features,
    }
    
    # Write with minimal whitespace for production
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(',', ':'))
    
    # Pretty-printed copy for inspection. It goes to data/interim/ rather than
    # beside the production file: nothing fetches it, and under site/public/ it
    # was 2.4 MB of committed, deployed dead weight.
    debug_dir = PROJECT_ROOT / "data" / "interim"
    debug_dir.mkdir(parents=True, exist_ok=True)
    debug_path = debug_dir / (output_path.stem + '.debug.geojson')
    with open(debug_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    
    # Report file sizes
    size_kb = output_path.stat().st_size / 1024
    print(f"\nOutput written to: {output_path}")
    print(f"File size: {size_kb:.1f} KB")


def main():
    """Main entry point."""
    print("=" * 60)
    print("Processing Brazilian Sedimentary Basins")
    print("=" * 60)
    print()
    
    try:
        # Load and process
        gdf = load_and_process_basins()
        
        print(f"\nSuccessfully processed {len(gdf)} basins:")
        for _, row in gdf.iterrows():
            print(f"  {row['id']:25s} {row['display_name']}")
        
        # Save output
        save_geojson(gdf, GEOJSON_OUTPUT)
        
        print("\n✓ Basin processing complete!")
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
