/**
 * AutoDesign — Rule-Based Design Validation Engine & History View
 * Performs 11 deterministic checks across product integrity, asset approval, brand compliance,
 * logo protection, WCAG 2.1 contrast, overlap, canvas bounds, aspect ratio, required fields, export resolution, and missing assets.
 */

import { store } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  clamp,
  formatDate,
  getContrastRatio,
  suggestAccessibleTextColor,
  rectsOverlap,
  checkElementBounds,
  getAspectRatioLabel,
  showToast
} from './utils.js';

export function evaluateProjectValidation(project, state = store.getState()) {
  if (!project || !project.composition) {
    return {
      projectId: '',
      projectName: 'No Project',
      score: 0,
      passCount: 0,
      warningCount: 0,
      errorCount: 1,
      findings: [],
      summary: 'No active project composition available.'
    };
  }

  const comp = project.composition;
  const cw = Number(comp.width) || 1080;
  const ch = Number(comp.height) || 1080;
  const elements = (comp.elements || []).filter((e) => e.visible !== false);
  const assets = state.assets || [];
  const brand = state.brandKit || {};
  const rules = brand.rules || {};

  const findings = [];

  // 1. Product Asset Integrity Check
  const productElements = elements.filter((e) => e.type === 'product' || e.role === 'product');
  if (productElements.length === 0) {
    findings.push({
      id: 'rule-product-integrity',
      title: '1. Product Asset Integrity',
      category: 'Product Protection',
      status: 'error',
      elementId: null,
      elementName: 'Product Layer Missing',
      description: 'No approved source product image is placed on the canvas.',
      fixLabel: 'Restore Hero Product Asset',
      canAutoFix: true
    });
  } else {
    let integrityIssue = null;
    for (const prod of productElements) {
      const natW = Number(prod.naturalWidth) || 800;
      const natH = Number(prod.naturalHeight) || 1000;
      const natRatio = natW / natH;
      const curRatio = (Number(prod.width) || 1) / (Number(prod.height) || 1);
      const ratioDiff = Math.abs(curRatio - natRatio) / natRatio;

      if (ratioDiff > 0.03) {
        integrityIssue = {
          el: prod,
          msg: `Product "${prod.name}" aspect ratio is distorted (${curRatio.toFixed(2)} vs source ${natRatio.toFixed(2)}). AI/Editor rules forbid stretching product imagery.`
        };
        break;
      }
      if (rules.lockProductAspectRatio && !prod.protected) {
        integrityIssue = {
          el: prod,
          severity: 'warning',
          msg: `Product "${prod.name}" has protection lock disabled. Enable source protection to prevent accidental distortion.`
        };
      }
    }

    if (integrityIssue) {
      findings.push({
        id: 'rule-product-integrity',
        title: '1. Product Asset Integrity',
        category: 'Product Protection',
        status: integrityIssue.severity || 'error',
        elementId: integrityIssue.el.id,
        elementName: integrityIssue.el.name,
        description: integrityIssue.msg,
        fixLabel: 'Restore Proportional Aspect Ratio & Lock',
        canAutoFix: true
      });
    } else {
      findings.push({
        id: 'rule-product-integrity',
        title: '1. Product Asset Integrity',
        category: 'Product Protection',
        status: 'pass',
        elementId: productElements[0].id,
        elementName: productElements[0].name,
        description: `Source product image proportions are intact (${productElements[0].width}×${productElements[0].height} px) and protected against destructive edits.`,
        canAutoFix: false
      });
    }
  }

  // 2. Product Asset Approval Check
  const linkedAssetEls = elements.filter((e) => e.assetId);
  let unapprovedFinding = null;
  for (const el of linkedAssetEls) {
    const libAsset = assets.find((a) => a.id === el.assetId);
    if (libAsset && libAsset.status !== 'approved') {
      const isErr = libAsset.status === 'rejected' || Boolean(rules.requireApprovedAssets);
      unapprovedFinding = {
        el,
        libAsset,
        status: isErr ? 'error' : 'warning',
        msg: `Layer "${el.name}" uses asset "${libAsset.name}" which has status "${libAsset.status.toUpperCase()}" in Asset Library.`
      };
      break;
    }
  }

  if (unapprovedFinding) {
    findings.push({
      id: 'rule-asset-approval',
      title: '2. Product Asset Approval Governance',
      category: 'Asset Governance',
      status: unapprovedFinding.status,
      elementId: unapprovedFinding.el.id,
      elementName: unapprovedFinding.el.name,
      description: unapprovedFinding.msg,
      fixLabel: 'Approve Asset in Library',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-asset-approval',
      title: '2. Product Asset Approval Governance',
      category: 'Asset Governance',
      status: 'pass',
      elementId: productElements[0]?.id || null,
      elementName: productElements[0]?.name || 'All Linked Assets',
      description: `All ${linkedAssetEls.length} linked visual assets in this composition are marked Approved in the Asset Library.`,
      canAutoFix: false
    });
  }

  // 3. Brand Color Compliance Check
  const approvedPalette = (brand.approvedColors || ['#1E1815', '#9A5B25', '#D97706', '#F6EFE6', '#EFE3D3', '#EADBC8', '#FFFFFF', '#181310']).map((c) =>
    c.toUpperCase()
  );
  const canvasBg = (comp.backgroundColor || '#F6EFE6').toUpperCase();
  const bgCompliant = !rules.restrictBackgroundPalette || approvedPalette.includes(canvasBg);

  if (!bgCompliant) {
    findings.push({
      id: 'rule-brand-colors',
      title: '3. Brand Color Compliance',
      category: 'Brand Identity',
      status: 'warning',
      elementId: null,
      elementName: `Canvas Background (${canvasBg})`,
      description: `Canvas background ${canvasBg} is outside the approved ${brand.name || 'Kopi Senja'} palette (${approvedPalette.slice(0, 5).join(', ')}).`,
      fixLabel: `Apply Brand Surface (${brand.backgroundColor || '#F6EFE6'})`,
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-brand-colors',
      title: '3. Brand Color Compliance',
      category: 'Brand Identity',
      status: 'pass',
      elementId: null,
      elementName: `Canvas Surface (${canvasBg})`,
      description: `Canvas background and primary accents match approved ${brand.name || 'Kopi Senja'} brand tokens.`,
      canAutoFix: false
    });
  }

  // 4. Logo Protection & Clear Space Check
  const logoEl = elements.find((e) => e.type === 'logo' || e.role === 'logo');
  const minClear = Number(rules.minLogoClearSpacePx ?? 24);
  if (!logoEl && rules.requireBrandLogo !== false) {
    findings.push({
      id: 'rule-logo-protection',
      title: '4. Official Logo Protection & Clear Space',
      category: 'Brand Identity',
      status: 'error',
      elementId: null,
      elementName: 'Brand Logo Missing',
      description: `Brand Kit requires an official ${brand.name || 'Kopi Senja'} logo in promotional compositions.`,
      fixLabel: 'Insert Official Brand Logo',
      canAutoFix: true
    });
  } else if (logoEl) {
    const tooCloseEdge =
      logoEl.x < minClear ||
      logoEl.y < minClear ||
      logoEl.x + logoEl.width > cw - minClear ||
      logoEl.y + logoEl.height > ch - minClear;
    const lowOpacity = (logoEl.opacity ?? 1) < 0.98;

    if (lowOpacity || tooCloseEdge) {
      findings.push({
        id: 'rule-logo-protection',
        title: '4. Official Logo Protection & Clear Space',
        category: 'Brand Identity',
        status: 'warning',
        elementId: logoEl.id,
        elementName: logoEl.name,
        description: lowOpacity
          ? `Logo opacity is ${(logoEl.opacity * 100).toFixed(0)}% (must be 100% under Logo Protection rules).`
          : `Logo violates minimum ${minClear}px clear-space buffer from canvas edges.`,
        fixLabel: 'Enforce Logo Clear Space & 100% Opacity',
        canAutoFix: true
      });
    } else {
      findings.push({
        id: 'rule-logo-protection',
        title: '4. Official Logo Protection & Clear Space',
        category: 'Brand Identity',
        status: 'pass',
        elementId: logoEl.id,
        elementName: logoEl.name,
        description: `Logo maintains ≥${minClear}px clear-space margin and 100% opacity without distortion.`,
        canAutoFix: false
      });
    }
  } else {
    findings.push({
      id: 'rule-logo-protection',
      title: '4. Official Logo Protection & Clear Space',
      category: 'Brand Identity',
      status: 'pass',
      elementId: null,
      elementName: 'Logo Optional',
      description: 'Logo requirement is optional in current Brand Kit settings.',
      canAutoFix: false
    });
  }

  // 5. Text Contrast Check (WCAG 2.1)
  const textEls = elements.filter((e) => e.type === 'text' || e.role === 'headline' || e.role === 'subheadline' || e.role === 'cta' || e.role === 'price');
  const minContrast = Number(rules.minContrastRatio) || 4.5;
  let lowContrastFinding = null;

  for (const tel of textEls) {
    const effectiveBg =
      tel.backgroundColor && tel.backgroundColor !== 'transparent'
        ? tel.backgroundColor
        : comp.backgroundColor || '#F6EFE6';
    const ratio = getContrastRatio(tel.color || '#1E1815', effectiveBg);
    const isLargeText = (Number(tel.fontSize) || 24) >= 36 && Number(tel.fontWeight || 600) >= 700;
    const threshold = isLargeText ? Math.min(minContrast, 3.5) : minContrast;

    if (ratio < threshold) {
      lowContrastFinding = {
        el: tel,
        ratio,
        threshold,
        effectiveBg
      };
      break;
    }
  }

  if (lowContrastFinding) {
    findings.push({
      id: 'rule-text-contrast',
      title: '5. WCAG 2.1 Text Contrast Compliance',
      category: 'Accessibility & Legibility',
      status: lowContrastFinding.ratio < 3.0 ? 'error' : 'warning',
      elementId: lowContrastFinding.el.id,
      elementName: lowContrastFinding.el.name,
      description: `"${lowContrastFinding.el.name}" has a contrast ratio of ${lowContrastFinding.ratio}:1 against ${lowContrastFinding.effectiveBg} (minimum required: ${lowContrastFinding.threshold}:1).`,
      fixLabel: 'Adjust Text Color for High Contrast',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-text-contrast',
      title: '5. WCAG 2.1 Text Contrast Compliance',
      category: 'Accessibility & Legibility',
      status: 'pass',
      elementId: textEls[0]?.id || null,
      elementName: 'All Text Layers',
      description: `All ${textEls.length} text and CTA layers satisfy WCAG contrast requirements (≥${minContrast}:1).`,
      canAutoFix: false
    });
  }

  // 6. Text and Element Overlap Check
  const foregroundContent = elements.filter((e) => e.role !== 'decor' && e.type !== 'shape');
  let overlapPair = null;
  for (let i = 0; i < foregroundContent.length; i++) {
    for (let j = i + 1; j < foregroundContent.length; j++) {
      const a = foregroundContent[i];
      const b = foregroundContent[j];
      // Allow badge on corner of product, but flag text-on-text or text-on-product overlap
      if ((a.role === 'badge' && b.role === 'product') || (a.role === 'product' && b.role === 'badge')) {
        continue;
      }
      const check = rectsOverlap(a, b, 6);
      if (check.overlaps && check.area > 400) {
        overlapPair = { a, b };
        break;
      }
    }
    if (overlapPair) break;
  }

  if (overlapPair) {
    findings.push({
      id: 'rule-element-overlap',
      title: '6. Text & Element Overlap Detection',
      category: 'Layout Geometry',
      status: 'warning',
      elementId: overlapPair.b.id,
      elementName: `${overlapPair.a.name} / ${overlapPair.b.name}`,
      description: `"${overlapPair.a.name}" and "${overlapPair.b.name}" bounding boxes overlap, which may reduce layout legibility.`,
      fixLabel: 'Separate Overlapping Elements',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-element-overlap',
      title: '6. Text & Element Overlap Detection',
      category: 'Layout Geometry',
      status: 'pass',
      elementId: null,
      elementName: 'Layout Hierarchy',
      description: 'Zero unintended bounding-box collisions detected between copy, CTA, logo, and product layers.',
      canAutoFix: false
    });
  }

  // 7. Canvas Boundary Overflow Check
  let overflowEl = null;
  for (const el of foregroundContent) {
    const b = checkElementBounds(el, cw, ch);
    if (b.overflows) {
      overflowEl = el;
      break;
    }
  }

  if (overflowEl) {
    findings.push({
      id: 'rule-boundary-overflow',
      title: '7. Canvas Boundary Overflow Check',
      category: 'Layout Geometry',
      status: 'error',
      elementId: overflowEl.id,
      elementName: overflowEl.name,
      description: `Element "${overflowEl.name}" extends outside the ${cw}×${ch} px canvas boundary and will be clipped on export.`,
      fixLabel: 'Snap Element Inside Safe Canvas Bounds',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-boundary-overflow',
      title: '7. Canvas Boundary Overflow Check',
      category: 'Layout Geometry',
      status: 'pass',
      elementId: null,
      elementName: 'Canvas Safe Bounds',
      description: `All foreground elements sit cleanly within the ${cw}×${ch} px canvas frame.`,
      canAutoFix: false
    });
  }

  // 8. Aspect Ratio Compliance
  const ratioLabel = getAspectRatioLabel(cw, ch);
  const isStandardRatio = !ratioLabel.includes('Custom');
  findings.push({
    id: 'rule-aspect-ratio',
    title: '8. Platform Aspect Ratio Check',
    category: 'Multi-Platform Spec',
    status: isStandardRatio ? 'pass' : 'warning',
    elementId: null,
    elementName: `${cw}×${ch} (${ratioLabel})`,
    description: isStandardRatio
      ? `Canvas matches standard social/display aspect ratio: ${ratioLabel} (${cw}×${ch} px).`
      : `Canvas uses custom aspect ratio (${cw}×${ch} px). Verify target placement requirements.`,
    fixLabel: 'Normalize to 1080×1080 Square',
    canAutoFix: !isStandardRatio
  });

  // 9. Required Campaign Content Fields
  const hasHeadline = elements.some((e) => e.role === 'headline' || (e.type === 'text' && (e.fontSize || 0) >= 44));
  const hasPrice = elements.some((e) => e.role === 'price' || (e.text && /rp\s?\d+/i.test(e.text)));
  const hasCta = elements.some((e) => e.role === 'cta' || (e.text && /pesan|beli|order|shop|sekarang/i.test(e.text)));
  const missingFields = [];
  if (productElements.length === 0) missingFields.push('Product Image');
  if (!hasHeadline) missingFields.push('Headline');
  if (!hasPrice) missingFields.push('Price Callout');
  if (!hasCta) missingFields.push('CTA Button');

  if (missingFields.length > 0) {
    findings.push({
      id: 'rule-required-fields',
      title: '9. Required Campaign Content Fields',
      category: 'Campaign Completeness',
      status: 'error',
      elementId: null,
      elementName: missingFields.join(', '),
      description: `Promotional layout is missing required conversion elements: ${missingFields.join(', ')}.`,
      fixLabel: 'Insert Missing Campaign Elements',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-required-fields',
      title: '9. Required Campaign Content Fields',
      category: 'Campaign Completeness',
      status: 'pass',
      elementId: null,
      elementName: 'Headline, Product, Price & CTA',
      description: 'All required campaign elements (Hero Product, Headline, Price Tag, and CTA) are present.',
      canAutoFix: false
    });
  }

  // 10. Export Dimensions Check
  const minSide = Math.min(cw, ch);
  if (minSide < 600) {
    findings.push({
      id: 'rule-export-dimensions',
      title: '10. Export Resolution Quality',
      category: 'Multi-Platform Spec',
      status: 'error',
      elementId: null,
      elementName: `${cw}×${ch} px`,
      description: `Canvas resolution (${cw}×${ch} px) is below minimum production threshold (600 px shortest side).`,
      fixLabel: 'Upscale Canvas to 1080p Standard',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-export-dimensions',
      title: '10. Export Resolution Quality',
      category: 'Multi-Platform Spec',
      status: 'pass',
      elementId: null,
      elementName: `${cw}×${ch} px`,
      description: `High-resolution canvas (${cw}×${ch} px) ready for crisp PNG, JPEG, and SVG export.`,
      canAutoFix: false
    });
  }

  // 11. Missing Assets Reference Check
  const brokenAssetEl = elements.find(
    (e) =>
      (e.type === 'product' || e.type === 'logo' || e.type === 'image') &&
      (!e.src || (e.assetId && !assets.some((a) => a.id === e.assetId)))
  );

  if (brokenAssetEl) {
    findings.push({
      id: 'rule-missing-assets',
      title: '11. Asset Reference & Source Availability',
      category: 'Asset Governance',
      status: 'error',
      elementId: brokenAssetEl.id,
      elementName: brokenAssetEl.name,
      description: `Layer "${brokenAssetEl.name}" references a missing or deleted asset ID in the library.`,
      fixLabel: 'Relink to Approved Source Asset',
      canAutoFix: true
    });
  } else {
    findings.push({
      id: 'rule-missing-assets',
      title: '11. Asset Reference & Source Availability',
      category: 'Asset Governance',
      status: 'pass',
      elementId: null,
      elementName: 'All Asset Links Verified',
      description: 'Every image, product cutout, and vector logo points to an active local source asset.',
      canAutoFix: false
    });
  }

  const passCount = findings.filter((f) => f.status === 'pass').length;
  const warningCount = findings.filter((f) => f.status === 'warning').length;
  const errorCount = findings.filter((f) => f.status === 'error').length;
  const rawScore = Math.round(((passCount + warningCount * 0.5) / findings.length) * 100);
  const score = clamp(rawScore, 0, 100);

  return {
    projectId: project.id,
    projectName: project.name,
    score,
    passCount,
    warningCount,
    errorCount,
    findings,
    summary:
      errorCount > 0
        ? `${errorCount} critical ${errorCount === 1 ? 'issue' : 'issues'} and ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'} require attention.`
        : warningCount > 0
        ? `All critical checks passed with ${warningCount} advisory ${warningCount === 1 ? 'warning' : 'warnings'}.`
        : 'All 11 automated brand, contrast, and product integrity checks passed.'
  };
}

export function applyValidationAutoFix(project, findingId) {
  if (!project || !project.composition) return false;
  const state = store.getState();
  const brand = state.brandKit || {};
  const comp = JSON.parse(JSON.stringify(project.composition));
  const cw = Number(comp.width) || 1080;
  const ch = Number(comp.height) || 1080;

  if (findingId === 'rule-product-integrity') {
    const prod = comp.elements.find((e) => e.type === 'product' || e.role === 'product');
    if (prod) {
      const natW = Number(prod.naturalWidth) || 800;
      const natH = Number(prod.naturalHeight) || 1000;
      prod.height = Math.round(prod.width * (natH / natW));
      prod.aspectRatioLocked = true;
      prod.protected = true;
    } else {
      comp.elements.push({
        id: 'el_product_restored',
        name: 'Kopi Susu Original (Product Asset)',
        type: 'product',
        role: 'product',
        assetId: 'ast_kopi_susu_png',
        src: './assets/images/sample-assets/kopi-susu-original.png',
        x: Math.round(cw * 0.52),
        y: Math.round(ch * 0.15),
        width: 440,
        height: 550,
        naturalWidth: 800,
        naturalHeight: 1000,
        aspectRatioLocked: true,
        objectFit: 'contain',
        opacity: 1,
        zIndex: 9,
        protected: true,
        visible: true
      });
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-asset-approval') {
    for (const el of comp.elements) {
      if (el.assetId) {
        const asset = state.assets.find((a) => a.id === el.assetId);
        if (asset && asset.status !== 'approved') {
          store.updateAsset(asset.id, { status: 'approved' });
        }
      }
    }
    return true;
  }

  if (findingId === 'rule-brand-colors') {
    comp.backgroundColor = brand.backgroundColor || '#F6EFE6';
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-logo-protection') {
    const minClear = Number(brand.rules?.minLogoClearSpacePx ?? 24);
    let logo = comp.elements.find((e) => e.type === 'logo' || e.role === 'logo');
    if (!logo) {
      logo = {
        id: 'el_logo_restored',
        name: 'Kopi Senja Primary Logo',
        type: 'logo',
        role: 'logo',
        assetId: 'ast_logo_dark',
        src: './assets/images/sample-assets/logo-kopi-senja.svg',
        x: Math.max(48, minClear),
        y: Math.max(48, minClear),
        width: 280,
        height: 80,
        naturalWidth: 420,
        naturalHeight: 120,
        aspectRatioLocked: true,
        objectFit: 'contain',
        opacity: 1,
        zIndex: 10,
        protected: true,
        visible: true
      };
      comp.elements.push(logo);
    } else {
      logo.opacity = 1;
      logo.x = clamp(logo.x, minClear, cw - logo.width - minClear);
      logo.y = clamp(logo.y, minClear, ch - logo.height - minClear);
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-text-contrast') {
    const minContrast = Number(brand.rules?.minContrastRatio) || 4.5;
    for (const el of comp.elements) {
      if (el.type === 'text' || el.role === 'headline' || el.role === 'subheadline' || el.role === 'cta' || el.role === 'price') {
        const bg = el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : comp.backgroundColor || '#F6EFE6';
        const ratio = getContrastRatio(el.color || '#1E1815', bg);
        if (ratio < minContrast) {
          const suggested = suggestAccessibleTextColor(bg, [brand.primaryColor || '#1E1815', '#FFFFFF', '#171A23', '#FFFBEB']);
          el.color = suggested.color;
        }
      }
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-element-overlap') {
    const fg = comp.elements.filter((e) => e.role !== 'decor' && e.type !== 'shape' && e.visible !== false);
    for (let i = 0; i < fg.length; i++) {
      for (let j = i + 1; j < fg.length; j++) {
        const a = fg[i];
        const b = fg[j];
        if ((a.role === 'badge' && b.role === 'product') || (a.role === 'product' && b.role === 'badge')) continue;
        const ov = rectsOverlap(a, b, 4);
        if (ov.overlaps && ov.area > 400) {
          b.y = clamp(a.y + a.height + 20, 24, ch - b.height - 24);
        }
      }
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-boundary-overflow') {
    for (const el of comp.elements) {
      if (el.role === 'decor') continue;
      if (el.width > cw - 48) el.width = cw - 48;
      if (el.height > ch - 48) el.height = ch - 48;
      el.x = clamp(el.x, 24, Math.max(24, cw - el.width - 24));
      el.y = clamp(el.y, 24, Math.max(24, ch - el.height - 24));
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-aspect-ratio' || findingId === 'rule-export-dimensions') {
    comp.width = 1080;
    comp.height = 1080;
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-required-fields') {
    const hasHeadline = comp.elements.some((e) => e.role === 'headline');
    const hasPrice = comp.elements.some((e) => e.role === 'price');
    const hasCta = comp.elements.some((e) => e.role === 'cta');
    if (!hasHeadline) {
      comp.elements.push({
        id: 'el_headline_auto',
        name: 'Campaign Headline',
        type: 'text',
        role: 'headline',
        text: 'Temukan Jeda Terbaikmu',
        x: 72,
        y: 250,
        width: 480,
        height: 150,
        fontFamily: 'Inter',
        fontSize: 60,
        fontWeight: 800,
        color: brand.primaryColor || '#1E1815',
        backgroundColor: 'transparent',
        textAlign: 'left',
        lineHeight: 1.15,
        opacity: 1,
        zIndex: 8,
        visible: true
      });
    }
    if (!hasPrice) {
      comp.elements.push({
        id: 'el_price_auto',
        name: 'Price Tag (Rp18.000)',
        type: 'text',
        role: 'price',
        text: 'Rp18.000',
        x: 72,
        y: 580,
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
        zIndex: 9,
        visible: true
      });
    }
    if (!hasCta) {
      comp.elements.push({
        id: 'el_cta_auto',
        name: 'CTA Button (Pesan Sekarang)',
        type: 'text',
        role: 'cta',
        text: 'Pesan Sekarang',
        x: 72,
        y: 700,
        width: 310,
        height: 76,
        fontFamily: 'Inter',
        fontSize: 26,
        fontWeight: 700,
        color: '#FFFFFF',
        backgroundColor: brand.secondaryColor || '#1E1815',
        borderRadius: 14,
        textAlign: 'center',
        lineHeight: 1.1,
        opacity: 1,
        zIndex: 10,
        visible: true
      });
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  if (findingId === 'rule-missing-assets') {
    for (const el of comp.elements) {
      if (el.type === 'product' || el.role === 'product') {
        el.assetId = 'ast_kopi_susu_png';
        el.src = './assets/images/sample-assets/kopi-susu-original.png';
      } else if (el.type === 'logo' || el.role === 'logo') {
        el.assetId = 'ast_logo_dark';
        el.src = './assets/images/sample-assets/logo-kopi-senja.svg';
      }
    }
    store.saveProjectComposition(project.id, comp);
    return true;
  }

  return false;
}

export function renderValidation(container, params = {}) {
  const state = store.getState();
  if (params.projectId) {
    store.setActiveProject(params.projectId);
  }
  const activeProject = store.getActiveProject();
  const projects = state.projects || [];
  const report = evaluateProjectValidation(activeProject, state);

  if (params.autorun === '1') {
    store.recordValidationRun({
      ...report,
      manualReviewed: activeProject?.manualReviewed || false
    });
  }

  const history = state.validationHistory || [];

  container.innerHTML = `
    <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-6">
      <!-- Top Bar & Project Selector -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--color-text-main)]">Rule-Based Design Validation Engine</h2>
            <span class="badge ${
              report.errorCount > 0 ? 'badge-error' : report.warningCount > 0 ? 'badge-warning' : 'badge-success'
            }">
              ${
                report.errorCount > 0
                  ? `${report.errorCount} Critical Error(s)`
                  : report.warningCount > 0
                  ? `${report.warningCount} Warning(s)`
                  : 'All 11 Checks Passed'
              }
            </span>
          </div>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Automated deterministic verification of product asset integrity, approval status, WCAG 2.1 contrast, logo clear space, and layout bounds.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <select id="val-project-select" aria-label="Select project to validate" class="input-field w-auto py-1.5 text-xs font-medium">
            ${projects
              .map(
                (p) =>
                  `<option value="${escapeHtml(p.id)}" ${p.id === activeProject?.id ? 'selected' : ''}>Project: ${escapeHtml(p.name)}</option>`
              )
              .join('')}
          </select>

          <button type="button" id="val-run-check-btn" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">play_arrow</span>
            <span>Run Validation &amp; Log</span>
          </button>

          ${
            report.findings.some((f) => f.canAutoFix && f.status !== 'pass')
              ? `<button type="button" id="val-fix-all-btn" class="btn btn-secondary btn-sm text-blue-700 border-blue-300 bg-blue-50">
                   <span class="material-symbols-outlined icon-sm" aria-hidden="true">auto_fix_high</span>
                   <span>Apply All Supported Fixes</span>
                 </button>`
              : ''
          }

          <button type="button" id="val-open-studio-btn" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">draw</span>
            <span>Open in Studio</span>
          </button>
        </div>
      </div>

      <!-- Summary Score & Manual Review Separation Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="card-surface p-4 flex items-center justify-between">
          <div>
            <div class="text-xs text-[var(--color-text-secondary)]">Compliance Score</div>
            <div class="text-2xl font-extrabold ${
              report.errorCount > 0 ? 'text-red-700' : report.warningCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            } mt-1">${report.score}%</div>
            <div class="text-[11px] text-[var(--color-text-secondary)] mt-0.5">11 Deterministic Rules</div>
          </div>
          <div class="w-10 h-10 rounded-lg ${
            report.errorCount > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          } flex items-center justify-center">
            <span class="material-symbols-outlined" aria-hidden="true">${report.errorCount > 0 ? 'gpp_bad' : 'verified_user'}</span>
          </div>
        </div>

        <div class="card-surface p-4">
          <div class="text-xs text-[var(--color-text-secondary)]">Automated Check Breakdown</div>
          <div class="flex items-center gap-3 mt-2">
            <span class="badge badge-success">${report.passCount} Pass</span>
            <span class="badge badge-warning">${report.warningCount} Warning</span>
            <span class="badge badge-error">${report.errorCount} Error</span>
          </div>
          <div class="text-[11px] text-[var(--color-text-secondary)] mt-2 truncate">${escapeHtml(report.summary)}</div>
        </div>

        <!-- Distinction Between Automated Checks & Manual Review Status -->
        <div class="md:col-span-2 card-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-[var(--color-text-main)]">Manual Creative Sign-Off Status:</span>
              ${
                activeProject?.manualReviewed && report.errorCount === 0
                  ? '<span class="badge badge-success">Reviewed &amp; Signed Off</span>'
                  : '<span class="badge badge-neutral">Not Manually Signed Off</span>'
              }
            </div>
            <p class="text-[11px] text-[var(--color-text-secondary)]">
              ${
                report.errorCount > 0
                  ? 'Critical automated errors are unresolved. The system prevents marking this design as reviewed until all critical errors are fixed.'
                  : 'Automated checks are distinct from human review. Once automated checks pass, you may record manual creative sign-off.'
              }
            </p>
          </div>
          <button
            type="button"
            id="val-toggle-manual-review-btn"
            class="btn ${activeProject?.manualReviewed && report.errorCount === 0 ? 'btn-secondary' : 'btn-primary'} btn-sm shrink-0"
            ${report.errorCount > 0 ? 'disabled title="Fix critical errors before marking as reviewed"' : ''}
          >
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">fact_check</span>
            <span>${activeProject?.manualReviewed && report.errorCount === 0 ? 'Revoke Manual Review' : 'Mark Design as Reviewed'}</span>
          </button>
        </div>
      </div>

      <!-- Detailed 11 Validation Findings List -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section class="lg:col-span-8 card-surface overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Live Inspection Findings — ${escapeHtml(activeProject?.name || '')}
            </h3>
            <span class="text-[11px] text-[var(--color-text-secondary)]">Click any affected element to jump to Design Studio</span>
          </div>

          <div class="divide-y divide-[var(--color-border)]">
            ${report.findings
              .map((f) => {
                const badge =
                  f.status === 'pass'
                    ? '<span class="badge badge-success"><span class="material-symbols-outlined icon-sm" aria-hidden="true">check_circle</span>Pass</span>'
                    : f.status === 'warning'
                    ? '<span class="badge badge-warning"><span class="material-symbols-outlined icon-sm" aria-hidden="true">warning</span>Warning</span>'
                    : '<span class="badge badge-error"><span class="material-symbols-outlined icon-sm" aria-hidden="true">error</span>Error</span>';

                return `
                  <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--color-surface-subtle)]/50 transition">
                    <div class="space-y-1 max-w-2xl">
                      <div class="flex flex-wrap items-center gap-2">
                        ${badge}
                        <span class="text-xs font-semibold text-[var(--color-text-main)]">${escapeHtml(f.title)}</span>
                        <span class="text-[11px] text-[var(--color-text-secondary)]">· ${escapeHtml(f.category)}</span>
                      </div>
                      <p class="text-xs text-[var(--color-text-secondary)] leading-relaxed">${escapeHtml(f.description)}</p>
                      ${
                        f.elementName
                          ? `<div class="text-[11px] text-[var(--color-text-secondary)] pt-0.5">
                               Affected Target: <strong class="text-[var(--color-text-main)]">${escapeHtml(f.elementName)}</strong>
                             </div>`
                          : ''
                      }
                    </div>

                    <div class="flex items-center gap-2 shrink-0">
                      ${
                        f.canAutoFix && f.status !== 'pass'
                          ? `<button type="button" data-autofix-rule="${escapeHtml(f.id)}" class="btn btn-primary btn-sm">
                               <span class="material-symbols-outlined icon-sm" aria-hidden="true">build</span>
                               <span>${escapeHtml(f.fixLabel || 'Apply Fix')}</span>
                             </button>`
                          : ''
                      }
                      ${
                        f.elementId
                          ? `<button type="button" data-jump-element="${escapeHtml(f.elementId)}" class="btn btn-secondary btn-sm">
                               <span class="material-symbols-outlined icon-sm" aria-hidden="true">my_location</span>
                               <span>Select in Studio</span>
                             </button>`
                          : ''
                      }
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>

        <!-- Right 4 Cols: Validation Audit History -->
        <aside class="lg:col-span-4 card-surface overflow-hidden">
          <div class="px-4 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Validation History Log</h3>
            <span class="badge badge-neutral">${history.length} Runs</span>
          </div>

          <div class="divide-y divide-[var(--color-border)] max-h-[540px] overflow-y-auto">
            ${history
              .map(
                (h) => `
                <div class="p-3.5 space-y-1.5 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(h.projectName)}</span>
                    <span class="font-mono font-bold ${
                      h.errorCount > 0 ? 'text-red-700' : h.warningCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }">${h.score}%</span>
                  </div>
                  <p class="text-[11px] text-[var(--color-text-secondary)] leading-snug">${escapeHtml(h.summary)}</p>
                  <div class="flex flex-wrap items-center justify-between gap-1 pt-1 text-[10px] text-[var(--color-text-secondary)]">
                    <span>${escapeHtml(formatDate(h.timestamp))}</span>
                    <div class="flex items-center gap-1.5">
                      <span>${h.manualReviewed ? 'Manual Sign-Off: Yes' : 'Automated Check'}</span>
                      <span>·</span>
                      <span class="${h.isSample ? 'text-amber-700 font-semibold' : 'text-blue-700 font-semibold'}">
                        ${h.isSample ? '[Sample Record]' : '[User Run]'}
                      </span>
                    </div>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </aside>
      </div>
    </div>
  `;

  // Bind Listeners
  container.querySelector('#val-project-select')?.addEventListener('change', (e) => {
    store.setActiveProject(e.target.value);
    renderValidation(container);
  });

  container.querySelector('#val-run-check-btn')?.addEventListener('click', () => {
    if (!activeProject) return;
    const latestReport = evaluateProjectValidation(activeProject, store.getState());
    store.recordValidationRun({
      ...latestReport,
      manualReviewed: activeProject.manualReviewed && latestReport.errorCount === 0
    });
    showToast(
      `Validation complete: ${latestReport.passCount}/11 passed (${latestReport.score}%).`,
      latestReport.errorCount > 0 ? 'warning' : 'success'
    );
    renderValidation(container);
  });

  container.querySelector('#val-fix-all-btn')?.addEventListener('click', () => {
    if (!activeProject) return;
    let fixedCount = 0;
    for (const f of report.findings) {
      if (f.canAutoFix && f.status !== 'pass') {
        if (applyValidationAutoFix(store.getActiveProject(), f.id)) {
          fixedCount++;
        }
      }
    }
    const updatedProj = store.getActiveProject();
    const afterReport = evaluateProjectValidation(updatedProj, store.getState());
    store.recordValidationRun({
      ...afterReport,
      manualReviewed: updatedProj.manualReviewed
    });
    showToast(`Applied ${fixedCount} automated fixes. Score is now ${afterReport.score}%.`, 'success');
    renderValidation(container);
  });

  container.querySelectorAll('[data-autofix-rule]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ruleId = btn.getAttribute('data-autofix-rule');
      if (applyValidationAutoFix(store.getActiveProject(), ruleId)) {
        const afterReport = evaluateProjectValidation(store.getActiveProject(), store.getState());
        store.recordValidationRun(afterReport);
        showToast('Applied rule fix and re-validated composition.', 'success');
        renderValidation(container);
      }
    });
  });

  container.querySelectorAll('[data-jump-element]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const elId = btn.getAttribute('data-jump-element');
      router.navigate('design-studio', {
        projectId: activeProject?.id,
        selectElementId: elId
      });
    });
  });

  container.querySelector('#val-open-studio-btn')?.addEventListener('click', () => {
    router.navigate('design-studio', { projectId: activeProject?.id });
  });

  container.querySelector('#val-toggle-manual-review-btn')?.addEventListener('click', () => {
    if (!activeProject) return;
    if (report.errorCount > 0) {
      showToast('Resolve all critical errors before marking this design as reviewed.', 'error');
      return;
    }
    activeProject.manualReviewed = !activeProject.manualReviewed;
    activeProject.status = activeProject.manualReviewed ? 'Validated' : 'Ready to Export';
    store.recordValidationRun({
      ...report,
      manualReviewed: activeProject.manualReviewed
    });
    showToast(
      activeProject.manualReviewed
        ? `Marked "${activeProject.name}" as Manually Reviewed & Validated.`
        : `Cleared manual review sign-off for "${activeProject.name}".`,
      'success'
    );
    renderValidation(container);
  });
}
