# AutoDesign — Asset-Based AI Design Automation Workspace

> **Core Principle:** *"AI does not recreate the product. AI analyzes, arranges, and automates the design."*

**AutoDesign** is a static, frontend-only SaaS design automation prototype engineered for deployment on **GitHub Pages**. It demonstrates an end-to-end promotional design workflow that combines immutable source-of-truth product assets, deterministic Brand Kit governance, interactive visual composition, automated WCAG/layout validation, and rule-based multi-platform adaptation.

---

## 1. Architecture & Workflow Pipeline

```text
ASSETS + BRAND RULES
  → DESIGN ANALYSIS (Deterministic Rule Engine)
  → VISUAL COMPOSITION (DOM Interactive Canvas)
  → VALIDATION (11 Automated Governance & WCAG Checks)
  → RENDERING (Client-Side HTML5 Canvas & Vector SVG)
  → MULTI-PLATFORM OUTPUT (1:1, 4:5, 9:16, 16:9, Custom)
```

### Key Features

1. **Dashboard**: Workspace KPIs, quick actions, recent project cards with live-rendered composition thumbnails, recently used templates, asset approval breakdown, brand consistency summary, and audit activity log.
2. **Asset Library (Source-of-Truth Governance)**:
   - Supports 9 categories: *Product Photos, Transparent PNGs, Logos, Typography, Brand Colors, Icons, Backgrounds, Templates, and 3D Models*.
   - File input and drag-and-drop upload stored locally in **IndexedDB** with automatic Object URL lifecycle cleanup.
   - Immutable source file lock, approval status switching (*Approved, Pending, Rejected*), metadata editing, and brand/product assignment.
3. **Brand Kit**:
   - Synchronized color pickers and validated `#RRGGBB` hexadecimal inputs with live WCAG 2.1 relative luminance contrast calculation.
   - Typography hierarchy selection, product integrity rules, logo clear-space protection rules, background palette restrictions, and real-time poster preview.
4. **Design Studio (Interactive Composition Editor)**:
   - Three-panel layout (*Assets / Layers / Templates*, *Interactive Canvas*, and *Properties / AI Assistant / Version History*).
   - Pointer drag, 8-handle resize, snap-to-grid, center alignment guides, layer ordering, inline/panel text editing, undo/redo stack, and zoom/fit controls.
   - **Product Asset Integrity Protection**: Approved product cutouts and logos enforce proportional aspect-ratio locking and disable destructive cropping or filters.
   - **Sample Campaign**: Preloaded with the **Kopi Senja — Kopi Susu Original** promotional campaign (*Rp18.000 · "Temukan Jeda Terbaikmu" · "Pesan Sekarang"*).
5. **Rule-Based AI Design Assistant**:
   - Transparent, deterministic local recommendation engine evaluating visual hierarchy, WCAG contrast, bounding-box collisions, 8px grid alignment, and alternative balanced layouts without calling external AI APIs or altering product pixels.
6. **Validation Engine**:
   - Runs 11 automated checks (*Product Integrity, Asset Approval, Brand Colors, Logo Protection, Text Contrast, Element Overlap, Boundary Overflow, Aspect Ratio, Required Content Fields, Export Dimensions, and Missing Assets*).
   - Supports jumping directly to affected canvas layers, one-click automated fixes, and manual review sign-off (gated on zero critical errors).
7. **Multi-Platform Export**:
   - Rule-based JavaScript layout adaptation across *Instagram Square (1080×1080)*, *Instagram Portrait (1080×1350)*, *Story & Reels Cover (1080×1920)*, *Landscape Banner (1920×1080)*, and *Custom Dimensions*.
   - Client-side rendering and file download in **PNG**, **JPEG**, and **SVG** formats.

---

## 2. Technology Stack

- **HTML5** (Semantic markup & accessible dialog/navigation patterns)
- **CSS3** (Three-Layer Design Tokens: Primitive → Semantic → Component, 8px spacing scale, responsive layout)
- **Vanilla JavaScript (ES6+ Modules)** (Zero framework or build-step dependencies)
- **Tailwind CSS** (Official browser CDN integration)
- **Google Fonts (`Inter`) & Google Material Symbols Outlined**
- **Browser Persistence**: `localStorage` for workspace metadata & preferences + `IndexedDB` (`AutoDesignDB`) for uploaded image blobs and snapshots.

---

## 3. Project Structure

```text
/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml
├── index.html
├── 404.html
├── assets/
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── app.js
│   │   ├── store.js
│   │   ├── router.js
│   │   ├── utils.js
│   │   ├── dashboard.js
│   │   ├── asset-library.js
│   │   ├── brand-kit.js
│   │   ├── design-studio.js
│   │   ├── templates.js
│   │   ├── export.js
│   │   ├── validation.js
│   │   └── projects.js
│   └── images/
│       └── sample-assets/
│           ├── kopi-susu-original.png
│           ├── kopi-susu-studio.png
│           ├── cold-brew-senja.png
│           ├── pack-can-3d-render.png
│           ├── logo-kopi-senja.svg
│           ├── logo-kopi-senja-light.svg
│           ├── badge-arabica-100.svg
│           ├── bg-senja-warm.svg
│           ├── bg-roastery-dark.svg
│           ├── type-specimen-senja.svg
│           ├── palette-senja-swatches.svg
│           └── template-promo-thumb.svg
├── README.md
├── .gitignore
└── .nojekyll
```

---

## 4. Local Preview Instructions

Because the application uses native browser ES6 modules (`<script type="module" src="./assets/js/app.js"></script>`), serve the directory over a local HTTP server rather than opening `index.html` via the `file://` protocol:

### Option A: Using Python (Built-in)

```bash
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

### Option B: Using VS Code Live Server

1. Open the repository folder in Visual Studio Code.
2. Right-click `index.html` and select **Open with Live Server**.

---

## 5. GitHub Pages Deployment Instructions

All asset paths (`./assets/...`) and client-side hash routes (`#dashboard`, `#design-studio`, etc.) are strictly relative and compatible with both root domains and GitHub Pages project subpaths (`https://<username>.github.io/<repository-name>/`).

### Included GitHub Configuration Files

- **`.github/workflows/deploy-pages.yml`** — Automated GitHub Actions workflow (`actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`) that deploys the site on every push to `main` or `master`.
- **`.nojekyll`** — Disables Jekyll processing so folders and files starting with underscores or dots are served directly without modification.
- **`404.html`** — Custom GitHub Pages fallback page that automatically redirects known route paths (e.g., `/design-studio` → `/#design-studio`) or provides a direct return button to the workspace.
- **`.gitignore`** — Excludes local OS/IDE temporary files while explicitly keeping `.nojekyll`, `404.html`, and `.github/` tracked.

### Method A: Automated Deployment via GitHub Actions (Recommended)

1. Push the repository contents to GitHub (`main` or `master` branch).
2. In your GitHub repository, navigate to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The workflow in `.github/workflows/deploy-pages.yml` will run automatically on push (or can be triggered manually from the **Actions** tab) and publish the live URL.

### Method B: Direct Branch Deployment

1. Push the repository contents (including `.nojekyll` and `index.html` at the repository root) to your GitHub repository.
2. In your GitHub repository, navigate to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **Deploy from a branch**.
4. Select your branch (e.g., `main` or `master`) and the `/ (root)` folder, then click **Save**.
5. Wait approximately 1–2 minutes for GitHub Pages to publish your site, then open the provided HTTPS URL.
