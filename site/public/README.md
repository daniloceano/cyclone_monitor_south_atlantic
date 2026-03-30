# Public Assets Directory

This directory contains static assets served publicly by the web application.

## 🎯 Purpose

The `public/` directory stores:
- Images and icons
- Static map tiles or overlays
- Downloadable files
- Fonts (if not using CDN)
- Favicon and app icons

## 📁 Structure

```
public/
├── icons/                  # UI icons and markers
│   ├── cyclone-marker.svg  # Custom cyclone map marker
│   ├── favicon.ico         # Browser favicon
│   └── app-icon.png        # Application icon
├── images/                 # General images
│   ├── logo.png            # Project/institution logo
│   └── about/              # About page images
├── maps/                   # Static map assets
│   ├── basemaps/           # Offline basemap tiles (if needed)
│   └── overlays/           # Regional boundaries, ocean basins
├── downloads/              # User-downloadable files
│   └── sample-data.csv     # Example track data
└── README.md              # This file
```

## 🖼️ Asset Guidelines

### File Organization
- **Group by type**: Keep icons, images, and maps in separate subdirectories
- **Descriptive names**: Use clear, lowercase filenames with hyphens (e.g., `cyclone-marker-active.svg`)
- **Avoid duplication**: Reuse assets where possible

### Image Formats

Choose appropriate formats:
- **SVG**: Icons, logos, simple graphics (scalable, small file size)
- **PNG**: Screenshots, complex graphics with transparency
- **JPEG**: Photographs, complex images without transparency
- **WebP**: Modern format for web (smaller size, good quality)

### Optimization

Before committing images:
- Compress PNGs with `pngquant` or similar tools
- Optimize JPEGs (quality 80-85% is usually sufficient)
- Minimize SVGs with `svgo`
- Consider responsive images for different screen sizes

### Icons

Use consistent icon style:
- **Cyclone markers**: SVG format for map markers
- **UI icons**: Consider using an icon library (e.g., Heroicons, Lucide) instead of custom files
- **Favicon**: Include multiple sizes (16x16, 32x32, 48x48)

### Maps

For static map assets:
- **Basemaps**: Only if offline capability is required (otherwise use Leaflet tile providers)
- **Overlays**: GeoJSON or vector tiles preferred over raster
- **Boundaries**: Keep file sizes small; simplify geometries if needed

## 🌐 Accessing Assets in Next.js

Assets in `public/` are served from the root URL:

```tsx
// Correct usage in Next.js
<img src="/icons/logo.png" alt="Logo" />
<link rel="icon" href="/icons/favicon.ico" />

// In CSS
background-image: url('/images/background.jpg');
```

**Important**: Do NOT include `/public/` in the path.

## 📏 Size Considerations

Keep files small for performance:
- **Icons**: < 50 KB each
- **Images**: < 500 KB each (compress larger images)
- **Total public folder**: Aim for < 10 MB (excluding map tiles)

For very large assets:
- Consider CDN hosting
- Use external storage (e.g., cloud bucket)
- Lazy-load images

## 🎨 Branding Assets

Institutional branding:
- **IAG-USP logo**: Include if permitted by university guidelines
- **Petrobras logo**: If project is affiliated
- **Color scheme**: Document primary colors in `docs/` for consistency

## 🔒 Copyright and Licensing

Ensure all public assets are:
- Created by you
- Licensed for use (e.g., Creative Commons, public domain)
- Properly attributed if required

**Never commit**:
- Copyrighted images without permission
- Proprietary institutional assets without approval
- Large files from external sources (link to them instead)

## 📦 Third-Party Assets

If using external assets:
- Document source and license in comments or a `CREDITS.md` file
- Prefer linking to CDNs over local copies (saves repository size)
- Check license compatibility with your project

## 🧪 Testing Assets

Before deployment:
- Verify all images load correctly
- Test icons on different backgrounds
- Check favicon displays in browsers
- Validate SVGs render properly

## 📱 Responsive Images

For images displayed at multiple sizes:

```tsx
// Use Next.js Image component for optimization
import Image from 'next/image';

<Image 
  src="/images/logo.png" 
  alt="Logo"
  width={200}
  height={100}
  sizes="(max-width: 768px) 100vw, 200px"
/>
```

## 🗂️ Version Control

- ✅ **DO commit**: Icons, logos, small images essential to the UI
- ❌ **DON'T commit**: Temporary files, duplicates, unoptimized large images
- ⚠️ **Consider carefully**: Large background images, offline map tiles

## 📧 Questions?

For asset management and optimization questions, refer to the main repository documentation.
