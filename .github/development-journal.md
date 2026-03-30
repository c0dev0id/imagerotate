# Development Journal

## Software Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Vanilla JavaScript (ES5-compatible, IIFE) |
| Image editing | [Cropper.js](https://github.com/fengyuanchen/cropperjs) v1.x |
| Deployment | GitHub Pages via GitHub Actions |
| CI/CD | GitHub Actions (Node.js 24) |

## Core Features

- **EXIF orientation detection** – reads the orientation tag from JPEG binary data and displays a human-readable label, without relying on any external library.
- **Image editing** – crop, rotate (±90°), flip horizontal/vertical powered by Cropper.js.
- **Resize on export** – output is scaled to a user-specified longest-edge length while maintaining aspect ratio.
- **Format selection** – export as original format, JPEG, or PNG; EXIF metadata is stripped on export.
- **Drag-and-drop upload** – files can be dropped onto the upload area or selected via file picker.
- **Client-side only** – no server, no upload; all processing happens in the browser.

## Key Decisions

### ES5 / no build step
The codebase intentionally avoids a bundler or transpiler. Keeping it as plain ES5 minimises tooling, makes the source directly deployable, and aligns with the project's minimalist philosophy.

### Cropper.js vendored
`cropper.min.js` and `cropper.min.css` are vendored under `vendor/` and copied into `_site/vendor/` at deploy time, avoiding a runtime CDN dependency.

### EXIF read without library
A custom `readExifOrientation()` function parses the JPEG binary directly (DataView + APP1 segment walk). This keeps the dependency count low while covering all eight EXIF orientation values.

### GitHub Actions — Node.js 24
All actions updated to versions that natively target Node.js 24 (`checkout@v6`, `configure-pages@v6`, `upload-pages-artifact@v4`, `deploy-pages@v5`) to stay current with the GitHub Actions runner roadmap.
