/**
 * AutoDesign — Multi-Platform Adaptation & Client-Side Export Engine (PNG, JPEG, SVG)
 * Implements rule-based responsive layout adaptation across aspect ratios and genuine HTML5 Canvas / SVG rendering.
 */

import { store } from './store.js';
import { router } from './router.js';
import { evaluateProjectValidation } from './validation.js';
import {
  escapeHtml,
  clamp,
  formatDate,
  renderMiniComposition,
  downloadBlob,
  showToast
} from './utils.js';

export const EXPORT_PRESETS = [
  {
    id: 'ig-square',
    name: 'Instagram Square',
    platform: 'Instagram Feed / Carousel',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    icon: 'crop_square'
  },
  {
    id: 'ig-portrait',
    name: 'Instagram Portrait',
    platform: 'Instagram 4:5 Feed Post',
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    icon: 'crop_portrait'
  },
  {
    id: 'story-reels',
    name: 'Story & Reels Cover',
    platform: 'Instagram Story / TikTok / Reels',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    icon: 'smartphone'
  },
  {
    id: 'landscape-banner',
    name: 'Landscape Banner',
    platform: 'Web Hero / YouTube / Display Ad',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    icon: 'crop_16_9'
  },
  {
    id: 'custom',
    name: 'Custom Dimensions',
    platform: 'User-Defined Resolution',
    aspectRatio: 'Custom',
    width: 1200,
    height: 1200,
    icon: 'tune'
  }
];

const exportUiState = {
  selectedPresetId: 'ig-square',
  customWidth: 1080,
  customHeight: 1080,
  format: 'png',
  showSafeZone: true,
  lastExportStatus: null
};

/**
 * Deterministic Rule-Based Multi-Platform Layout Adapter
 * Rearranges elements by semantic role while strictly locking product and logo aspect ratios.
 */
export function adaptCompositionToDimensions(sourceComposition, targetWidth, targetHeight) {
  const src = JSON.parse(JSON.stringify(sourceComposition));
  const sw = Number(src.width) || 1080;
  const sh = Number(src.height) || 1080;
  const tw = clamp(Number(targetWidth) || 1080, 320, 4096);
  const th = clamp(Number(targetHeight) || 1080, 320, 4096);

  if (sw === tw && sh === th) {
    return src;
  }

  const adapted = {
    width: tw,
    height: th,
    backgroundColor: src.backgroundColor || '#F6EFE6',
    elements: []
  };

  const ratio = tw / th;
  const minDim = Math.min(tw, th);
  const scaleFactor = minDim / 1080;

  // Categorize elements by semantic role
  const findByRole = (role) => src.elements.find((e) => e.role === role && e.visible !== false);
  const logoEl = findByRole('logo') || src.elements.find((e) => e.type === 'logo');
  const productEl = findByRole('product') || src.elements.find((e) => e.type === 'product');
  const headlineEl = findByRole('headline');
  const subheadlineEl = findByRole('subheadline');
  const priceEl = findByRole('price');
  const ctaEl = findByRole('cta');
  const badgeEls = src.elements.filter((e) => e.role === 'badge' && e.visible !== false);
  const captionEl = findByRole('caption');
  const decorEls = src.elements.filter((e) => (e.role === 'decor' || e.type === 'shape') && e.visible !== false);

  const pushClone = (el, overrides) => {
    if (!el) return;
    adapted.elements.push({
      ...JSON.parse(JSON.stringify(el)),
      ...overrides
    });
  };

  // Helper to compute locked product dimensions
  const computeLockedSize = (el, desiredHeight, maxWidth) => {
    const natW = Number(el?.naturalWidth) || Number(el?.width) || 800;
    const natH = Number(el?.naturalHeight) || Number(el?.height) || 1000;
    const aspect = natW / natH;
    let h = Math.round(desiredHeight);
    let w = Math.round(h * aspect);
    if (maxWidth && w > maxWidth) {
      w = Math.round(maxWidth);
      h = Math.round(w / aspect);
    }
    return { width: w, height: h };
  };

  // CASE A: Widescreen / Landscape (e.g., 1920x1080, ratio >= 1.35)
  if (ratio >= 1.35) {
    const padX = Math.round(tw * 0.065);
    const leftColW = Math.round(tw * 0.46);

    if (decorEls[0]) {
      pushClone(decorEls[0], {
        x: Math.round(tw * 0.56),
        y: Math.round(th * 0.1),
        width: Math.round(th * 0.78),
        height: Math.round(th * 0.78),
        zIndex: 1
      });
    }

    if (logoEl) {
      const lSize = computeLockedSize(logoEl, Math.round(th * 0.078), Math.round(leftColW * 0.55));
      pushClone(logoEl, {
        x: padX,
        y: Math.round(th * 0.08),
        width: lSize.width,
        height: lSize.height,
        zIndex: 3
      });
    }

    const textBadge = badgeEls.find((b) => b.type === 'text');
    if (textBadge) {
      pushClone(textBadge, {
        x: padX,
        y: Math.round(th * 0.2),
        width: Math.min(leftColW, Math.round(440 * scaleFactor)),
        height: Math.round(40 * scaleFactor),
        fontSize: Math.round(16 * scaleFactor),
        zIndex: 4
      });
    }

    if (headlineEl) {
      pushClone(headlineEl, {
        x: padX,
        y: Math.round(th * 0.27),
        width: leftColW,
        height: Math.round(th * 0.22),
        fontSize: Math.round(66 * scaleFactor),
        textAlign: 'left',
        zIndex: 5
      });
    }

    if (subheadlineEl) {
      pushClone(subheadlineEl, {
        x: padX,
        y: Math.round(th * 0.51),
        width: Math.round(leftColW * 0.92),
        height: Math.round(th * 0.12),
        fontSize: Math.round(23 * scaleFactor),
        textAlign: 'left',
        zIndex: 6
      });
    }

    const actionY = Math.round(th * 0.68);
    const priceW = Math.round(240 * scaleFactor);
    const actionH = Math.round(84 * scaleFactor);

    if (priceEl) {
      pushClone(priceEl, {
        x: padX,
        y: actionY,
        width: priceW,
        height: actionH,
        fontSize: Math.round(40 * scaleFactor),
        zIndex: 7
      });
    }

    if (ctaEl) {
      pushClone(ctaEl, {
        x: priceEl ? padX + priceW + Math.round(24 * scaleFactor) : padX,
        y: actionY,
        width: Math.round(330 * scaleFactor),
        height: actionH,
        fontSize: Math.round(27 * scaleFactor),
        zIndex: 8
      });
    }

    if (productEl) {
      const pSize = computeLockedSize(productEl, Math.round(th * 0.66), Math.round(tw * 0.36));
      const px = Math.round(tw * 0.58 + (tw * 0.34 - pSize.width) / 2);
      const py = Math.round((th - pSize.height) / 2);
      pushClone(productEl, {
        x: px,
        y: py,
        width: pSize.width,
        height: pSize.height,
        zIndex: 9
      });
    }

    const imgBadge = badgeEls.find((b) => b.type === 'image');
    if (imgBadge) {
      const bSize = Math.round(145 * scaleFactor);
      pushClone(imgBadge, {
        x: Math.round(tw - padX - bSize),
        y: Math.round(th * 0.72),
        width: bSize,
        height: bSize,
        zIndex: 10
      });
    }

    if (captionEl) {
      pushClone(captionEl, {
        x: padX,
        y: Math.round(th * 0.88),
        width: tw - padX * 2,
        height: Math.round(36 * scaleFactor),
        fontSize: Math.round(16 * scaleFactor),
        textAlign: 'left',
        zIndex: 11
      });
    }

    return adapted;
  }

  // CASE B: Vertical Story / Reels (e.g., 1080x1920, ratio <= 0.68)
  if (ratio <= 0.68) {
    const padX = Math.round(tw * 0.08);
    const contentW = tw - padX * 2;

    if (decorEls[0]) {
      const dSize = Math.round(tw * 0.62);
      pushClone(decorEls[0], {
        x: Math.round((tw - dSize) / 2),
        y: Math.round(th * 0.34),
        width: dSize,
        height: dSize,
        zIndex: 1
      });
    }

    if (logoEl) {
      const lSize = computeLockedSize(logoEl, Math.round(tw * 0.082), Math.round(contentW * 0.45));
      pushClone(logoEl, {
        x: Math.round((tw - lSize.width) / 2),
        y: Math.round(th * 0.085),
        width: lSize.width,
        height: lSize.height,
        zIndex: 3
      });
    }

    if (headlineEl) {
      pushClone(headlineEl, {
        x: padX,
        y: Math.round(th * 0.16),
        width: contentW,
        height: Math.round(th * 0.11),
        fontSize: Math.round(62 * scaleFactor),
        textAlign: 'center',
        zIndex: 5
      });
    }

    if (subheadlineEl) {
      pushClone(subheadlineEl, {
        x: Math.round(tw * 0.12),
        y: Math.round(th * 0.275),
        width: Math.round(tw * 0.76),
        height: Math.round(th * 0.055),
        fontSize: Math.round(22 * scaleFactor),
        textAlign: 'center',
        zIndex: 6
      });
    }

    if (productEl) {
      const pSize = computeLockedSize(productEl, Math.round(th * 0.34), Math.round(tw * 0.56));
      pushClone(productEl, {
        x: Math.round((tw - pSize.width) / 2),
        y: Math.round(th * 0.34),
        width: pSize.width,
        height: pSize.height,
        zIndex: 9
      });
    }

    const imgBadge = badgeEls.find((b) => b.type === 'image');
    if (imgBadge) {
      const bSize = Math.round(148 * scaleFactor);
      pushClone(imgBadge, {
        x: Math.round(tw * 0.68),
        y: Math.round(th * 0.58),
        width: bSize,
        height: bSize,
        zIndex: 10
      });
    }

    if (priceEl) {
      const pw = Math.round(280 * scaleFactor);
      const ph = Math.round(84 * scaleFactor);
      pushClone(priceEl, {
        x: Math.round((tw - pw) / 2),
        y: Math.round(th * 0.71),
        width: pw,
        height: ph,
        fontSize: Math.round(42 * scaleFactor),
        zIndex: 7
      });
    }

    if (ctaEl) {
      const cwBtn = Math.round(tw * 0.58);
      const chBtn = Math.round(90 * scaleFactor);
      pushClone(ctaEl, {
        x: Math.round((tw - cwBtn) / 2),
        y: Math.round(th * 0.775),
        width: cwBtn,
        height: chBtn,
        fontSize: Math.round(30 * scaleFactor),
        zIndex: 8
      });
    }

    if (captionEl) {
      pushClone(captionEl, {
        x: padX,
        y: Math.round(th * 0.86),
        width: contentW,
        height: Math.round(40 * scaleFactor),
        fontSize: Math.round(16 * scaleFactor),
        textAlign: 'center',
        zIndex: 11
      });
    }

    return adapted;
  }

  // CASE C: 4:5 Portrait or Custom Intermediate Aspect Ratio
  const sx = tw / sw;
  const sy = th / sh;
  for (const el of src.elements) {
    if (el.visible === false) continue;
    if (el.type === 'product' || el.role === 'product' || el.type === 'logo' || el.role === 'logo' || el.aspectRatioLocked) {
      const targetH = Math.round(el.height * Math.min(sx, sy));
      const locked = computeLockedSize(el, targetH, Math.round(tw * 0.5));
      pushClone(el, {
        x: clamp(Math.round(el.x * sx), 24, tw - locked.width - 24),
        y: clamp(Math.round(el.y * sy), 24, th - locked.height - 24),
        width: locked.width,
        height: locked.height
      });
    } else {
      const nw = Math.round(el.width * sx);
      const nh = Math.round(el.height * sy);
      pushClone(el, {
        x: clamp(Math.round(el.x * sx), 20, Math.max(20, tw - nw - 20)),
        y: clamp(Math.round(el.y * sy), 20, Math.max(20, th - nh - 20)),
        width: nw,
        height: nh,
        fontSize: el.fontSize ? Math.round(el.fontSize * Math.min(sx, sy)) : undefined
      });
    }
  }

  return adapted;
}

/* ==========================================================================
   Client-Side Raster (PNG / JPEG) & Vector (SVG) Composition Renderer
   ========================================================================== */

function loadHtmlImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ img: null, error: 'Empty image source' });
      return;
    }
    const img = new Image();
    if (/^https?:\/\//i.test(src) && !src.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve({ img, error: null });
    img.onerror = () => resolve({ img: null, error: `Could not load ${src}` });
    img.src = src;
  });
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapCanvasText(ctx, text, maxWidth) {
  const rawLines = String(text || '').split('\n');
  const lines = [];
  for (const rawLine of rawLines) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const testLine = `${currentLine} ${words[i]}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

export async function renderCompositionToBlob(composition, format = 'png') {
  const cw = Number(composition.width) || 1080;
  const ch = Number(composition.height) || 1080;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // 1. Background Fill
  ctx.fillStyle = composition.backgroundColor || '#F6EFE6';
  ctx.fillRect(0, 0, cw, ch);

  const sorted = [...(composition.elements || [])]
    .filter((el) => el.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const warnings = [];

  // 2. Render Layers in Z-Order
  for (const el of sorted) {
    ctx.save();
    ctx.globalAlpha = clamp(Number(el.opacity ?? 1), 0, 1);

    const x = Number(el.x) || 0;
    const y = Number(el.y) || 0;
    const w = Number(el.width) || 100;
    const h = Number(el.height) || 100;

    if (el.type === 'shape') {
      if (el.shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = el.backgroundColor || '#EADBC8';
        ctx.fill();
        if (el.borderWidth) {
          ctx.lineWidth = Number(el.borderWidth);
          ctx.strokeStyle = el.borderColor || '#D5BFA4';
          ctx.stroke();
        }
      } else {
        drawRoundedRect(ctx, x, y, w, h, Number(el.borderRadius) || 0);
        ctx.fillStyle = el.backgroundColor || '#EFE3D3';
        ctx.fill();
        if (el.borderWidth) {
          ctx.lineWidth = Number(el.borderWidth);
          ctx.strokeStyle = el.borderColor || '#D5BFA4';
          ctx.stroke();
        }
      }
      ctx.restore();
      continue;
    }

    if (el.type === 'product' || el.type === 'logo' || el.type === 'image') {
      const { img, error } = await loadHtmlImage(el.src);
      if (img) {
        // Object-fit contain calculation to preserve product proportions 100%
        const iw = img.naturalWidth || w;
        const ih = img.naturalHeight || h;
        const scale = Math.min(w / iw, h / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = x + (w - dw) / 2;
        const dy = y + (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        warnings.push(error || `Fallback placeholder rendered for "${el.name}"`);
        drawRoundedRect(ctx, x, y, w, h, 12);
        ctx.fillStyle = '#EFE3D3';
        ctx.fill();
        ctx.strokeStyle = '#9A5B25';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#1E1815';
        ctx.font = '600 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.name || 'Protected Asset', x + w / 2, y + h / 2);
      }
      ctx.restore();
      continue;
    }

    // Text / Headline / Price / CTA
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      drawRoundedRect(ctx, x, y, w, h, Number(el.borderRadius) || 0);
      ctx.fillStyle = el.backgroundColor;
      ctx.fill();
    }
    if (el.borderWidth) {
      drawRoundedRect(ctx, x, y, w, h, Number(el.borderRadius) || 0);
      ctx.lineWidth = Number(el.borderWidth);
      ctx.strokeStyle = el.borderColor || '#D5BFA4';
      ctx.stroke();
    }

    const fontSize = Number(el.fontSize) || 32;
    const fontWeight = el.fontWeight || '600';
    const fontFamily = el.fontFamily || 'Inter';
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", Inter, sans-serif`;
    ctx.fillStyle = el.color || '#1E1815';

    const hasBoxFill = el.backgroundColor && el.backgroundColor !== 'transparent';
    const padX = hasBoxFill ? 20 : 0;
    const lines = wrapCanvasText(ctx, el.text || '', Math.max(40, w - padX * 2));
    const lineHeightPx = fontSize * (Number(el.lineHeight) || 1.2);
    const totalTextH = lines.length * lineHeightPx;

    const align = el.textAlign || 'left';
    ctx.textAlign = align;
    ctx.textBaseline = 'top';

    const startY = hasBoxFill ? y + (h - totalTextH) / 2 : y;
    const textX = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;

    lines.forEach((line, idx) => {
      ctx.fillText(line, textX, startY + idx * lineHeightPx);
    });

    ctx.restore();
  }

  const mime = format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.94));
  return { blob, warnings };
}

export async function renderCompositionToSvgBlob(composition) {
  const cw = Number(composition.width) || 1080;
  const ch = Number(composition.height) || 1080;
  const bg = escapeHtml(composition.backgroundColor || '#F6EFE6');

  const sorted = [...(composition.elements || [])]
    .filter((el) => el.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const svgNodes = [];
  svgNodes.push(`<rect width="${cw}" height="${ch}" fill="${bg}" />`);

  for (const el of sorted) {
    const x = Math.round(Number(el.x) || 0);
    const y = Math.round(Number(el.y) || 0);
    const w = Math.round(Number(el.width) || 100);
    const h = Math.round(Number(el.height) || 100);
    const op = clamp(Number(el.opacity ?? 1), 0, 1);

    if (el.type === 'shape') {
      const fill = escapeHtml(el.backgroundColor || '#EADBC8');
      const strokeAttr = el.borderWidth
        ? ` stroke="${escapeHtml(el.borderColor || '#D5BFA4')}" stroke-width="${Number(el.borderWidth)}"`
        : '';
      if (el.shapeType === 'circle') {
        svgNodes.push(
          `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" opacity="${op}"${strokeAttr} />`
        );
      } else {
        const rx = Number(el.borderRadius) || 0;
        svgNodes.push(
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${op}"${strokeAttr} />`
        );
      }
      continue;
    }

    if (el.type === 'product' || el.type === 'logo' || el.type === 'image') {
      // Embed image as data URL when possible so standalone SVG renders everywhere
      let href = el.src || '';
      try {
        const { img } = await loadHtmlImage(el.src);
        if (img) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.naturalWidth || w;
          tempCanvas.height = img.naturalHeight || h;
          tempCanvas.getContext('2d').drawImage(img, 0, 0);
          href = tempCanvas.toDataURL('image/png');
        }
      } catch {
        href = el.src || '';
      }
      svgNodes.push(
        `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${escapeHtml(href)}" preserveAspectRatio="xMidYMid meet" opacity="${op}" />`
      );
      continue;
    }

    // Text node + optional background box
    if (el.backgroundColor && el.backgroundColor !== 'transparent') {
      const rx = Number(el.borderRadius) || 0;
      const strokeAttr = el.borderWidth
        ? ` stroke="${escapeHtml(el.borderColor || '#D5BFA4')}" stroke-width="${Number(el.borderWidth)}"`
        : '';
      svgNodes.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${escapeHtml(el.backgroundColor)}" opacity="${op}"${strokeAttr} />`
      );
    }

    const fontSize = Number(el.fontSize) || 32;
    const fontWeight = escapeHtml(el.fontWeight || '600');
    const fontFamily = escapeHtml(el.fontFamily || 'Inter');
    const color = escapeHtml(el.color || '#1E1815');
    const align = el.textAlign || 'left';
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
    const hasBox = el.backgroundColor && el.backgroundColor !== 'transparent';
    const padX = hasBox ? 20 : 0;
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;

    const lines = String(el.text || '').split('\n');
    const lineHeightPx = fontSize * (Number(el.lineHeight) || 1.2);
    const totalH = lines.length * lineHeightPx;
    const baseY = hasBox ? y + (h - totalH) / 2 + fontSize * 0.85 : y + fontSize * 0.9;

    const tspans = lines
      .map(
        (line, idx) =>
          `<tspan x="${tx}" y="${Math.round(baseY + idx * lineHeightPx)}">${escapeHtml(line)}</tspan>`
      )
      .join('');

    svgNodes.push(
      `<text font-family="${fontFamily}, Inter, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${anchor}" opacity="${op}">${tspans}</text>`
    );
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cw} ${ch}" width="${cw}" height="${ch}">\n  ${svgNodes.join('\n  ')}\n</svg>`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  return { blob, warnings: [] };
}

/* ==========================================================================
   Multi-Platform Export Screen UI
   ========================================================================== */

export function renderExport(container, params = {}) {
  const state = store.getState();
  if (params.projectId) {
    store.setActiveProject(params.projectId);
  }

  const activeProject = store.getActiveProject();
  const projects = state.projects || [];

  const preset =
    EXPORT_PRESETS.find((p) => p.id === exportUiState.selectedPresetId) || EXPORT_PRESETS[0];

  const targetW =
    preset.id === 'custom' ? Number(exportUiState.customWidth) || 1080 : preset.width;
  const targetH =
    preset.id === 'custom' ? Number(exportUiState.customHeight) || 1080 : preset.height;

  const adaptedComposition = activeProject
    ? adaptCompositionToDimensions(activeProject.composition, targetW, targetH)
    : null;

  const valReport = activeProject
    ? evaluateProjectValidation({ ...activeProject, composition: adaptedComposition }, state)
    : null;

  container.innerHTML = `
    <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-6">
      <!-- Top Header -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--color-text-main)]">Multi-Platform Adaptation &amp; Export</h2>
            <span class="badge badge-primary">${targetW} × ${targetH} px</span>
          </div>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Rule-based JavaScript layout adaptation preserves product proportions and text readability across aspect ratios.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <select id="exp-project-select" aria-label="Select project to export" class="input-field w-auto py-1.5 text-xs font-medium">
            ${projects
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" ${p.id === activeProject?.id ? 'selected' : ''}>Project: ${escapeHtml(p.name)}</option>`
              )
              .join('')}
          </select>

          <button type="button" id="exp-apply-to-studio-btn" class="btn btn-secondary btn-sm" title="Commit this adapted aspect ratio layout into Design Studio">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">edit_square</span>
            <span>Open Adapted Layout in Studio</span>
          </button>

          <button type="button" id="exp-download-main-btn" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">download</span>
            <span>Download ${exportUiState.format.toUpperCase()} (${targetW}×${targetH})</span>
          </button>
        </div>
      </div>

      <!-- Main Grid: Left Controls (5 cols) + Right Live Adapted Preview (7 cols) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 5 Cols: Platform Presets, Dimensions, Format & Validation Status -->
        <div class="lg:col-span-5 space-y-4">
          <!-- 1. Platform Presets -->
          <section class="card-surface p-4 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">1. Target Platform Preset</h3>
              <span class="text-[11px] text-[var(--color-text-secondary)]">Smart Reflow Active</span>
            </div>

            <div class="space-y-2">
              ${EXPORT_PRESETS.map((p) => {
                const isSel = p.id === exportUiState.selectedPresetId;
                return `
                  <button
                    type="button"
                    data-preset-id="${escapeHtml(p.id)}"
                    class="w-full p-3 rounded-md border text-left flex items-center justify-between gap-3 transition cursor-pointer ${
                      isSel
                        ? 'border-[#2563EB] bg-blue-50/60 ring-1 ring-[#2563EB]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]'
                    }"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <span class="material-symbols-outlined ${isSel ? 'text-blue-600' : 'text-[var(--color-text-secondary)]'}" aria-hidden="true">${p.icon}</span>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-[var(--color-text-main)]">${escapeHtml(p.name)}</div>
                        <div class="text-[11px] text-[var(--color-text-secondary)] truncate">${escapeHtml(p.platform)}</div>
                      </div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="text-xs font-mono font-semibold text-[var(--color-text-main)]">${p.id === 'custom' ? `${targetW}×${targetH}` : `${p.width}×${p.height}`}</div>
                      <div class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(p.aspectRatio)}</div>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Custom Width & Height Controls -->
            <div class="pt-2 border-t border-[var(--color-border)] grid grid-cols-2 gap-3 text-xs">
              <div>
                <label for="exp-width-input" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Width (px)</label>
                <input
                  type="number"
                  id="exp-width-input"
                  min="320"
                  max="4096"
                  step="10"
                  value="${targetW}"
                  class="input-field font-mono text-xs"
                />
              </div>
              <div>
                <label for="exp-height-input" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Height (px)</label>
                <input
                  type="number"
                  id="exp-height-input"
                  min="320"
                  max="4096"
                  step="10"
                  value="${targetH}"
                  class="input-field font-mono text-xs"
                />
              </div>
            </div>
          </section>

          <!-- 2. Export Format & Safe Area Guides -->
          <section class="card-surface p-4 space-y-3">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">2. Output Format &amp; Safe-Zone Guides</h3>

            <div class="grid grid-cols-3 gap-2">
              ${[
                { id: 'png', label: 'PNG', desc: 'Lossless Raster' },
                { id: 'jpeg', label: 'JPEG', desc: 'Compressed Photo' },
                { id: 'svg', label: 'SVG', desc: 'Scalable Vector' }
              ]
                .map((fmt) => {
                  const active = exportUiState.format === fmt.id;
                  return `
                    <button
                      type="button"
                      data-export-format="${fmt.id}"
                      class="p-2.5 rounded-md border text-center transition cursor-pointer ${
                        active
                          ? 'border-[#2563EB] bg-blue-50/70 text-blue-700 font-semibold'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-main)]'
                      }"
                    >
                      <div class="text-xs font-bold">${fmt.label}</div>
                      <div class="text-[10px] text-[var(--color-text-secondary)] mt-0.5">${fmt.desc}</div>
                    </button>
                  `;
                })
                .join('')}
            </div>

            <label class="flex items-center justify-between p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-xs cursor-pointer">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined icon-sm text-blue-600" aria-hidden="true">grid_guides</span>
                <span>Show Platform Safe-Area Guides (80% Central Zone)</span>
              </div>
              <input type="checkbox" id="exp-safezone-toggle" class="w-4 h-4 accent-blue-600" ${exportUiState.showSafeZone ? 'checked' : ''} />
            </label>
          </section>

          <!-- 3. Pre-Export Validation Feedback -->
          <section class="card-surface p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">3. Pre-Export Validation Check</h3>
              <span class="badge ${valReport?.errorCount > 0 ? 'badge-error' : 'badge-success'}">
                ${valReport?.score || 100}% Score
              </span>
            </div>
            <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              ${escapeHtml(valReport?.summary || 'Composition verified for export.')}
            </p>
            <div class="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <span class="material-symbols-outlined icon-sm text-emerald-700" aria-hidden="true">lock</span>
              <span>Product asset proportions locked at native 4:5 ratio across all adapted presets.</span>
            </div>
            ${
              exportUiState.lastExportStatus
                ? `<div class="p-2.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs flex items-center gap-2">
                     <span class="material-symbols-outlined icon-sm" aria-hidden="true">task_alt</span>
                     <span>${escapeHtml(exportUiState.lastExportStatus)}</span>
                   </div>`
                : ''
            }
          </section>
        </div>

        <!-- Right 7 Cols: Live Multi-Platform Preview & Export History -->
        <div class="lg:col-span-7 space-y-5">
          <!-- Main Adapted Preview Card -->
          <section class="card-surface overflow-hidden">
            <div class="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="text-xs font-bold text-[var(--color-text-main)]">${escapeHtml(preset.name)} Live Adaptation Preview</span>
                <span class="text-xs text-[var(--color-text-secondary)] ml-2">(${targetW} × ${targetH} px)</span>
              </div>
              <span class="badge badge-neutral">Rule-Based Reflow</span>
            </div>

            <div class="h-[460px] bg-slate-200/70 flex items-center justify-center p-6 relative" style="background-image: radial-gradient(#CBD5E1 1px, transparent 1px); background-size: 16px 16px;">
              <div class="relative flex items-center justify-center w-full h-full">
                ${renderMiniComposition(adaptedComposition, { maxWidth: 520, maxHeight: 400 })}
                ${
                  exportUiState.showSafeZone
                    ? `<div class="pointer-events-none absolute inset-12 border-2 border-dashed border-blue-600/60 rounded flex items-start justify-between p-2">
                         <span class="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">SAFE AREA GUIDE</span>
                         <span class="px-1.5 py-0.5 rounded bg-slate-900/75 text-amber-200 text-[10px] font-mono">${targetW}×${targetH}</span>
                       </div>`
                    : ''
                }
              </div>
            </div>

            <!-- Multi-Ratio Strip Preview (Compare all 4 ratios side by side) -->
            <div class="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-2.5">
              <div class="text-xs font-semibold text-[var(--color-text-main)]">All-Platform Simultaneous Adaptation Strip</div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${EXPORT_PRESETS.slice(0, 4)
                  .map((p) => {
                    const miniComp = activeProject
                      ? adaptCompositionToDimensions(activeProject.composition, p.width, p.height)
                      : null;
                    return `
                      <div
                        data-preset-id="${escapeHtml(p.id)}"
                        class="rounded border ${
                          p.id === exportUiState.selectedPresetId ? 'border-blue-600 ring-1 ring-blue-600' : 'border-[var(--color-border)]'
                        } overflow-hidden cursor-pointer hover:border-blue-400 transition"
                      >
                        <div class="h-28 border-b border-[var(--color-border)]">
                          ${renderMiniComposition(miniComp, { maxWidth: 130, maxHeight: 100 })}
                        </div>
                        <div class="p-2 text-center bg-[var(--color-bg)]">
                          <div class="text-[11px] font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(p.name)}</div>
                          <div class="text-[10px] font-mono text-[var(--color-text-secondary)]">${p.width}×${p.height}</div>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          </section>

          <!-- Recent Exports History Table -->
          <section class="card-surface overflow-hidden">
            <div class="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between">
              <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Export History</h3>
              <span class="badge badge-neutral">${(state.exportHistory || []).length} Files</span>
            </div>
            <div class="divide-y divide-[var(--color-border)] max-h-48 overflow-y-auto text-xs">
              ${(state.exportHistory || [])
                .map(
                  (eh) => `
                  <div class="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <span class="font-semibold text-[var(--color-text-main)]">${escapeHtml(eh.projectName)}</span>
                      <span class="text-[var(--color-text-secondary)] ml-1.5">· ${escapeHtml(eh.presetName)}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0 text-[11px] text-[var(--color-text-secondary)]">
                      <span class="badge badge-primary font-mono">${escapeHtml(eh.format)} · ${eh.width}×${eh.height}</span>
                      <span>${escapeHtml(formatDate(eh.timestamp))}</span>
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Event Listeners
  container.querySelector('#exp-project-select')?.addEventListener('change', (e) => {
    store.setActiveProject(e.target.value);
    renderExport(container);
  });

  container.querySelectorAll('[data-preset-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-preset-id');
      exportUiState.selectedPresetId = pid;
      const found = EXPORT_PRESETS.find((p) => p.id === pid);
      if (found && pid !== 'custom') {
        exportUiState.customWidth = found.width;
        exportUiState.customHeight = found.height;
      }
      renderExport(container);
    });
  });

  container.querySelector('#exp-width-input')?.addEventListener('change', (e) => {
    exportUiState.selectedPresetId = 'custom';
    exportUiState.customWidth = clamp(Number(e.target.value) || 1080, 320, 4096);
    renderExport(container);
  });

  container.querySelector('#exp-height-input')?.addEventListener('change', (e) => {
    exportUiState.selectedPresetId = 'custom';
    exportUiState.customHeight = clamp(Number(e.target.value) || 1080, 320, 4096);
    renderExport(container);
  });

  container.querySelectorAll('[data-export-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      exportUiState.format = btn.getAttribute('data-export-format');
      renderExport(container);
    });
  });

  container.querySelector('#exp-safezone-toggle')?.addEventListener('change', (e) => {
    exportUiState.showSafeZone = Boolean(e.target.checked);
    renderExport(container);
  });

  container.querySelector('#exp-apply-to-studio-btn')?.addEventListener('click', () => {
    if (!activeProject || !adaptedComposition) return;
    store.saveProjectComposition(activeProject.id, adaptedComposition, {
      createSnapshot: true,
      snapshotLabel: `Adapted to ${preset.name} (${targetW}×${targetH})`
    });
    showToast(`Applied ${targetW}×${targetH} adapted layout to "${activeProject.name}".`, 'success');
    router.navigate('design-studio', { projectId: activeProject.id });
  });

  container.querySelector('#exp-download-main-btn')?.addEventListener('click', async () => {
    if (!activeProject || !adaptedComposition) return;
    const dlBtn = container.querySelector('#exp-download-main-btn');
    if (dlBtn) dlBtn.disabled = true;

    try {
      const fmt = exportUiState.format;
      const slug = (activeProject.name || 'autodesign-export')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const filename = `${slug}-${targetW}x${targetH}.${fmt === 'jpeg' ? 'jpg' : fmt}`;

      let res;
      if (fmt === 'svg') {
        res = await renderCompositionToSvgBlob(adaptedComposition);
      } else {
        res = await renderCompositionToBlob(adaptedComposition, fmt);
      }

      if (res && res.blob) {
        downloadBlob(res.blob, filename);
        store.recordExport({
          projectId: activeProject.id,
          projectName: activeProject.name,
          presetName: `${preset.name} (${targetW}×${targetH})`,
          format: fmt,
          width: targetW,
          height: targetH
        });
        exportUiState.lastExportStatus =
          res.warnings && res.warnings.length > 0
            ? `Exported ${filename} with fallback notice: ${res.warnings[0]}`
            : `Successfully rendered & downloaded ${filename} (${targetW}×${targetH} px).`;
        showToast(`Downloaded ${filename}`, 'success');
        renderExport(container);
      }
    } catch (err) {
      showToast(`Export error: ${err.message || 'Unable to render composition'}`, 'error');
    } finally {
      if (dlBtn) dlBtn.disabled = false;
    }
  });
}
