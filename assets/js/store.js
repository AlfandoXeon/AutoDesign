/**
 * AutoDesign — Central State Store & Local Persistence (localStorage + IndexedDB)
 * Manages assets, brand kit rules, projects, templates, snapshots, validation history, and settings.
 */

import { uid } from './utils.js';

const STORAGE_KEY = 'autodesign_workspace_state_v1';
const IDB_NAME = 'AutoDesignDB';
const IDB_VERSION = 1;

const objectUrlRegistry = new Map();

/* ==========================================================================
   IndexedDB Helper for Uploaded Image Blobs & Version Snapshots
   ========================================================================== */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('assetBlobs')) {
        db.createObjectStore('assetBlobs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveBlobToIdb(assetId, blob) {
  try {
    const db = await openDatabase();
    if (!db) return false;
    return await new Promise((resolve) => {
      const tx = db.transaction('assetBlobs', 'readwrite');
      tx.objectStore('assetBlobs').put({ id: assetId, blob, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function loadBlobFromIdb(assetId) {
  try {
    const db = await openDatabase();
    if (!db) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction('assetBlobs', 'readonly');
      const req = tx.objectStore('assetBlobs').get(assetId);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteBlobFromIdb(assetId) {
  try {
    if (objectUrlRegistry.has(assetId)) {
      URL.revokeObjectURL(objectUrlRegistry.get(assetId));
      objectUrlRegistry.delete(assetId);
    }
    const db = await openDatabase();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction('assetBlobs', 'readwrite');
      tx.objectStore('assetBlobs').delete(assetId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB deletion errors
  }
}

export async function clearAllIdbData() {
  for (const [, url] of objectUrlRegistry.entries()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  }
  objectUrlRegistry.clear();
  try {
    const db = await openDatabase();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(['assetBlobs', 'snapshots'], 'readwrite');
      tx.objectStore('assetBlobs').clear();
      tx.objectStore('snapshots').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

export function registerObjectUrl(assetId, blob) {
  if (objectUrlRegistry.has(assetId)) {
    URL.revokeObjectURL(objectUrlRegistry.get(assetId));
  }
  const url = URL.createObjectURL(blob);
  objectUrlRegistry.set(assetId, url);
  return url;
}

/* ==========================================================================
   Default Built-in Sample Data (Kopi Senja Campaign & Assets)
   ========================================================================== */

export function getInitialSampleAssets() {
  return [
    {
      id: 'ast_kopi_susu_png',
      name: 'Kopi Susu Original (Cutout)',
      originalFileName: 'kopi-susu-original.png',
      category: 'Transparent PNGs',
      format: 'PNG',
      width: 800,
      height: 1000,
      sizeBytes: 184320,
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v1.0 (Source of Truth)',
      src: './assets/images/sample-assets/kopi-susu-original.png',
      description: 'Official studio transparent cutout of Iced Kopi Susu Original cup with palm sugar layer.',
      tags: ['kopi susu', 'cup', 'iced', 'hero product', 'transparent'],
      createdAt: '2026-10-15T09:00:00.000Z'
    },
    {
      id: 'ast_kopi_susu_studio',
      name: 'Kopi Susu Studio Pedestal',
      originalFileName: 'kopi-susu-studio.png',
      category: 'Product Photos',
      format: 'PNG',
      width: 900,
      height: 900,
      sizeBytes: 245760,
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v1.0 (Source of Truth)',
      src: './assets/images/sample-assets/kopi-susu-studio.png',
      description: 'Warm travertine pedestal product photography of Kopi Susu Original.',
      tags: ['studio', 'pedestal', 'product photo', 'kopi susu'],
      createdAt: '2026-10-15T09:15:00.000Z'
    },
    {
      id: 'ast_cold_brew_png',
      name: 'Cold Brew Signature 250ml',
      originalFileName: 'cold-brew-senja.png',
      category: 'Transparent PNGs',
      format: 'PNG',
      width: 800,
      height: 1000,
      sizeBytes: 162400,
      brand: 'Kopi Senja',
      product: 'Cold Brew Signature',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v1.0 (Source of Truth)',
      src: './assets/images/sample-assets/cold-brew-senja.png',
      description: '250ml apothecary amber bottle of Single Origin Gayo Cold Brew.',
      tags: ['cold brew', 'bottle', 'gayo', 'transparent'],
      createdAt: '2026-10-16T10:20:00.000Z'
    },
    {
      id: 'ast_logo_dark',
      name: 'Kopi Senja Primary Logo',
      originalFileName: 'logo-kopi-senja.svg',
      category: 'Logos',
      format: 'SVG',
      width: 420,
      height: 120,
      sizeBytes: 4120,
      brand: 'Kopi Senja',
      product: 'Brand Identity',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v2.1 (Master Mark)',
      src: './assets/images/sample-assets/logo-kopi-senja.svg',
      description: 'Primary horizontal wordmark and horizon sun emblem for light backgrounds.',
      tags: ['logo', 'wordmark', 'primary', 'vector'],
      createdAt: '2026-10-12T08:00:00.000Z'
    },
    {
      id: 'ast_logo_light',
      name: 'Kopi Senja Light Logo (Reverse)',
      originalFileName: 'logo-kopi-senja-light.svg',
      category: 'Logos',
      format: 'SVG',
      width: 420,
      height: 120,
      sizeBytes: 4280,
      brand: 'Kopi Senja',
      product: 'Brand Identity',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v2.1 (Reverse Mark)',
      src: './assets/images/sample-assets/logo-kopi-senja-light.svg',
      description: 'Reverse light wordmark for dark espresso backgrounds.',
      tags: ['logo', 'light', 'dark mode', 'vector'],
      createdAt: '2026-10-12T08:05:00.000Z'
    },
    {
      id: 'ast_badge_arabica',
      name: '100% Arabica Quality Seal',
      originalFileName: 'badge-arabica-100.svg',
      category: 'Icons',
      format: 'SVG',
      width: 280,
      height: 280,
      sizeBytes: 3890,
      brand: 'Kopi Senja',
      product: 'All Products',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.0',
      src: './assets/images/sample-assets/badge-arabica-100.svg',
      description: 'Official circular roast quality seal badge for promotional compositions.',
      tags: ['badge', 'icon', 'arabica', 'seal'],
      createdAt: '2026-10-17T11:30:00.000Z'
    },
    {
      id: 'ast_bg_warm',
      name: 'Warm Oat Editorial Backdrop',
      originalFileName: 'bg-senja-warm.svg',
      category: 'Backgrounds',
      format: 'SVG',
      width: 1080,
      height: 1080,
      sizeBytes: 2940,
      brand: 'Kopi Senja',
      product: 'Campaign Surface',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.0',
      src: './assets/images/sample-assets/bg-senja-warm.svg',
      description: 'Warm oat cream background with subtle geometric sun curves.',
      tags: ['background', 'warm', 'cream', 'editorial'],
      createdAt: '2026-10-17T14:00:00.000Z'
    },
    {
      id: 'ast_bg_dark',
      name: 'Dark Espresso Contour Backdrop',
      originalFileName: 'bg-roastery-dark.svg',
      category: 'Backgrounds',
      format: 'SVG',
      width: 1080,
      height: 1350,
      sizeBytes: 3150,
      brand: 'Kopi Senja',
      product: 'Campaign Surface',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.0',
      src: './assets/images/sample-assets/bg-roastery-dark.svg',
      description: 'Deep espresso roast background for signature reserve campaigns.',
      tags: ['background', 'dark', 'espresso', 'roastery'],
      createdAt: '2026-10-18T09:40:00.000Z'
    },
    {
      id: 'ast_type_specimen',
      name: 'Inter Display & Editorial Specimen',
      originalFileName: 'type-specimen-senja.svg',
      category: 'Typography',
      format: 'SVG',
      width: 640,
      height: 420,
      sizeBytes: 5120,
      brand: 'Kopi Senja',
      product: 'Brand Identity',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.2',
      src: './assets/images/sample-assets/type-specimen-senja.svg',
      description: 'Approved typography hierarchy specimen card for Kopi Senja campaigns.',
      tags: ['typography', 'font', 'inter', 'specimen'],
      createdAt: '2026-10-18T13:10:00.000Z'
    },
    {
      id: 'ast_palette_swatches',
      name: 'Kopi Senja Brand Color Swatches',
      originalFileName: 'palette-senja-swatches.svg',
      category: 'Brand Colors',
      format: 'SVG',
      width: 640,
      height: 420,
      sizeBytes: 5480,
      brand: 'Kopi Senja',
      product: 'Brand Identity',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.0',
      src: './assets/images/sample-assets/palette-senja-swatches.svg',
      description: 'Official brand palette reference with verified WCAG 2.1 AA/AAA contrast ratios.',
      tags: ['colors', 'palette', 'swatches', 'brand kit'],
      createdAt: '2026-10-18T15:00:00.000Z'
    },
    {
      id: 'ast_can_3d',
      name: 'Oat Latte RTD 250ml Cylinder Mesh',
      originalFileName: 'pack-can-3d-render.png',
      category: '3D Models',
      format: 'PNG',
      width: 800,
      height: 1000,
      sizeBytes: 198400,
      brand: 'Kopi Senja',
      product: 'Oat Latte RTD',
      status: 'pending',
      protected: true,
      locked: true,
      isBuiltin: true,
      version: 'v0.9 (Pending QA)',
      src: './assets/images/sample-assets/pack-can-3d-render.png',
      description: '3D cylindrical packaging render for upcoming Oat Latte RTD 250ml can.',
      tags: ['3d', 'can', 'packaging', 'rtd'],
      createdAt: '2026-10-20T16:20:00.000Z'
    },
    {
      id: 'ast_template_ref',
      name: 'Hero Promo Grid Layout Reference',
      originalFileName: 'template-promo-thumb.svg',
      category: 'Templates',
      format: 'SVG',
      width: 600,
      height: 600,
      sizeBytes: 4600,
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'approved',
      protected: false,
      locked: false,
      isBuiltin: true,
      version: 'v1.0',
      src: './assets/images/sample-assets/template-promo-thumb.svg',
      description: 'Master layout grid blueprint for 1:1 square product promotions.',
      tags: ['template', 'blueprint', 'layout'],
      createdAt: '2026-10-21T10:00:00.000Z'
    }
  ];
}

export function getDefaultKopiSenjaComposition() {
  return {
    width: 1080,
    height: 1080,
    backgroundColor: '#F6EFE6',
    elements: [
      {
        id: 'el_bg_circle',
        name: 'Warm Sun Halo Shape',
        type: 'shape',
        shapeType: 'circle',
        role: 'decor',
        x: 520,
        y: 170,
        width: 490,
        height: 490,
        backgroundColor: '#EADBC8',
        borderColor: '#D5BFA4',
        borderWidth: 2,
        borderRadius: 999,
        opacity: 1,
        zIndex: 1,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_bottom_card',
        name: 'Editorial Footer Accent Bar',
        type: 'shape',
        shapeType: 'rect',
        role: 'decor',
        x: 64,
        y: 944,
        width: 952,
        height: 72,
        backgroundColor: '#EFE3D3',
        borderColor: '#D5BFA4',
        borderWidth: 1,
        borderRadius: 12,
        opacity: 1,
        zIndex: 2,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_brand_logo',
        name: 'Kopi Senja Primary Logo',
        type: 'logo',
        role: 'logo',
        assetId: 'ast_logo_dark',
        src: './assets/images/sample-assets/logo-kopi-senja.svg',
        x: 72,
        y: 68,
        width: 280,
        height: 80,
        naturalWidth: 420,
        naturalHeight: 120,
        aspectRatioLocked: true,
        objectFit: 'contain',
        opacity: 1,
        zIndex: 3,
        locked: false,
        protected: true,
        visible: true
      },
      {
        id: 'el_eyebrow',
        name: 'Product Series Tag',
        type: 'text',
        role: 'badge',
        text: 'SIGNATURE SERIES · KOPI SUSU ORIGINAL',
        x: 72,
        y: 192,
        width: 440,
        height: 40,
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 700,
        color: '#9A5B25',
        backgroundColor: '#EFE3D3',
        borderColor: '#D5BFA4',
        borderWidth: 1,
        borderRadius: 8,
        textAlign: 'center',
        lineHeight: 1.2,
        opacity: 1,
        zIndex: 4,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_headline',
        name: 'Campaign Headline',
        type: 'text',
        role: 'headline',
        text: 'Temukan Jeda\nTerbaikmu',
        x: 72,
        y: 256,
        width: 480,
        height: 176,
        fontFamily: 'Inter',
        fontSize: 64,
        fontWeight: 800,
        color: '#1E1815',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        textAlign: 'left',
        lineHeight: 1.12,
        opacity: 1,
        zIndex: 5,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_subheadline',
        name: 'Product Description',
        type: 'text',
        role: 'subheadline',
        text: 'Kopi Susu Original dengan espresso Arabica Nusantara segar, susu creamy, dan gula aren organik asli.',
        x: 72,
        y: 448,
        width: 448,
        height: 104,
        fontFamily: 'Inter',
        fontSize: 22,
        fontWeight: 500,
        color: '#3D322C',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        textAlign: 'left',
        lineHeight: 1.45,
        opacity: 1,
        zIndex: 6,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_price_tag',
        name: 'Price Callout (Rp18.000)',
        type: 'text',
        role: 'price',
        text: 'Rp18.000',
        x: 72,
        y: 584,
        width: 240,
        height: 84,
        fontFamily: 'Inter',
        fontSize: 40,
        fontWeight: 800,
        color: '#1E1815',
        backgroundColor: '#FFFFFF',
        borderColor: '#D5BFA4',
        borderWidth: 2,
        borderRadius: 14,
        textAlign: 'center',
        lineHeight: 1.1,
        opacity: 1,
        zIndex: 7,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_cta_button',
        name: 'CTA Button (Pesan Sekarang)',
        type: 'text',
        role: 'cta',
        text: 'Pesan Sekarang',
        x: 72,
        y: 704,
        width: 312,
        height: 76,
        fontFamily: 'Inter',
        fontSize: 26,
        fontWeight: 700,
        color: '#FFFFFF',
        backgroundColor: '#1E1815',
        borderColor: '#1E1815',
        borderWidth: 0,
        borderRadius: 14,
        textAlign: 'center',
        lineHeight: 1.1,
        opacity: 1,
        zIndex: 8,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_product_hero',
        name: 'Kopi Susu Original (Product Asset)',
        type: 'product',
        role: 'product',
        assetId: 'ast_kopi_susu_png',
        src: './assets/images/sample-assets/kopi-susu-original.png',
        x: 560,
        y: 152,
        width: 448,
        height: 560,
        naturalWidth: 800,
        naturalHeight: 1000,
        aspectRatioLocked: true,
        objectFit: 'contain',
        opacity: 1,
        zIndex: 9,
        locked: false,
        protected: true,
        visible: true
      },
      {
        id: 'el_arabica_seal',
        name: '100% Arabica Seal Badge',
        type: 'image',
        role: 'badge',
        assetId: 'ast_badge_arabica',
        src: './assets/images/sample-assets/badge-arabica-100.svg',
        x: 848,
        y: 688,
        width: 152,
        height: 152,
        naturalWidth: 280,
        naturalHeight: 280,
        aspectRatioLocked: true,
        objectFit: 'contain',
        opacity: 1,
        zIndex: 10,
        locked: false,
        protected: false,
        visible: true
      },
      {
        id: 'el_footer_note',
        name: 'Store Availability Note',
        type: 'text',
        role: 'caption',
        text: 'Tersedia di seluruh gerai Kopi Senja & layanan pesan antar setiap hari 07.00 – 22.00 WIB',
        x: 88,
        y: 962,
        width: 904,
        height: 36,
        fontFamily: 'Inter',
        fontSize: 17,
        fontWeight: 600,
        color: '#3D322C',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderRadius: 0,
        textAlign: 'center',
        lineHeight: 1.3,
        opacity: 1,
        zIndex: 11,
        locked: false,
        protected: false,
        visible: true
      }
    ]
  };
}

export function getInitialTemplates() {
  const mainComp = getDefaultKopiSenjaComposition();
  return [
    {
      id: 'tpl_kopi_hero_square',
      name: 'Kopi Senja Hero Promo',
      category: 'Product Promotion',
      aspectRatio: '1:1',
      width: 1080,
      height: 1080,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'Balanced split-grid square poster featuring protected hero product cutout, bold headline, price callout, and high-contrast CTA.',
      composition: JSON.parse(JSON.stringify(mainComp))
    },
    {
      id: 'tpl_fnb_portrait_editorial',
      name: 'Artisanal Beverage Portrait',
      category: 'Food and Beverage',
      aspectRatio: '4:5',
      width: 1080,
      height: 1350,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'Instagram 4:5 portrait layout with centered pedestal product focus and warm editorial typography.',
      composition: {
        width: 1080,
        height: 1350,
        backgroundColor: '#F6EFE6',
        elements: [
          {
            id: 'tpl2_logo',
            name: 'Kopi Senja Primary Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_dark',
            src: './assets/images/sample-assets/logo-kopi-senja.svg',
            x: 390,
            y: 64,
            width: 300,
            height: 86,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 1,
            protected: true,
            visible: true
          },
          {
            id: 'tpl2_head',
            name: 'Campaign Headline',
            type: 'text',
            role: 'headline',
            text: 'Temukan Jeda Terbaikmu',
            x: 100,
            y: 184,
            width: 880,
            height: 96,
            fontFamily: 'Inter',
            fontSize: 58,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: 'transparent',
            textAlign: 'center',
            lineHeight: 1.15,
            opacity: 1,
            zIndex: 2,
            visible: true
          },
          {
            id: 'tpl2_sub',
            name: 'Subheadline Copy',
            type: 'text',
            role: 'subheadline',
            text: 'Kopi Susu Original · Racikan Espresso Arabica & Gula Aren Asli',
            x: 160,
            y: 288,
            width: 760,
            height: 54,
            fontFamily: 'Inter',
            fontSize: 22,
            fontWeight: 500,
            color: '#3D322C',
            backgroundColor: 'transparent',
            textAlign: 'center',
            lineHeight: 1.35,
            opacity: 1,
            zIndex: 3,
            visible: true
          },
          {
            id: 'tpl2_circle',
            name: 'Warm Backdrop Circle',
            type: 'shape',
            shapeType: 'circle',
            role: 'decor',
            x: 270,
            y: 380,
            width: 540,
            height: 540,
            backgroundColor: '#EADBC8',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 999,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl2_prod',
            name: 'Kopi Susu Original (Product Asset)',
            type: 'product',
            role: 'product',
            assetId: 'ast_kopi_susu_png',
            src: './assets/images/sample-assets/kopi-susu-original.png',
            x: 312,
            y: 368,
            width: 456,
            height: 570,
            naturalWidth: 800,
            naturalHeight: 1000,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 5,
            protected: true,
            visible: true
          },
          {
            id: 'tpl2_price',
            name: 'Price Tag',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 220,
            y: 1020,
            width: 260,
            height: 84,
            fontFamily: 'Inter',
            fontSize: 38,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: '#FFFFFF',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 6,
            visible: true
          },
          {
            id: 'tpl2_cta',
            name: 'CTA Button',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 510,
            y: 1020,
            width: 350,
            height: 84,
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#1E1815',
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 7,
            visible: true
          }
        ]
      }
    },
    {
      id: 'tpl_social_story_launch',
      name: 'Vertical Story Product Drop',
      category: 'Social Media',
      aspectRatio: '9:16',
      width: 1080,
      height: 1920,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: '9:16 vertical Story & Reels cover with safe-zone spacing for cold brew and iced coffee launches.',
      composition: {
        width: 1080,
        height: 1920,
        backgroundColor: '#181310',
        elements: [
          {
            id: 'tpl3_logo',
            name: 'Kopi Senja Light Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_light',
            src: './assets/images/sample-assets/logo-kopi-senja-light.svg',
            x: 365,
            y: 180,
            width: 350,
            height: 100,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 1,
            protected: true,
            visible: true
          },
          {
            id: 'tpl3_head',
            name: 'Story Headline',
            type: 'text',
            role: 'headline',
            text: 'Temukan Jeda\nTerbaikmu',
            x: 110,
            y: 330,
            width: 860,
            height: 180,
            fontFamily: 'Inter',
            fontSize: 68,
            fontWeight: 800,
            color: '#FFFBEB',
            backgroundColor: 'transparent',
            textAlign: 'center',
            lineHeight: 1.12,
            opacity: 1,
            zIndex: 2,
            visible: true
          },
          {
            id: 'tpl3_prod',
            name: 'Cold Brew Signature 250ml',
            type: 'product',
            role: 'product',
            assetId: 'ast_cold_brew_png',
            src: './assets/images/sample-assets/cold-brew-senja.png',
            x: 260,
            y: 560,
            width: 560,
            height: 700,
            naturalWidth: 800,
            naturalHeight: 1000,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 3,
            protected: true,
            visible: true
          },
          {
            id: 'tpl3_price',
            name: 'Story Price Badge',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 380,
            y: 1320,
            width: 320,
            height: 86,
            fontFamily: 'Inter',
            fontSize: 42,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: '#F6EFE6',
            borderRadius: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl3_cta',
            name: 'Story CTA Button',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 240,
            y: 1460,
            width: 600,
            height: 96,
            fontFamily: 'Inter',
            fontSize: 32,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#9A5B25',
            borderRadius: 18,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 5,
            visible: true
          }
        ]
      }
    },
    {
      id: 'tpl_marketplace_frame',
      name: 'Marketplace Hero Showcase Card',
      category: 'Marketplace',
      aspectRatio: '1:1',
      width: 1080,
      height: 1080,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'High-clarity e-commerce product card optimized for marketplace thumbnails with prominent price & authenticity badge.',
      composition: {
        width: 1080,
        height: 1080,
        backgroundColor: '#FFFFFF',
        elements: [
          {
            id: 'tpl4_card',
            name: 'Inner Warm Frame',
            type: 'shape',
            shapeType: 'rect',
            role: 'decor',
            x: 48,
            y: 48,
            width: 984,
            height: 984,
            backgroundColor: '#F6EFE6',
            borderColor: '#D5BFA4',
            borderWidth: 3,
            borderRadius: 24,
            opacity: 1,
            zIndex: 1,
            visible: true
          },
          {
            id: 'tpl4_logo',
            name: 'Kopi Senja Primary Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_dark',
            src: './assets/images/sample-assets/logo-kopi-senja.svg',
            x: 96,
            y: 92,
            width: 252,
            height: 72,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 2,
            protected: true,
            visible: true
          },
          {
            id: 'tpl4_prod',
            name: 'Kopi Susu Original (Product Asset)',
            type: 'product',
            role: 'product',
            assetId: 'ast_kopi_susu_png',
            src: './assets/images/sample-assets/kopi-susu-original.png',
            x: 520,
            y: 160,
            width: 448,
            height: 560,
            naturalWidth: 800,
            naturalHeight: 1000,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 3,
            protected: true,
            visible: true
          },
          {
            id: 'tpl4_head',
            name: 'Product Title',
            type: 'text',
            role: 'headline',
            text: 'Kopi Susu\nOriginal',
            x: 96,
            y: 240,
            width: 420,
            height: 160,
            fontFamily: 'Inter',
            fontSize: 60,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.12,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl4_sub',
            name: 'Tagline',
            type: 'text',
            role: 'subheadline',
            text: 'Temukan Jeda Terbaikmu',
            x: 96,
            y: 420,
            width: 400,
            height: 56,
            fontFamily: 'Inter',
            fontSize: 26,
            fontWeight: 600,
            color: '#9A5B25',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.3,
            opacity: 1,
            zIndex: 5,
            visible: true
          },
          {
            id: 'tpl4_price',
            name: 'Price Tag',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 96,
            y: 520,
            width: 260,
            height: 92,
            fontFamily: 'Inter',
            fontSize: 42,
            fontWeight: 800,
            color: '#FFFFFF',
            backgroundColor: '#9A5B25',
            borderRadius: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 6,
            visible: true
          },
          {
            id: 'tpl4_cta',
            name: 'CTA Banner',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 96,
            y: 860,
            width: 888,
            height: 88,
            fontFamily: 'Inter',
            fontSize: 30,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#1E1815',
            borderRadius: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 7,
            visible: true
          }
        ]
      }
    },
    {
      id: 'tpl_sale_campaign_banner',
      name: 'Payday Flash Campaign Banner',
      category: 'Sale Campaign',
      aspectRatio: '16:9',
      width: 1920,
      height: 1080,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: '16:9 widescreen web & display banner for seasonal promos and payday bundles.',
      composition: {
        width: 1920,
        height: 1080,
        backgroundColor: '#F6EFE6',
        elements: [
          {
            id: 'tpl5_panel',
            name: 'Right Visual Accent Panel',
            type: 'shape',
            shapeType: 'rect',
            role: 'decor',
            x: 1120,
            y: 0,
            width: 800,
            height: 1080,
            backgroundColor: '#EADBC8',
            borderWidth: 0,
            borderRadius: 0,
            opacity: 1,
            zIndex: 1,
            visible: true
          },
          {
            id: 'tpl5_logo',
            name: 'Kopi Senja Primary Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_dark',
            src: './assets/images/sample-assets/logo-kopi-senja.svg',
            x: 120,
            y: 96,
            width: 315,
            height: 90,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 2,
            protected: true,
            visible: true
          },
          {
            id: 'tpl5_head',
            name: 'Widescreen Headline',
            type: 'text',
            role: 'headline',
            text: 'Temukan Jeda Terbaikmu',
            x: 120,
            y: 260,
            width: 900,
            height: 160,
            fontFamily: 'Inter',
            fontSize: 74,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 3,
            visible: true
          },
          {
            id: 'tpl5_sub',
            name: 'Campaign Subcopy',
            type: 'text',
            role: 'subheadline',
            text: 'Kopi Susu Original · Diracik segar dari biji Arabica pilihan dan gula aren murni.',
            x: 120,
            y: 450,
            width: 820,
            height: 90,
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: 500,
            color: '#3D322C',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.4,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl5_price',
            name: 'Price Badge',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 120,
            y: 620,
            width: 280,
            height: 96,
            fontFamily: 'Inter',
            fontSize: 44,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: '#FFFFFF',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 5,
            visible: true
          },
          {
            id: 'tpl5_cta',
            name: 'Banner CTA',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 430,
            y: 620,
            width: 360,
            height: 96,
            fontFamily: 'Inter',
            fontSize: 32,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#1E1815',
            borderRadius: 16,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 6,
            visible: true
          },
          {
            id: 'tpl5_prod',
            name: 'Kopi Susu Original (Product Asset)',
            type: 'product',
            role: 'product',
            assetId: 'ast_kopi_susu_png',
            src: './assets/images/sample-assets/kopi-susu-original.png',
            x: 1260,
            y: 120,
            width: 520,
            height: 650,
            naturalWidth: 800,
            naturalHeight: 1000,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 7,
            protected: true,
            visible: true
          }
        ]
      }
    },
    {
      id: 'tpl_editorial_split',
      name: 'Roastery Journal Split Feature',
      category: 'Editorial',
      aspectRatio: '4:5',
      width: 1080,
      height: 1350,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'Editorial magazine composition combining studio pedestal photography with clean typographic grid.',
      composition: {
        width: 1080,
        height: 1350,
        backgroundColor: '#F6EFE6',
        elements: [
          {
            id: 'tpl6_logo',
            name: 'Kopi Senja Primary Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_dark',
            src: './assets/images/sample-assets/logo-kopi-senja.svg',
            x: 80,
            y: 72,
            width: 280,
            height: 80,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 1,
            protected: true,
            visible: true
          },
          {
            id: 'tpl6_prod',
            name: 'Kopi Susu Studio Pedestal',
            type: 'product',
            role: 'product',
            assetId: 'ast_kopi_susu_studio',
            src: './assets/images/sample-assets/kopi-susu-studio.png',
            x: 80,
            y: 190,
            width: 920,
            height: 660,
            naturalWidth: 900,
            naturalHeight: 900,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 2,
            protected: true,
            visible: true
          },
          {
            id: 'tpl6_head',
            name: 'Editorial Headline',
            type: 'text',
            role: 'headline',
            text: 'Temukan Jeda Terbaikmu',
            x: 80,
            y: 890,
            width: 920,
            height: 88,
            fontFamily: 'Inter',
            fontSize: 56,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.15,
            opacity: 1,
            zIndex: 3,
            visible: true
          },
          {
            id: 'tpl6_price',
            name: 'Price Tag',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 80,
            y: 1020,
            width: 250,
            height: 88,
            fontFamily: 'Inter',
            fontSize: 40,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: '#FFFFFF',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl6_cta',
            name: 'CTA Button',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 360,
            y: 1020,
            width: 360,
            height: 88,
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#9A5B25',
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 5,
            visible: true
          }
        ]
      }
    },
    {
      id: 'tpl_minimalist_studio',
      name: 'Pure Studio Pedestal Focus',
      category: 'Minimalist',
      aspectRatio: '1:1',
      width: 1080,
      height: 1080,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'Swiss-grid inspired minimalist layout with generous whitespace and crisp typographic hierarchy.',
      composition: JSON.parse(JSON.stringify(mainComp))
    },
    {
      id: 'tpl_lifestyle_RTD',
      name: 'Modern Lifestyle Daily Ritual',
      category: 'Beauty and Lifestyle',
      aspectRatio: '4:5',
      width: 1080,
      height: 1350,
      brand: 'Kopi Senja',
      approved: true,
      isBuiltin: true,
      description: 'Clean lifestyle campaign layout highlighting daily ritual aesthetics and balanced warm tones.',
      composition: {
        width: 1080,
        height: 1350,
        backgroundColor: '#EFE3D3',
        elements: [
          {
            id: 'tpl8_logo',
            name: 'Kopi Senja Primary Logo',
            type: 'logo',
            role: 'logo',
            assetId: 'ast_logo_dark',
            src: './assets/images/sample-assets/logo-kopi-senja.svg',
            x: 80,
            y: 80,
            width: 280,
            height: 80,
            naturalWidth: 420,
            naturalHeight: 120,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 1,
            protected: true,
            visible: true
          },
          {
            id: 'tpl8_head',
            name: 'Lifestyle Headline',
            type: 'text',
            role: 'headline',
            text: 'Temukan Jeda\nTerbaikmu',
            x: 80,
            y: 210,
            width: 520,
            height: 180,
            fontFamily: 'Inter',
            fontSize: 64,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: 'transparent',
            textAlign: 'left',
            lineHeight: 1.12,
            opacity: 1,
            zIndex: 2,
            visible: true
          },
          {
            id: 'tpl8_prod',
            name: 'Cold Brew Signature 250ml',
            type: 'product',
            role: 'product',
            assetId: 'ast_cold_brew_png',
            src: './assets/images/sample-assets/cold-brew-senja.png',
            x: 490,
            y: 360,
            width: 500,
            height: 625,
            naturalWidth: 800,
            naturalHeight: 1000,
            aspectRatioLocked: true,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 3,
            protected: true,
            visible: true
          },
          {
            id: 'tpl8_price',
            name: 'Price Tag',
            type: 'text',
            role: 'price',
            text: 'Rp18.000',
            x: 80,
            y: 660,
            width: 250,
            height: 84,
            fontFamily: 'Inter',
            fontSize: 40,
            fontWeight: 800,
            color: '#1E1815',
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 4,
            visible: true
          },
          {
            id: 'tpl8_cta',
            name: 'CTA Button',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: 80,
            y: 780,
            width: 320,
            height: 84,
            fontFamily: 'Inter',
            fontSize: 28,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: '#1E1815',
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: 5,
            visible: true
          }
        ]
      }
    }
  ];
}

export function getInitialProjects() {
  const mainComp = getDefaultKopiSenjaComposition();
  return [
    {
      id: 'proj_kopi_senja_main',
      name: 'Kopi Senja — Kopi Susu Original Campaign',
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'Validated',
      manualReviewed: true,
      updatedAt: '2026-10-22T09:45:00.000Z',
      createdAt: '2026-10-19T08:30:00.000Z',
      isSample: true,
      composition: JSON.parse(JSON.stringify(mainComp)),
      snapshots: [
        {
          id: 'snap_init_1',
          label: 'v1.0 — Initial Approved Layout (Sample)',
          createdAt: '2026-10-20T10:00:00.000Z',
          isSample: true,
          composition: JSON.parse(JSON.stringify(mainComp))
        }
      ]
    },
    {
      id: 'proj_cold_brew_story',
      name: 'Cold Brew Signature — Story Launch',
      brand: 'Kopi Senja',
      product: 'Cold Brew Signature',
      status: 'Ready to Export',
      manualReviewed: false,
      updatedAt: '2026-10-21T16:15:00.000Z',
      createdAt: '2026-10-20T11:00:00.000Z',
      isSample: true,
      composition: JSON.parse(JSON.stringify(getInitialTemplates()[2].composition)),
      snapshots: [
        {
          id: 'snap_init_2',
          label: 'v1.0 — 9:16 Story Adaptation (Sample)',
          createdAt: '2026-10-21T16:15:00.000Z',
          isSample: true,
          composition: JSON.parse(JSON.stringify(getInitialTemplates()[2].composition))
        }
      ]
    },
    {
      id: 'proj_marketplace_card',
      name: 'Kopi Susu Original — Marketplace Card',
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'In Progress',
      manualReviewed: false,
      updatedAt: '2026-10-21T11:20:00.000Z',
      createdAt: '2026-10-18T14:00:00.000Z',
      isSample: true,
      composition: JSON.parse(JSON.stringify(getInitialTemplates()[3].composition)),
      snapshots: [
        {
          id: 'snap_init_3',
          label: 'v1.0 — Marketplace Square Draft (Sample)',
          createdAt: '2026-10-21T11:20:00.000Z',
          isSample: true,
          composition: JSON.parse(JSON.stringify(getInitialTemplates()[3].composition))
        }
      ]
    },
    {
      id: 'proj_editorial_portrait',
      name: 'Kopi Senja — Editorial Portrait 4:5',
      brand: 'Kopi Senja',
      product: 'Kopi Susu Original',
      status: 'Validated',
      manualReviewed: true,
      updatedAt: '2026-10-20T17:40:00.000Z',
      createdAt: '2026-10-18T09:15:00.000Z',
      isSample: true,
      composition: JSON.parse(JSON.stringify(getInitialTemplates()[1].composition)),
      snapshots: [
        {
          id: 'snap_init_4',
          label: 'v1.0 — 4:5 Editorial Feed Approved (Sample)',
          createdAt: '2026-10-20T17:40:00.000Z',
          isSample: true,
          composition: JSON.parse(JSON.stringify(getInitialTemplates()[1].composition))
        }
      ]
    }
  ];
}

export function getDefaultBrandKit() {
  return {
    id: 'brand_kopi_senja',
    name: 'Kopi Senja',
    tagline: 'Temukan Jeda Terbaikmu',
    description: 'Indonesian specialty coffee roastery & daily coffee bar serving 100% Nusantara Arabica and pure organic palm sugar blends.',
    primaryColor: '#1E1815',
    secondaryColor: '#9A5B25',
    accentColor: '#D97706',
    backgroundColor: '#F6EFE6',
    surfaceColor: '#FFFFFF',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingWeight: '800',
    bodyWeight: '500',
    headingTracking: '-0.02em',
    guidelines: 'AI does not recreate or synthesize the product. All promotional layouts must use approved source product photos with locked aspect ratio, maintain at least 4.5:1 text contrast, and keep 24px clear space around the Kopi Senja logo.',
    approvedColors: ['#1E1815', '#9A5B25', '#D97706', '#F6EFE6', '#EFE3D3', '#EADBC8', '#FFFFFF', '#181310'],
    logos: [
      { id: 'ast_logo_dark', name: 'Primary Logo (Light Surface)', src: './assets/images/sample-assets/logo-kopi-senja.svg', minClearSpace: 24 },
      { id: 'ast_logo_light', name: 'Reverse Logo (Dark Surface)', src: './assets/images/sample-assets/logo-kopi-senja-light.svg', minClearSpace: 24 }
    ],
    rules: {
      lockProductAspectRatio: true,
      requireApprovedAssets: true,
      disallowDestructiveEdits: true,
      minProductAreaPct: 12,
      requireBrandLogo: true,
      minLogoClearSpacePx: 24,
      lockLogoOpacity: true,
      minContrastRatio: 4.5,
      restrictBackgroundPalette: true
    },
    approvedTemplateIds: [
      'tpl_kopi_hero_square',
      'tpl_fnb_portrait_editorial',
      'tpl_social_story_launch',
      'tpl_marketplace_frame',
      'tpl_sale_campaign_banner',
      'tpl_editorial_split',
      'tpl_minimalist_studio',
      'tpl_lifestyle_RTD'
    ],
    updatedAt: '2026-10-22T08:00:00.000Z'
  };
}

function buildInitialState() {
  return {
    version: '1.0.0',
    workspace: {
      id: 'ws_kopi_senja',
      name: 'Kopi Senja Official',
      role: 'Brand Design Lead',
      membersCount: 6,
      availableWorkspaces: [
        { id: 'ws_kopi_senja', name: 'Kopi Senja Official', plan: 'Enterprise Brand Suite' },
        { id: 'ws_roastery_b2b', name: 'Nusantara Roastery B2B', plan: 'Partner Studio' }
      ]
    },
    activeProjectId: 'proj_kopi_senja_main',
    assets: getInitialSampleAssets(),
    brandKit: getDefaultBrandKit(),
    projects: getInitialProjects(),
    templates: getInitialTemplates(),
    validationHistory: [
      {
        id: 'val_sample_1',
        projectId: 'proj_kopi_senja_main',
        projectName: 'Kopi Senja — Kopi Susu Original Campaign',
        timestamp: '2026-10-22T09:45:00.000Z',
        score: 100,
        passCount: 11,
        warningCount: 0,
        errorCount: 0,
        status: 'Passed',
        manualReviewed: true,
        isSample: true,
        summary: 'All 11 automated brand, contrast, and product integrity checks passed.'
      },
      {
        id: 'val_sample_2',
        projectId: 'proj_cold_brew_story',
        projectName: 'Cold Brew Signature — Story Launch',
        timestamp: '2026-10-21T16:15:00.000Z',
        score: 94,
        passCount: 10,
        warningCount: 1,
        errorCount: 0,
        status: 'Passed with Warnings',
        manualReviewed: false,
        isSample: true,
        summary: 'Automated check complete: product aspect ratio locked; 1 minor safe-zone note.'
      }
    ],
    exportHistory: [
      {
        id: 'exp_sample_1',
        projectId: 'proj_kopi_senja_main',
        projectName: 'Kopi Senja — Kopi Susu Original Campaign',
        presetName: 'Instagram Square (1080×1080)',
        format: 'PNG',
        width: 1080,
        height: 1080,
        timestamp: '2026-10-22T09:50:00.000Z',
        isSample: true
      }
    ],
    activities: [
      {
        id: 'act_sample_1',
        type: 'validation',
        title: 'Validated "Kopi Senja — Kopi Susu Original Campaign" (11/11 checks passed)',
        timestamp: '2026-10-22T09:45:00.000Z',
        isSample: true
      },
      {
        id: 'act_sample_2',
        type: 'asset',
        title: 'Verified immutable lock on "Kopi Susu Original (Cutout)" source PNG',
        timestamp: '2026-10-21T15:10:00.000Z',
        isSample: true
      },
      {
        id: 'act_sample_3',
        type: 'brand',
        title: 'Updated Kopi Senja Brand Kit WCAG contrast threshold to 4.5:1 AA',
        timestamp: '2026-10-20T13:25:00.000Z',
        isSample: true
      }
    ],
    notifications: [
      {
        id: 'notif_1',
        title: 'Sample Asset Pending Approval',
        message: '"Oat Latte RTD 250ml Cylinder Mesh" is currently marked as Pending in Asset Library.',
        read: false,
        timestamp: '2026-10-22T08:30:00.000Z',
        route: 'asset-library'
      },
      {
        id: 'notif_2',
        title: 'Local Persistence Active',
        message: 'Projects and uploaded assets are saved automatically in your browser storage.',
        read: false,
        timestamp: '2026-10-22T08:00:00.000Z',
        route: 'settings'
      }
    ],
    settings: {
      theme: 'light',
      sidebarCollapsed: false,
      defaultExportPreset: 'ig-square',
      defaultExportFormat: 'png',
      defaultBrand: 'Kopi Senja',
      canvasGridSize: 16,
      showCanvasGrid: true,
      snapToGrid: true,
      showSafeAreaGuides: false,
      autoSave: true
    },
    saveStatus: {
      state: 'saved',
      lastSavedAt: new Date().toISOString(),
      storageAvailable: true
    }
  };
}

/* ==========================================================================
   Store Singleton Implementation
   ========================================================================== */

class AutoDesignStore {
  constructor() {
    this.state = buildInitialState();
    this.listeners = new Set();
    this.storageWarningShown = false;
  }

  async init() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.projects)) {
          this.state = {
            ...buildInitialState(),
            ...parsed,
            settings: { ...buildInitialState().settings, ...(parsed.settings || {}) },
            brandKit: { ...getDefaultBrandKit(), ...(parsed.brandKit || {}), rules: { ...getDefaultBrandKit().rules, ...(parsed.brandKit?.rules || {}) } }
          };
        }
      } else {
        this.persist();
      }

      // Rehydrate any user-uploaded asset blobs from IndexedDB into Object URLs
      for (const asset of this.state.assets) {
        if (!asset.isBuiltin && asset.hasIdbBlob) {
          const blob = await loadBlobFromIdb(asset.id);
          if (blob) {
            const objUrl = registerObjectUrl(asset.id, blob);
            this.updateAssetSrcEverywhere(asset.id, objUrl, false);
          }
        }
      }
    } catch (err) {
      console.warn('AutoDesign local storage fallback mode:', err);
      this.state.saveStatus.storageAvailable = false;
    }

    this.applyThemeAndGridVariables();
    return this.state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(reason = 'update') {
    for (const fn of this.listeners) {
      try {
        fn(this.state, reason);
      } catch (e) {
        console.error('Store listener error:', e);
      }
    }
  }

  persist(reason = 'update') {
    this.state.saveStatus.lastSavedAt = new Date().toISOString();
    this.state.saveStatus.state = 'saved';
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.state.saveStatus.storageAvailable = true;
    } catch (err) {
      console.warn('Failed to persist state to localStorage:', err);
      this.state.saveStatus.state = 'error';
      this.state.saveStatus.storageAvailable = false;
    }
    this.applyThemeAndGridVariables();
    this.notify(reason);
  }

  applyThemeAndGridVariables() {
    const theme = this.state.settings?.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const gridSize = Number(this.state.settings?.canvasGridSize) || 16;
    document.documentElement.style.setProperty('--canvas-grid-size', `${gridSize}px`);
  }

  getState() {
    return this.state;
  }

  getActiveProject() {
    let proj = this.state.projects.find((p) => p.id === this.state.activeProjectId);
    if (!proj && this.state.projects.length > 0) {
      proj = this.state.projects[0];
      this.state.activeProjectId = proj.id;
    }
    return proj || null;
  }

  setActiveProject(projectId) {
    const exists = this.state.projects.find((p) => p.id === projectId);
    if (exists) {
      this.state.activeProjectId = projectId;
      this.persist('active-project');
    }
  }

  logActivity(type, title) {
    this.state.activities.unshift({
      id: uid('act'),
      type,
      title,
      timestamp: new Date().toISOString(),
      isSample: false
    });
    if (this.state.activities.length > 40) {
      this.state.activities.length = 40;
    }
  }

  updateAssetSrcEverywhere(assetId, newSrc, shouldPersist = true) {
    const asset = this.state.assets.find((a) => a.id === assetId);
    if (asset) asset.src = newSrc;
    for (const proj of this.state.projects) {
      for (const el of proj.composition?.elements || []) {
        if (el.assetId === assetId) el.src = newSrc;
      }
    }
    if (shouldPersist) this.persist('asset-src');
  }

  async addUploadedAsset({ file, name, category, brand, product, width, height }) {
    const id = uid('ast_usr');
    const objUrl = registerObjectUrl(id, file);
    const savedIdb = await saveBlobToIdb(id, file);

    // If file is small (< 280 KB) and IDB failed, also store data URL fallback
    let finalSrc = objUrl;
    if (!savedIdb && file.size < 280000) {
      finalSrc = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(objUrl);
        reader.readAsDataURL(file);
      });
    }

    const ext = (file.name.split('.').pop() || 'PNG').toUpperCase();
    const newAsset = {
      id,
      name: name || file.name.replace(/\.[^/.]+$/, ''),
      originalFileName: file.name,
      category: category || 'Product Photos',
      format: ext,
      width: width || 800,
      height: height || 800,
      sizeBytes: file.size || 0,
      brand: brand || this.state.brandKit.name || 'Kopi Senja',
      product: product || 'Kopi Susu Original',
      status: 'approved',
      protected: true,
      locked: true,
      isBuiltin: false,
      hasIdbBlob: savedIdb,
      version: 'v1.0 (Immutable Upload)',
      src: finalSrc,
      description: `User-uploaded immutable source asset (${file.name}).`,
      tags: ['uploaded', (category || 'asset').toLowerCase()],
      createdAt: new Date().toISOString()
    };

    this.state.assets.unshift(newAsset);
    this.logActivity('asset', `Uploaded source asset "${newAsset.name}" (${newAsset.width}×${newAsset.height})`);
    this.persist('asset-added');
    return newAsset;
  }

  updateAsset(assetId, patch) {
    const idx = this.state.assets.findIndex((a) => a.id === assetId);
    if (idx === -1) return null;
    // Never overwrite originalFileName, isBuiltin, or source src
    const current = this.state.assets[idx];
    this.state.assets[idx] = {
      ...current,
      ...patch,
      id: current.id,
      originalFileName: current.originalFileName,
      src: current.src,
      isBuiltin: current.isBuiltin
    };
    this.logActivity('asset', `Updated asset "${this.state.assets[idx].name}" (${this.state.assets[idx].status})`);
    this.persist('asset-updated');
    return this.state.assets[idx];
  }

  async deleteAsset(assetId) {
    const asset = this.state.assets.find((a) => a.id === assetId);
    if (!asset) return false;
    this.state.assets = this.state.assets.filter((a) => a.id !== assetId);
    await deleteBlobFromIdb(assetId);
    this.logActivity('asset', `Deleted asset "${asset.name}" from library`);
    this.persist('asset-deleted');
    return true;
  }

  restoreSampleAssets() {
    const sampleAssets = getInitialSampleAssets();
    const existingIds = new Set(this.state.assets.map((a) => a.id));
    let addedCount = 0;
    for (const sa of sampleAssets) {
      if (!existingIds.has(sa.id)) {
        this.state.assets.push(sa);
        addedCount++;
      }
    }
    this.logActivity('asset', `Restored ${addedCount} built-in sample assets to library`);
    this.persist('sample-assets-restored');
    return addedCount;
  }

  updateBrandKit(patch) {
    this.state.brandKit = {
      ...this.state.brandKit,
      ...patch,
      rules: {
        ...this.state.brandKit.rules,
        ...(patch.rules || {})
      },
      updatedAt: new Date().toISOString()
    };
    this.logActivity('brand', `Updated Brand Kit configuration for "${this.state.brandKit.name}"`);
    this.persist('brand-updated');
    return this.state.brandKit;
  }

  saveProjectComposition(projectId, composition, options = {}) {
    const proj = this.state.projects.find((p) => p.id === projectId);
    if (!proj) return null;
    proj.composition = JSON.parse(JSON.stringify(composition));
    proj.updatedAt = new Date().toISOString();
    if (options.status) {
      proj.status = options.status;
    } else if (proj.status === 'Validated' && !options.preserveValidated) {
      proj.status = 'In Progress';
      proj.manualReviewed = false;
    }
    if (options.createSnapshot) {
      const snap = {
        id: uid('snap'),
        label: options.snapshotLabel || `Snapshot (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        createdAt: new Date().toISOString(),
        isSample: false,
        composition: JSON.parse(JSON.stringify(composition))
      };
      proj.snapshots = proj.snapshots || [];
      proj.snapshots.unshift(snap);
      if (proj.snapshots.length > 20) proj.snapshots.length = 20;
      this.logActivity('project', `Saved snapshot "${snap.label}" for "${proj.name}"`);
    }
    this.persist('composition-saved');
    return proj;
  }

  createProject({ name, brand, product, width, height, backgroundColor, templateId }) {
    let baseComposition = {
      width: Number(width) || 1080,
      height: Number(height) || 1080,
      backgroundColor: backgroundColor || this.state.brandKit.backgroundColor || '#F6EFE6',
      elements: []
    };

    if (templateId) {
      const tpl = this.state.templates.find((t) => t.id === templateId);
      if (tpl && tpl.composition) {
        baseComposition = JSON.parse(JSON.stringify(tpl.composition));
      }
    } else {
      baseComposition = JSON.parse(JSON.stringify(getDefaultKopiSenjaComposition()));
      baseComposition.width = Number(width) || 1080;
      baseComposition.height = Number(height) || 1080;
    }

    const newProj = {
      id: uid('proj'),
      name: name || 'Untitled Campaign Design',
      brand: brand || this.state.brandKit.name || 'Kopi Senja',
      product: product || 'Kopi Susu Original',
      status: 'In Progress',
      manualReviewed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSample: false,
      composition: baseComposition,
      snapshots: [
        {
          id: uid('snap'),
          label: 'v1.0 — Project Created',
          createdAt: new Date().toISOString(),
          isSample: false,
          composition: JSON.parse(JSON.stringify(baseComposition))
        }
      ]
    };

    this.state.projects.unshift(newProj);
    this.state.activeProjectId = newProj.id;
    this.logActivity('project', `Created new project "${newProj.name}"`);
    this.persist('project-created');
    return newProj;
  }

  duplicateProject(projectId) {
    const source = this.state.projects.find((p) => p.id === projectId);
    if (!source) return null;
    const copyComp = JSON.parse(JSON.stringify(source.composition));
    const dup = {
      id: uid('proj'),
      name: `${source.name} (Copy)`,
      brand: source.brand,
      product: source.product,
      status: 'In Progress',
      manualReviewed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSample: false,
      composition: copyComp,
      snapshots: [
        {
          id: uid('snap'),
          label: `Duplicated from "${source.name}"`,
          createdAt: new Date().toISOString(),
          isSample: false,
          composition: JSON.parse(JSON.stringify(copyComp))
        }
      ]
    };
    this.state.projects.unshift(dup);
    this.logActivity('project', `Duplicated project "${source.name}"`);
    this.persist('project-duplicated');
    return dup;
  }

  renameProject(projectId, newName) {
    const proj = this.state.projects.find((p) => p.id === projectId);
    if (!proj || !newName.trim()) return null;
    proj.name = newName.trim();
    proj.updatedAt = new Date().toISOString();
    this.logActivity('project', `Renamed project to "${proj.name}"`);
    this.persist('project-renamed');
    return proj;
  }

  deleteProject(projectId) {
    if (this.state.projects.length <= 1) return false;
    const target = this.state.projects.find((p) => p.id === projectId);
    if (!target) return false;
    this.state.projects = this.state.projects.filter((p) => p.id !== projectId);
    if (this.state.activeProjectId === projectId) {
      this.state.activeProjectId = this.state.projects[0]?.id || null;
    }
    this.logActivity('project', `Deleted project "${target.name}"`);
    this.persist('project-deleted');
    return true;
  }

  restoreSnapshot(projectId, snapshotId) {
    const proj = this.state.projects.find((p) => p.id === projectId);
    if (!proj || !Array.isArray(proj.snapshots)) return null;
    const snap = proj.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return null;
    proj.composition = JSON.parse(JSON.stringify(snap.composition));
    proj.updatedAt = new Date().toISOString();
    this.logActivity('project', `Restored snapshot "${snap.label}" in "${proj.name}"`);
    this.persist('snapshot-restored');
    return proj;
  }

  saveCompositionAsTemplate({ name, category, description, composition }) {
    const cw = Number(composition.width) || 1080;
    const ch = Number(composition.height) || 1080;
    const ratio = cw === ch ? '1:1' : Math.abs(cw / ch - 0.8) < 0.05 ? '4:5' : Math.abs(cw / ch - 0.5625) < 0.05 ? '9:16' : Math.abs(cw / ch - 1.777) < 0.05 ? '16:9' : 'Custom';
    const newTpl = {
      id: uid('tpl_usr'),
      name: name || 'Custom Campaign Template',
      category: category || 'Product Promotion',
      aspectRatio: ratio,
      width: cw,
      height: ch,
      brand: this.state.brandKit.name || 'Kopi Senja',
      approved: true,
      isBuiltin: false,
      description: description || 'Custom user-saved composition template with protected asset references.',
      composition: JSON.parse(JSON.stringify(composition))
    };
    this.state.templates.unshift(newTpl);
    this.state.brandKit.approvedTemplateIds.push(newTpl.id);
    this.logActivity('template', `Saved composition as template "${newTpl.name}"`);
    this.persist('template-created');
    return newTpl;
  }

  duplicateTemplate(templateId) {
    const src = this.state.templates.find((t) => t.id === templateId);
    if (!src) return null;
    const copy = {
      ...JSON.parse(JSON.stringify(src)),
      id: uid('tpl_copy'),
      name: `${src.name} (Copy)`,
      isBuiltin: false
    };
    this.state.templates.unshift(copy);
    this.logActivity('template', `Duplicated template "${src.name}"`);
    this.persist('template-duplicated');
    return copy;
  }

  recordValidationRun(report) {
    const entry = {
      id: uid('val'),
      projectId: report.projectId,
      projectName: report.projectName,
      timestamp: new Date().toISOString(),
      score: report.score,
      passCount: report.passCount,
      warningCount: report.warningCount,
      errorCount: report.errorCount,
      status: report.errorCount > 0 ? 'Failed (Critical Issues)' : report.warningCount > 0 ? 'Passed with Warnings' : 'Passed',
      manualReviewed: report.manualReviewed || false,
      isSample: false,
      summary: report.summary
    };
    this.state.validationHistory.unshift(entry);
    if (this.state.validationHistory.length > 30) {
      this.state.validationHistory.length = 30;
    }

    const proj = this.state.projects.find((p) => p.id === report.projectId);
    if (proj) {
      if (report.errorCount > 0) {
        proj.status = 'Needs Review';
        proj.manualReviewed = false;
      } else if (report.warningCount === 0) {
        proj.status = 'Validated';
      } else {
        proj.status = 'Ready to Export';
      }
    }

    this.logActivity('validation', `Validation run on "${report.projectName}": ${entry.status} (${report.score}%)`);
    this.persist('validation-recorded');
    return entry;
  }

  recordExport({ projectId, projectName, presetName, format, width, height }) {
    const entry = {
      id: uid('exp'),
      projectId,
      projectName,
      presetName,
      format: format.toUpperCase(),
      width,
      height,
      timestamp: new Date().toISOString(),
      isSample: false
    };
    this.state.exportHistory.unshift(entry);
    this.logActivity('export', `Exported "${projectName}" as ${format.toUpperCase()} (${width}×${height})`);
    this.persist('export-recorded');
    return entry;
  }

  updateSettings(patch) {
    this.state.settings = {
      ...this.state.settings,
      ...patch
    };
    this.logActivity('settings', 'Updated workspace & editor preferences');
    this.persist('settings-updated');
  }

  updateWorkspaceInfo(patch) {
    this.state.workspace = {
      ...this.state.workspace,
      ...patch
    };
    this.persist('workspace-updated');
  }

  markAllNotificationsRead() {
    for (const n of this.state.notifications) {
      n.read = true;
    }
    this.persist('notifications-read');
  }

  exportWorkspaceJson() {
    const payload = {
      schema: 'https://autodesign.local/schema/workspace-v1.json',
      exportedAt: new Date().toISOString(),
      application: 'AutoDesign Static SaaS Prototype',
      state: this.state
    };
    return JSON.stringify(payload, null, 2);
  }

  importWorkspaceJson(jsonString) {
    const parsed = JSON.parse(jsonString);
    const candidate = parsed.state || parsed;
    if (!candidate || !Array.isArray(candidate.projects) || !Array.isArray(candidate.assets)) {
      throw new Error('Invalid AutoDesign workspace JSON structure: missing projects or assets array.');
    }
    this.state = {
      ...buildInitialState(),
      ...candidate,
      settings: { ...buildInitialState().settings, ...(candidate.settings || {}) },
      brandKit: { ...getDefaultBrandKit(), ...(candidate.brandKit || {}) }
    };
    this.logActivity('settings', 'Imported workspace state from JSON backup');
    this.persist('workspace-imported');
    return this.state;
  }

  async resetToDemoDefaults() {
    await clearAllIdbData();
    localStorage.removeItem(STORAGE_KEY);
    this.state = buildInitialState();
    this.persist('demo-reset');
    return this.state;
  }
}

export const store = new AutoDesignStore();
