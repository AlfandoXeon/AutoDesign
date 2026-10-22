/**
 * AutoDesign — Design Studio (Core Visual Composition Editor & Rule-Based AI Design Assistant)
 * Supports pointer drag, 8-handle resize (with strict aspect-ratio lock for protected product assets),
 * inline/panel text editing, layer ordering, alignment, snap-to-grid, undo/redo, zoom/fit, and deterministic AI recommendations.
 */

import { store } from './store.js';
import { router } from './router.js';
import { evaluateProjectValidation } from './validation.js';
import { adaptCompositionToDimensions, renderCompositionToBlob } from './export.js';
import {
  escapeHtml,
  clamp,
  uid,
  getContrastRatio,
  suggestAccessibleTextColor,
  rectsOverlap,
  renderMiniComposition,
  openCustomModal,
  closeCustomModal,
  downloadBlob,
  showToast,
  showConfirmModal
} from './utils.js';

const studioState = {
  projectId: null,
  composition: null,
  selectedElementId: null,
  leftTab: 'layers', // 'assets' | 'layers' | 'templates'
  rightTab: 'properties', // 'properties' | 'assistant' | 'snapshots'
  assetFilter: 'all',
  zoom: 0.52,
  autoFit: true,
  undoStack: [],
  redoStack: [],
  dismissedRecIds: new Set(),
  mobileLeftOpen: false,
  mobileRightOpen: false,
  guideXVisible: false,
  guideYVisible: false
};

let activePointerCleanup = null;
let keydownCleanup = null;

function cloneComp(comp) {
  return JSON.parse(JSON.stringify(comp));
}

function pushUndoSnapshot() {
  if (!studioState.composition) return;
  studioState.undoStack.push(cloneComp(studioState.composition));
  if (studioState.undoStack.length > 40) {
    studioState.undoStack.shift();
  }
  studioState.redoStack = [];
}

function commitCompositionChange(options = {}) {
  const proj = store.getActiveProject();
  if (!proj || !studioState.composition) return;
  store.saveProjectComposition(proj.id, studioState.composition, options);
}

function computeFitZoom(viewportEl, cw, ch) {
  if (!viewportEl) return 0.5;
  const rect = viewportEl.getBoundingClientRect();
  const availW = Math.max(260, rect.width - 72);
  const availH = Math.max(260, rect.height - 72);
  const scale = Math.min(availW / cw, availH / ch);
  return Number(clamp(scale, 0.22, 1.15).toFixed(2));
}

/* ==========================================================================
   Deterministic Rule-Based AI Design Assistant Engine (Section 10)
   ========================================================================== */

function generateAssistantRecommendations(composition, brandKit) {
  const recs = [];
  const cw = Number(composition.width) || 1080;
  const ch = Number(composition.height) || 1080;
  const els = (composition.elements || []).filter((e) => e.visible !== false);

  const headline = els.find((e) => e.role === 'headline' || (e.type === 'text' && (e.fontSize || 0) >= 44));
  const subheadline = els.find((e) => e.role === 'subheadline');
  const product = els.find((e) => e.type === 'product' || e.role === 'product');
  const price = els.find((e) => e.role === 'price');
  const cta = els.find((e) => e.role === 'cta');
  const logo = els.find((e) => e.type === 'logo' || e.role === 'logo');

  // 1. Visual Hierarchy Check (Headline vs Subheadline/CTA ratio)
  if (headline) {
    const subSize = Number(subheadline?.fontSize) || 22;
    if ((Number(headline.fontSize) || 48) < subSize * 2.4) {
      recs.push({
        id: 'rec-hierarchy-scale',
        category: 'Visual Hierarchy',
        title: 'Increase Headline Prominence',
        description: `Headline "${headline.name}" (${headline.fontSize}px) is below the 2.6× editorial hierarchy ratio relative to body copy (${subSize}px).`,
        elementId: headline.id,
        elementName: headline.name,
        actionLabel: 'Scale Headline to 68px Bold',
        applyFn: (comp) => {
          const h = comp.elements.find((e) => e.id === headline.id);
          if (h) {
            h.fontSize = 68;
            h.fontWeight = 800;
            h.lineHeight = 1.1;
          }
        }
      });
    }
  }

  // 2. Contrast Improvement Check
  const textLayers = els.filter((e) => e.type === 'text' || ['headline', 'subheadline', 'price', 'cta'].includes(e.role));
  for (const tl of textLayers) {
    const bg = tl.backgroundColor && tl.backgroundColor !== 'transparent' ? tl.backgroundColor : composition.backgroundColor || '#F6EFE6';
    const ratio = getContrastRatio(tl.color || '#1E1815', bg);
    if (ratio < 4.8) {
      const best = suggestAccessibleTextColor(bg, [brandKit.primaryColor || '#1E1815', '#FFFFFF', '#171A23']);
      recs.push({
        id: `rec-contrast-${tl.id}`,
        category: 'Contrast & Readability',
        title: `Boost Text Contrast on "${tl.name}"`,
        description: `Current contrast ratio is ${ratio}:1 against ${bg}. Adjusting to ${best.color} increases readability to ${best.ratio}:1.`,
        elementId: tl.id,
        elementName: tl.name,
        actionLabel: `Apply High-Contrast (${best.color})`,
        applyFn: (comp) => {
          const target = comp.elements.find((e) => e.id === tl.id);
          if (target) target.color = best.color;
        }
      });
    }
  }

  // 3. Overlap Detection & Resolution
  const fg = els.filter((e) => e.role !== 'decor' && e.type !== 'shape');
  for (let i = 0; i < fg.length; i++) {
    for (let j = i + 1; j < fg.length; j++) {
      const a = fg[i];
      const b = fg[j];
      if ((a.role === 'badge' && b.role === 'product') || (a.role === 'product' && b.role === 'badge')) continue;
      const ov = rectsOverlap(a, b, 4);
      if (ov.overlaps && ov.area > 300) {
        recs.push({
          id: `rec-overlap-${a.id}-${b.id}`,
          category: 'Collision Avoidance',
          title: 'Resolve Element Overlap',
          description: `"${a.name}" and "${b.name}" intersect by ${Math.round(ov.area)} px². Repositioning restores clean reading flow.`,
          elementId: b.id,
          elementName: `${a.name} & ${b.name}`,
          actionLabel: 'Separate Overlapping Layers',
          applyFn: (comp) => {
            const tb = comp.elements.find((e) => e.id === b.id);
            const ta = comp.elements.find((e) => e.id === a.id);
            if (ta && tb) {
              tb.y = clamp(ta.y + ta.height + 24, 32, ch - tb.height - 32);
            }
          }
        });
        break;
      }
    }
  }

  // 4. Left Margin Alignment & 8px Grid Rhythm
  const leftCopyEls = [logo, headline, subheadline, price, cta].filter(Boolean);
  const misalignedLeft = leftCopyEls.some((e) => e.x % 8 !== 0 || e.y % 8 !== 0);
  if (misalignedLeft) {
    recs.push({
      id: 'rec-grid-snap-rhythm',
      category: 'Alignment & Spacing',
      title: 'Snap All Layers to 8px Swiss Grid Rhythm',
      description: 'Some elements sit on fractional or off-grid coordinates. Snapping coordinates to multiples of 8px sharpens visual alignment.',
      elementId: headline?.id || null,
      elementName: 'Typography & Action Stack',
      actionLabel: 'Snap Stack to 8px Grid',
      applyFn: (comp) => {
        for (const el of comp.elements) {
          el.x = Math.round(el.x / 8) * 8;
          el.y = Math.round(el.y / 8) * 8;
        }
      }
    });
  }

  // 5. Apply Brand Kit Accent & CTA Styling
  if (cta && brandKit.secondaryColor && cta.backgroundColor?.toUpperCase() !== brandKit.secondaryColor.toUpperCase()) {
    recs.push({
      id: 'rec-brand-cta-color',
      category: 'Brand Compliance',
      title: 'Apply Brand Kit Secondary Accent to CTA',
      description: `Highlight "${cta.name}" using official Senja Amber (${brandKit.secondaryColor}) to draw stronger conversion focus.`,
      elementId: cta.id,
      elementName: cta.name,
      actionLabel: `Apply ${brandKit.secondaryColor} Fill`,
      applyFn: (comp) => {
        const c = comp.elements.find((e) => e.id === cta.id);
        if (c) {
          c.backgroundColor = brandKit.secondaryColor;
          c.color = '#FFFFFF';
        }
      }
    });
  }

  // 6. Alternative Balanced Composition: Centered Hero Layout (Preserving Product Integrity)
  recs.push({
    id: 'rec-layout-centered-hero',
    category: 'Layout Recommendation',
    title: 'Arrange as Centered Pedestal Hero',
    description: 'Re-arrange existing approved assets into a symmetrical centered composition while keeping the original product image untouched.',
    elementId: product?.id || null,
    elementName: 'Full Canvas Composition',
    actionLabel: 'Apply Centered Layout',
    applyFn: (comp) => {
      const w = Number(comp.width) || 1080;
      const h = Number(comp.height) || 1080;
      const findRole = (r) => comp.elements.find((e) => e.role === r);
      const l = findRole('logo');
      const eb = comp.elements.find((e) => e.role === 'badge' && e.type === 'text');
      const hd = findRole('headline');
      const sb = findRole('subheadline');
      const pr = findRole('product');
      const pc = findRole('price');
      const ct = findRole('cta');
      const halo = comp.elements.find((e) => e.type === 'shape' && e.shapeType === 'circle');

      if (l) {
        l.x = Math.round((w - l.width) / 2);
        l.y = 48;
      }
      if (eb) {
        eb.x = Math.round((w - eb.width) / 2);
        eb.y = 144;
      }
      if (hd) {
        hd.width = Math.round(w * 0.8);
        hd.x = Math.round((w - hd.width) / 2);
        hd.y = 196;
        hd.height = 96;
        hd.fontSize = 56;
        hd.text = hd.text.replace(/\n+/g, ' ');
        hd.textAlign = 'center';
      }
      if (sb) {
        sb.width = Math.round(w * 0.72);
        sb.x = Math.round((w - sb.width) / 2);
        sb.y = 296;
        sb.height = 64;
        sb.textAlign = 'center';
      }
      if (halo) {
        halo.width = 440;
        halo.height = 440;
        halo.x = Math.round((w - 440) / 2);
        halo.y = 376;
      }
      if (pr) {
        const natRatio = (Number(pr.naturalWidth) || 800) / (Number(pr.naturalHeight) || 1000);
        pr.height = 460;
        pr.width = Math.round(460 * natRatio);
        pr.x = Math.round((w - pr.width) / 2);
        pr.y = 360;
      }
      if (pc && ct) {
        const totalW = pc.width + 24 + ct.width;
        const startX = Math.round((w - totalW) / 2);
        pc.x = startX;
        pc.y = h - 220;
        ct.x = startX + pc.width + 24;
        ct.y = h - 220;
        ct.height = pc.height;
      }
    }
  });

  // 7. Alternative Balanced Composition: Editorial Split Layout
  recs.push({
    id: 'rec-layout-editorial-split',
    category: 'Layout Recommendation',
    title: 'Arrange as Left-Right Editorial Split',
    description: 'Restore crisp left-aligned typographic column and right-hand hero product staging on an 8px grid.',
    elementId: headline?.id || null,
    elementName: 'Full Canvas Composition',
    actionLabel: 'Apply Editorial Split',
    applyFn: (comp) => {
      const findRole = (r) => comp.elements.find((e) => e.role === r);
      const l = findRole('logo');
      const eb = comp.elements.find((e) => e.role === 'badge' && e.type === 'text');
      const hd = findRole('headline');
      const sb = findRole('subheadline');
      const pr = findRole('product');
      const pc = findRole('price');
      const ct = findRole('cta');
      const halo = comp.elements.find((e) => e.type === 'shape' && e.shapeType === 'circle');

      if (l) { l.x = 72; l.y = 68; }
      if (eb) { eb.x = 72; eb.y = 192; }
      if (hd) {
        hd.x = 72;
        hd.y = 256;
        hd.width = 480;
        hd.height = 176;
        hd.fontSize = 64;
        hd.textAlign = 'left';
      }
      if (sb) {
        sb.x = 72;
        sb.y = 448;
        sb.width = 448;
        sb.height = 104;
        sb.textAlign = 'left';
      }
      if (pc) { pc.x = 72; pc.y = 584; }
      if (ct) { ct.x = 72; ct.y = 704; }
      if (halo) { halo.x = 520; halo.y = 170; halo.width = 490; halo.height = 490; }
      if (pr) {
        const natRatio = (Number(pr.naturalWidth) || 800) / (Number(pr.naturalHeight) || 1000);
        pr.height = 560;
        pr.width = Math.round(560 * natRatio);
        pr.x = 560;
        pr.y = 152;
      }
    }
  });

  // 8. Multi-Platform Adaptation Recommendation
  if (cw === 1080 && ch === 1080) {
    recs.push({
      id: 'rec-adapt-portrait',
      category: 'Platform Adaptation',
      title: 'Adapt Canvas to Instagram 4:5 Portrait (1080×1350)',
      description: 'Automatically reflow all layers for higher vertical feed real estate while locking product proportions.',
      elementId: null,
      elementName: 'Canvas Aspect Ratio',
      actionLabel: 'Adapt to 1080×1350',
      applyFn: (comp) => {
        const adapted = adaptCompositionToDimensions(comp, 1080, 1350);
        comp.width = adapted.width;
        comp.height = adapted.height;
        comp.elements = adapted.elements;
      }
    });
  } else {
    recs.push({
      id: 'rec-adapt-square',
      category: 'Platform Adaptation',
      title: 'Adapt Canvas to Instagram 1:1 Square (1080×1080)',
      description: 'Reflow composition to standard 1080×1080 square format with locked product aspect ratio.',
      elementId: null,
      elementName: 'Canvas Aspect Ratio',
      actionLabel: 'Adapt to 1080×1080',
      applyFn: (comp) => {
        const adapted = adaptCompositionToDimensions(comp, 1080, 1080);
        comp.width = adapted.width;
        comp.height = adapted.height;
        comp.elements = adapted.elements;
      }
    });
  }

  return recs.filter((r) => !studioState.dismissedRecIds.has(r.id));
}

/* ==========================================================================
   Main Design Studio Render & Interactive Controller
   ========================================================================== */

export function renderDesignStudio(container, params = {}) {
  const state = store.getState();
  if (params.projectId) {
    store.setActiveProject(params.projectId);
  }

  const activeProject = store.getActiveProject();
  if (!activeProject) {
    container.innerHTML = `<div class="p-10 text-center text-sm">No project available.</div>`;
    return;
  }

  // Initialize or switch project composition in studioState
  if (studioState.projectId !== activeProject.id || !studioState.composition) {
    studioState.projectId = activeProject.id;
    studioState.composition = cloneComp(activeProject.composition);
    studioState.undoStack = [];
    studioState.redoStack = [];
    studioState.selectedElementId =
      params.selectElementId ||
      studioState.composition.elements.find((e) => e.type === 'product')?.id ||
      studioState.composition.elements[0]?.id ||
      null;
  } else {
    // Keep synced with external updates (e.g. from Validation auto-fix or Asset Library insert)
    studioState.composition = cloneComp(activeProject.composition);
    if (params.selectElementId) {
      studioState.selectedElementId = params.selectElementId;
    }
  }

  const paintStudio = () => {
    const comp = studioState.composition;
    const cw = Number(comp.width) || 1080;
    const ch = Number(comp.height) || 1080;
    const settings = store.getState().settings || {};
    const brand = store.getState().brandKit || {};
    const assets = store.getState().assets || [];
    const templates = store.getState().templates || [];
    const projects = store.getState().projects || [];

    const selectedEl = comp.elements.find((e) => e.id === studioState.selectedElementId) || null;
    const isProtectedProduct = Boolean(
      selectedEl && (selectedEl.protected || selectedEl.type === 'product' || selectedEl.type === 'logo')
    );

    const valReport = evaluateProjectValidation({ ...activeProject, composition: comp }, store.getState());
    const recommendations = generateAssistantRecommendations(comp, brand);

    const zoom = studioState.zoom;
    const stageW = Math.round(cw * zoom);
    const stageH = Math.round(ch * zoom);

    const sortedLayersTopDown = [...comp.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
    const sortedLayersBottomUp = [...comp.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    container.innerHTML = `
      <div class="studio-shell">
        <!-- Top Studio Toolbar -->
        <div class="studio-toolbar">
          <!-- Left: Project Selector & Mobile Panel Toggles -->
          <div class="flex items-center gap-2 min-w-0">
            <button type="button" id="studio-mobile-left-btn" class="btn btn-secondary btn-sm lg:hidden" title="Toggle Assets & Layers Panel">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">layers</span>
              <span class="hidden sm:inline">Layers</span>
            </button>

            <select id="studio-project-switcher" aria-label="Switch active project" class="input-field py-1 px-2.5 text-xs font-semibold max-w-[240px]">
              ${projects
                .map(
                  (p) =>
                    `<option value="${escapeHtml(p.id)}" ${p.id === activeProject.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
                )
                .join('')}
            </select>

            <button type="button" id="studio-rename-proj-btn" class="btn btn-ghost btn-icon" title="Rename Project" aria-label="Rename Project">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
            </button>
          </div>

          <!-- Center: Undo/Redo, Canvas Preset, Grid & Snap Controls -->
          <div class="hidden md:flex items-center gap-1.5">
            <button type="button" id="studio-undo-btn" class="btn btn-secondary btn-sm" ${studioState.undoStack.length === 0 ? 'disabled' : ''} title="Undo (Ctrl+Z)">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">undo</span>
              <span>Undo</span>
            </button>
            <button type="button" id="studio-redo-btn" class="btn btn-secondary btn-sm" ${studioState.redoStack.length === 0 ? 'disabled' : ''} title="Redo (Ctrl+Y)">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">redo</span>
              <span>Redo</span>
            </button>

            <div class="h-4 w-[1px] bg-[var(--color-border)] mx-1"></div>

            <select id="studio-dimension-preset" aria-label="Canvas aspect ratio dimensions" class="input-field w-auto py-1 px-2 text-xs font-mono">
              <option value="1080x1080" ${cw === 1080 && ch === 1080 ? 'selected' : ''}>1080×1080 (1:1 Square)</option>
              <option value="1080x1350" ${cw === 1080 && ch === 1350 ? 'selected' : ''}>1080×1350 (4:5 Portrait)</option>
              <option value="1080x1920" ${cw === 1080 && ch === 1920 ? 'selected' : ''}>1080×1920 (9:16 Story)</option>
              <option value="1920x1080" ${cw === 1920 && ch === 1080 ? 'selected' : ''}>1920×1080 (16:9 Banner)</option>
            </select>

            <button
              type="button"
              id="studio-grid-toggle-btn"
              class="btn btn-sm ${settings.showCanvasGrid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'btn-secondary'}"
              title="Toggle Canvas Grid Overlay"
            >
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">grid_on</span>
              <span class="hidden xl:inline">Grid</span>
            </button>

            <button
              type="button"
              id="studio-snap-toggle-btn"
              class="btn btn-sm ${settings.snapToGrid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'btn-secondary'}"
              title="Toggle Snap to Grid (${settings.canvasGridSize || 16}px)"
            >
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">attractions</span>
              <span class="hidden xl:inline">Snap</span>
            </button>
          </div>

          <!-- Right: Save Snapshot, QA Status, Preview & Export -->
          <div class="flex items-center gap-1.5">
            <button type="button" id="studio-save-snapshot-btn" class="btn btn-secondary btn-sm hidden sm:inline-flex" title="Save local version snapshot">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">history</span>
              <span class="hidden xl:inline">Snapshot</span>
            </button>

            <button
              type="button"
              id="studio-qa-badge-btn"
              class="btn btn-sm ${
                valReport.errorCount > 0
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : valReport.warningCount > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }"
              title="Click to inspect validation report"
            >
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">${valReport.errorCount > 0 ? 'error' : 'verified'}</span>
              <span class="hidden sm:inline">${valReport.score}% QA</span>
            </button>

            <button type="button" id="studio-preview-btn" class="btn btn-secondary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">visibility</span>
              <span class="hidden sm:inline">Preview</span>
            </button>

            <button type="button" id="studio-export-btn" class="btn btn-primary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">ios_share</span>
              <span>Export</span>
            </button>

            <button type="button" id="studio-mobile-right-btn" class="btn btn-secondary btn-sm lg:hidden" title="Toggle Properties & AI Assistant">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">tune</span>
            </button>
          </div>
        </div>

        <!-- 3-Panel Studio Body -->
        <div class="studio-body">
          <!-- LEFT PANEL: Quick Add + Assets | Layers | Templates -->
          <aside class="studio-left-panel ${studioState.mobileLeftOpen ? 'mobile-panel-open' : ''}" aria-label="Studio Assets, Layers, and Templates">
            <!-- Quick Add Element Toolbar -->
            <div class="p-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
              <div class="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 px-0.5">Add Composition Element</div>
              <div class="grid grid-cols-4 gap-1.5">
                <button type="button" data-add-element="text" class="btn btn-secondary btn-sm flex-col py-1.5 px-1 gap-0.5 text-[11px]">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">title</span>
                  <span>Text</span>
                </button>
                <button type="button" data-add-element="cta" class="btn btn-secondary btn-sm flex-col py-1.5 px-1 gap-0.5 text-[11px]">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">smart_button</span>
                  <span>CTA</span>
                </button>
                <button type="button" data-add-element="rect" class="btn btn-secondary btn-sm flex-col py-1.5 px-1 gap-0.5 text-[11px]">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">rectangle</span>
                  <span>Box</span>
                </button>
                <button type="button" data-add-element="circle" class="btn btn-secondary btn-sm flex-col py-1.5 px-1 gap-0.5 text-[11px]">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">circle</span>
                  <span>Circle</span>
                </button>
              </div>
            </div>

            <!-- Left Panel Tab Switcher -->
            <div class="grid grid-cols-3 border-b border-[var(--color-border)] text-xs font-semibold bg-[var(--color-surface)]">
              <button
                type="button"
                data-left-tab="layers"
                class="py-2.5 border-b-2 transition ${
                  studioState.leftTab === 'layers'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                Layers (${comp.elements.length})
              </button>
              <button
                type="button"
                data-left-tab="assets"
                class="py-2.5 border-b-2 transition ${
                  studioState.leftTab === 'assets'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                Assets (${assets.length})
              </button>
              <button
                type="button"
                data-left-tab="templates"
                class="py-2.5 border-b-2 transition ${
                  studioState.leftTab === 'templates'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                Templates
              </button>
            </div>

            <!-- Left Panel Content Body -->
            <div class="flex-1 overflow-y-auto p-2.5 space-y-2">
              ${
                studioState.leftTab === 'layers'
                  ? sortedLayersTopDown
                      .map((layer) => {
                        const isSel = layer.id === studioState.selectedElementId;
                        const icon =
                          layer.type === 'product'
                            ? 'inventory_2'
                            : layer.type === 'logo'
                            ? 'verified'
                            : layer.type === 'image'
                            ? 'image'
                            : layer.type === 'shape'
                            ? 'shapes'
                            : 'text_fields';

                        return `
                          <div
                            data-layer-select="${escapeHtml(layer.id)}"
                            class="p-2 rounded-md border text-xs flex items-center justify-between gap-1.5 cursor-pointer transition ${
                              isSel
                                ? 'border-[#2563EB] bg-blue-50/70 font-semibold'
                                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)]'
                            }"
                          >
                            <div class="flex items-center gap-2 min-w-0 flex-1">
                              <span class="material-symbols-outlined icon-sm ${layer.protected ? 'text-amber-700' : 'text-[var(--color-text-secondary)]'}" aria-hidden="true">${icon}</span>
                              <div class="min-w-0 flex-1">
                                <div class="truncate text-[var(--color-text-main)]">${escapeHtml(layer.name)}</div>
                                <div class="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1">
                                  <span>${escapeHtml(layer.type)}</span>
                                  ${layer.protected ? '· <span class="text-amber-700 font-semibold">Protected Source</span>' : ''}
                                </div>
                              </div>
                            </div>

                            <!-- Accessible Single-Pointer Layer Reorder & Lock Controls -->
                            <div class="flex items-center gap-0.5 shrink-0" onclick="event.stopPropagation()">
                              <button type="button" data-layer-up="${escapeHtml(layer.id)}" class="p-1 rounded hover:bg-slate-200/70 text-[var(--color-text-secondary)]" title="Move layer up" aria-label="Move layer up">
                                <span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">keyboard_arrow_up</span>
                              </button>
                              <button type="button" data-layer-down="${escapeHtml(layer.id)}" class="p-1 rounded hover:bg-slate-200/70 text-[var(--color-text-secondary)]" title="Move layer down" aria-label="Move layer down">
                                <span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">keyboard_arrow_down</span>
                              </button>
                              <button type="button" data-layer-lock="${escapeHtml(layer.id)}" class="p-1 rounded hover:bg-slate-200/70 ${layer.locked ? 'text-amber-700' : 'text-[var(--color-text-secondary)]'}" title="${layer.locked ? 'Unlock position' : 'Lock position'}" aria-label="Toggle layer lock">
                                <span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">${layer.locked ? 'lock' : 'lock_open'}</span>
                              </button>
                              <button type="button" data-layer-vis="${escapeHtml(layer.id)}" class="p-1 rounded hover:bg-slate-200/70 text-[var(--color-text-secondary)]" title="Toggle visibility" aria-label="Toggle layer visibility">
                                <span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">${layer.visible === false ? 'visibility_off' : 'visibility'}</span>
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
                  : studioState.leftTab === 'assets'
                  ? `
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-1 text-[11px]">
                        <span class="text-[var(--color-text-secondary)]">Click an asset to place on canvas:</span>
                        <button type="button" id="studio-go-asset-lib-btn" class="text-blue-600 font-medium hover:underline">Manage</button>
                      </div>
                      <div class="grid grid-cols-2 gap-2">
                        ${assets
                          .filter((a) => ['Product Photos', 'Transparent PNGs', 'Logos', 'Icons', 'Backgrounds', '3D Models'].includes(a.category))
                          .map(
                            (a) => `
                            <button
                              type="button"
                              data-insert-asset="${escapeHtml(a.id)}"
                              class="p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-blue-500 text-left flex flex-col gap-1.5 transition cursor-pointer"
                            >
                              <div class="h-20 rounded bg-slate-100 flex items-center justify-center p-1.5 relative">
                                <img src="${escapeHtml(a.src)}" alt="${escapeHtml(a.name)}" class="max-h-full max-w-full object-contain" />
                                ${
                                  a.status === 'approved'
                                    ? '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-600" title="Approved"></span>'
                                    : '<span class="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" title="Pending"></span>'
                                }
                              </div>
                              <div class="text-[11px] font-medium text-[var(--color-text-main)] truncate w-full">${escapeHtml(a.name)}</div>
                            </button>
                          `
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                  : `
                    <div class="space-y-2.5">
                      <button type="button" id="studio-save-as-tpl-btn" class="btn btn-secondary btn-sm w-full">
                        <span class="material-symbols-outlined icon-sm" aria-hidden="true">bookmark_add</span>
                        <span>Save Current Canvas as Template</span>
                      </button>
                      ${templates
                        .map(
                          (tpl) => `
                          <div class="p-2.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
                            <div class="h-28 rounded border border-[var(--color-border)] overflow-hidden">
                              ${renderMiniComposition(tpl.composition, { maxWidth: 210, maxHeight: 105 })}
                            </div>
                            <div class="flex items-center justify-between gap-2">
                              <div class="min-w-0">
                                <div class="text-xs font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(tpl.name)}</div>
                                <div class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(tpl.category)} · ${tpl.width}×${tpl.height}</div>
                              </div>
                              <button type="button" data-studio-load-tpl="${escapeHtml(tpl.id)}" class="btn btn-secondary btn-sm shrink-0">Load</button>
                            </div>
                          </div>
                        `
                        )
                        .join('')}
                    </div>
                  `
              }
            </div>
          </aside>

          <!-- CENTER PANEL: Interactive DOM Canvas Viewport & Bottom Zoom Bar -->
          <div class="flex-1 flex flex-col min-w-0 relative overflow-hidden">
            <div class="studio-canvas-viewport" id="studio-canvas-viewport">
              <div
                class="canvas-stage-wrapper"
                style="width:${stageW}px; height:${stageH}px;"
              >
                <div
                  id="studio-design-canvas"
                  class="design-canvas ${settings.showCanvasGrid ? 'show-grid' : ''} ${settings.showSafeAreaGuides ? 'show-safe-area' : ''}"
                  style="width:${cw}px; height:${ch}px; background-color:${escapeHtml(comp.backgroundColor || '#F6EFE6')}; transform:scale(${zoom}); position:absolute; left:0; top:0;"
                >
                  <!-- Smart Alignment Guides -->
                  <div id="guide-line-x" class="alignment-guide-x ${studioState.guideXVisible ? 'visible' : ''}" style="left:${Math.round(cw / 2)}px;"></div>
                  <div id="guide-line-y" class="alignment-guide-y ${studioState.guideYVisible ? 'visible' : ''}" style="top:${Math.round(ch / 2)}px;"></div>

                  ${sortedLayersBottomUp
                    .filter((el) => el.visible !== false)
                    .map((el) => {
                      const isSel = el.id === studioState.selectedElementId;
                      const isProt = Boolean(el.protected || el.type === 'product' || el.type === 'logo');
                      const isLocked = Boolean(el.locked);
                      const radius = Number(el.borderRadius) || 0;
                      const opacity = el.opacity !== undefined ? el.opacity : 1;

                      const basePos = `left:${Math.round(el.x)}px;top:${Math.round(el.y)}px;width:${Math.round(el.width)}px;height:${Math.round(el.height)}px;z-index:${el.zIndex || 1};opacity:${opacity};`;

                      let innerHtml = '';
                      if (el.type === 'product' || el.type === 'logo' || el.type === 'image') {
                        innerHtml = `
                          <img
                            src="${escapeHtml(el.src)}"
                            alt="${escapeHtml(el.name)}"
                            draggable="false"
                            style="width:100%;height:100%;object-fit:${el.objectFit || 'contain'};display:block;pointer-events:none;border-radius:${radius}px;"
                          />
                        `;
                      } else if (el.type === 'shape') {
                        const br = el.shapeType === 'circle' ? '9999px' : `${radius}px`;
                        const borderCss = el.borderWidth
                          ? `border:${el.borderWidth}px solid ${escapeHtml(el.borderColor || '#D5BFA4')};`
                          : '';
                        innerHtml = `<div style="width:100%;height:100%;background:${escapeHtml(el.backgroundColor || '#EADBC8')};border-radius:${br};${borderCss}pointer-events:none;"></div>`;
                      } else {
                        const bgCss =
                          el.backgroundColor && el.backgroundColor !== 'transparent'
                            ? `background:${escapeHtml(el.backgroundColor)};`
                            : '';
                        const borderCss = el.borderWidth
                          ? `border:${el.borderWidth}px solid ${escapeHtml(el.borderColor || '#D5BFA4')};`
                          : '';
                        const align = el.textAlign || 'left';
                        const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                        const pad = el.backgroundColor && el.backgroundColor !== 'transparent' ? '16px' : '0px';
                        innerHtml = `
                          <div style="width:100%;height:100%;${bgCss}${borderCss}border-radius:${radius}px;display:flex;align-items:center;justify-content:${justify};padding:${pad};pointer-events:none;">
                            <div style="width:100%;font-family:'${escapeHtml(el.fontFamily || 'Inter')}', sans-serif;font-size:${Number(el.fontSize) || 36}px;font-weight:${el.fontWeight || 600};color:${escapeHtml(el.color || '#1E1815')};text-align:${align};line-height:${el.lineHeight || 1.2};white-space:pre-line;word-break:break-word;">${escapeHtml(el.text || '')}</div>
                          </div>
                        `;
                      }

                      // Resize handles: for protected assets, show 4 proportional corner handles + lock pill; for regular elements, show all 8 handles
                      const handlesHtml =
                        isSel && !isLocked
                          ? isProt
                            ? `
                              <div class="canvas-lock-pill">
                                <span class="material-symbols-outlined" style="font-size:13px" aria-hidden="true">lock</span>
                                <span>Protected Source · Proportional Scale Only</span>
                              </div>
                              <div class="resize-handle handle-nw" data-resize-handle="nw"></div>
                              <div class="resize-handle handle-ne" data-resize-handle="ne"></div>
                              <div class="resize-handle handle-se" data-resize-handle="se"></div>
                              <div class="resize-handle handle-sw" data-resize-handle="sw"></div>
                            `
                            : `
                              <div class="resize-handle handle-nw" data-resize-handle="nw"></div>
                              <div class="resize-handle handle-n" data-resize-handle="n"></div>
                              <div class="resize-handle handle-ne" data-resize-handle="ne"></div>
                              <div class="resize-handle handle-e" data-resize-handle="e"></div>
                              <div class="resize-handle handle-se" data-resize-handle="se"></div>
                              <div class="resize-handle handle-s" data-resize-handle="s"></div>
                              <div class="resize-handle handle-sw" data-resize-handle="sw"></div>
                              <div class="resize-handle handle-w" data-resize-handle="w"></div>
                            `
                          : isSel && isLocked
                          ? `<div class="canvas-lock-pill"><span class="material-symbols-outlined" style="font-size:13px" aria-hidden="true">lock</span><span>Position Locked</span></div>`
                          : '';

                      return `
                        <div
                          data-canvas-el="${escapeHtml(el.id)}"
                          class="canvas-element ${isSel ? 'selected' : ''} ${isProt ? 'protected-asset' : ''} ${isLocked ? 'locked-element' : ''}"
                          style="${basePos}"
                        >
                          ${innerHtml}
                          ${handlesHtml}
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            </div>

            <!-- Bottom Canvas Status & Zoom Bar -->
            <div class="h-10 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-3 flex items-center justify-between text-xs shrink-0">
              <div class="flex items-center gap-3 min-w-0">
                <span class="font-mono text-[11px] text-[var(--color-text-secondary)]">${cw} × ${ch} px</span>
                ${
                  selectedEl
                    ? `
                      <span class="text-slate-300">|</span>
                      <span class="truncate font-medium text-[var(--color-text-main)]">${escapeHtml(selectedEl.name)}</span>
                      <span class="hidden sm:inline font-mono text-[11px] text-[var(--color-text-secondary)]">
                        X:${Math.round(selectedEl.x)} Y:${Math.round(selectedEl.y)} · ${Math.round(selectedEl.width)}×${Math.round(selectedEl.height)}
                      </span>
                    `
                    : `<span class="text-[var(--color-text-secondary)]">Canvas Surface Selected</span>`
                }
              </div>

              <div class="flex items-center gap-1.5">
                <button type="button" id="studio-zoom-out-btn" class="btn btn-ghost btn-icon" title="Zoom out" aria-label="Zoom out">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">remove</span>
                </button>
                <span class="font-mono text-[11px] font-semibold w-12 text-center">${Math.round(zoom * 100)}%</span>
                <button type="button" id="studio-zoom-in-btn" class="btn btn-ghost btn-icon" title="Zoom in" aria-label="Zoom in">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">add</span>
                </button>
                <button type="button" id="studio-zoom-fit-btn" class="btn btn-secondary btn-sm py-1 px-2 text-[11px]">
                  Fit Canvas
                </button>
              </div>
            </div>
          </div>

          <!-- RIGHT PANEL: Properties | AI Design Assistant | Snapshots -->
          <aside class="studio-right-panel ${studioState.mobileRightOpen ? 'mobile-panel-open' : ''}" aria-label="Element Properties and AI Assistant">
            <!-- Right Panel Tabs -->
            <div class="grid grid-cols-3 border-b border-[var(--color-border)] text-xs font-semibold bg-[var(--color-surface)] shrink-0">
              <button
                type="button"
                data-right-tab="properties"
                class="py-2.5 border-b-2 transition ${
                  studioState.rightTab === 'properties'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                Properties
              </button>
              <button
                type="button"
                data-right-tab="assistant"
                class="py-2.5 border-b-2 transition flex items-center justify-center gap-1 ${
                  studioState.rightTab === 'assistant'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                <span>AI Assistant</span>
                <span class="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px]">${recommendations.length}</span>
              </button>
              <button
                type="button"
                data-right-tab="snapshots"
                class="py-2.5 border-b-2 transition ${
                  studioState.rightTab === 'snapshots'
                    ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/40'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]'
                }"
              >
                History (${(activeProject.snapshots || []).length})
              </button>
            </div>

            <!-- Right Panel Body -->
            <div class="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
              ${
                studioState.rightTab === 'properties'
                  ? !selectedEl
                    ? `
                      <!-- Canvas Properties when no element is selected -->
                      <div class="space-y-4">
                        <div class="border-b border-[var(--color-border)] pb-2.5">
                          <div class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Canvas Configuration</div>
                          <div class="text-sm font-semibold text-[var(--color-text-main)] mt-0.5">${escapeHtml(activeProject.name)}</div>
                        </div>

                        <div>
                          <label for="prop-canvas-bg" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Canvas Background Color</label>
                          <div class="flex items-center gap-2">
                            <input type="color" id="prop-canvas-bg-picker" value="${escapeHtml(comp.backgroundColor || '#F6EFE6')}" class="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer p-0.5 bg-white" />
                            <input type="text" id="prop-canvas-bg" value="${escapeHtml(comp.backgroundColor || '#F6EFE6')}" class="input-field font-mono text-xs uppercase" />
                          </div>
                          <!-- Brand Palette Swatches -->
                          <div class="flex flex-wrap gap-1.5 mt-2">
                            ${(brand.approvedColors || ['#F6EFE6', '#EFE3D3', '#EADBC8', '#FFFFFF', '#181310', '#1E1815'])
                              .map(
                                (c) => `
                                <button
                                  type="button"
                                  data-canvas-swatch="${escapeHtml(c)}"
                                  class="w-6 h-6 rounded border border-slate-300 shadow-2xs cursor-pointer"
                                  style="background-color:${escapeHtml(c)}"
                                  title="Apply ${escapeHtml(c)}"
                                ></button>
                              `
                              )
                              .join('')}
                          </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2.5">
                          <div>
                            <label for="prop-canvas-w" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Canvas Width (px)</label>
                            <input type="number" id="prop-canvas-w" min="320" max="4096" value="${cw}" class="input-field font-mono text-xs" />
                          </div>
                          <div>
                            <label for="prop-canvas-h" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Canvas Height (px)</label>
                            <input type="number" id="prop-canvas-h" min="320" max="4096" value="${ch}" class="input-field font-mono text-xs" />
                          </div>
                        </div>

                        <div class="p-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1.5">
                          <div class="font-semibold text-[var(--color-text-main)]">Tip: Select any layer on canvas</div>
                          <p class="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                            Click any element on the canvas or in the Layers panel to adjust typography, alignment, layer order, or inspect product asset protection.
                          </p>
                        </div>
                      </div>
                    `
                    : `
                      <!-- Selected Element Properties -->
                      <div class="space-y-4">
                        <div class="flex items-start justify-between gap-2 border-b border-[var(--color-border)] pb-2.5">
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="badge ${isProtectedProduct ? 'badge-warning' : 'badge-primary'}">${escapeHtml(selectedEl.type.toUpperCase())}</span>
                              ${selectedEl.locked ? '<span class="badge badge-neutral">Locked</span>' : ''}
                            </div>
                            <input
                              type="text"
                              id="prop-el-name"
                              value="${escapeHtml(selectedEl.name)}"
                              aria-label="Layer name"
                              class="input-field text-xs font-semibold mt-1.5 py-1"
                            />
                          </div>
                        </div>

                        <!-- Protected Product Asset Integrity Notice (Section 9) -->
                        ${
                          isProtectedProduct
                            ? `
                              <div class="p-3 rounded-md border border-amber-300 bg-amber-50/75 space-y-2">
                                <div class="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">shield_lock</span>
                                  <span>Source-of-Truth Asset Protected</span>
                                </div>
                                <p class="text-[11px] text-amber-900/90 leading-snug">
                                  Destructive modifications (cropping, non-proportional stretching, pixel recoloring) are disabled. Only proportional scaling and layout positioning are allowed.
                                </p>
                                <!-- Explicitly Disabled Destructive Controls -->
                                <div class="grid grid-cols-2 gap-1.5 pt-1">
                                  <button type="button" disabled class="btn btn-secondary btn-sm opacity-50 cursor-not-allowed text-[10px]" title="Disabled by Product Integrity Rules">
                                    <span class="material-symbols-outlined icon-sm" aria-hidden="true">crop</span>
                                    <span>Crop (Locked)</span>
                                  </button>
                                  <button type="button" disabled class="btn btn-secondary btn-sm opacity-50 cursor-not-allowed text-[10px]" title="Disabled by Product Integrity Rules">
                                    <span class="material-symbols-outlined icon-sm" aria-hidden="true">flare</span>
                                    <span>Filter (Locked)</span>
                                  </button>
                                </div>
                                <!-- Proportional Quick Scale Controls -->
                                <div class="pt-1 flex items-center justify-between gap-2">
                                  <span class="text-[11px] font-semibold text-amber-950">Proportional Scale:</span>
                                  <div class="flex items-center gap-1">
                                    <button type="button" data-prop-scale="0.9" class="btn btn-secondary btn-sm py-1 px-2 text-[11px]">-10%</button>
                                    <button type="button" data-prop-scale="1.1" class="btn btn-secondary btn-sm py-1 px-2 text-[11px]">+10%</button>
                                  </div>
                                </div>
                              </div>
                            `
                            : ''
                        }

                        <!-- Canvas Alignment Controls -->
                        <div class="space-y-1.5">
                          <label class="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Align to Canvas</label>
                          <div class="grid grid-cols-6 gap-1">
                            <button type="button" data-align="left" class="btn btn-secondary btn-sm p-1.5" title="Align Left" aria-label="Align Left">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_horizontal_left</span>
                            </button>
                            <button type="button" data-align="center-x" class="btn btn-secondary btn-sm p-1.5" title="Align Horizontal Center" aria-label="Align Horizontal Center">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_horizontal_center</span>
                            </button>
                            <button type="button" data-align="right" class="btn btn-secondary btn-sm p-1.5" title="Align Right" aria-label="Align Right">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_horizontal_right</span>
                            </button>
                            <button type="button" data-align="top" class="btn btn-secondary btn-sm p-1.5" title="Align Top" aria-label="Align Top">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_vertical_top</span>
                            </button>
                            <button type="button" data-align="center-y" class="btn btn-secondary btn-sm p-1.5" title="Align Vertical Center" aria-label="Align Vertical Center">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_vertical_center</span>
                            </button>
                            <button type="button" data-align="bottom" class="btn btn-secondary btn-sm p-1.5" title="Align Bottom" aria-label="Align Bottom">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">align_vertical_bottom</span>
                            </button>
                          </div>
                        </div>

                        <!-- Position & Dimensions -->
                        <div class="space-y-2">
                          <div class="flex items-center justify-between">
                            <label class="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Geometry (px)</label>
                            ${
                              isProtectedProduct
                                ? '<span class="text-[10px] font-semibold text-amber-700">Aspect Ratio Locked</span>'
                                : ''
                            }
                          </div>
                          <div class="grid grid-cols-2 gap-2">
                            <div>
                              <label for="prop-el-x" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">X Position</label>
                              <input type="number" id="prop-el-x" value="${Math.round(selectedEl.x)}" class="input-field font-mono text-xs py-1" ${selectedEl.locked ? 'disabled' : ''} />
                            </div>
                            <div>
                              <label for="prop-el-y" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Y Position</label>
                              <input type="number" id="prop-el-y" value="${Math.round(selectedEl.y)}" class="input-field font-mono text-xs py-1" ${selectedEl.locked ? 'disabled' : ''} />
                            </div>
                            <div>
                              <label for="prop-el-w" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Width</label>
                              <input type="number" id="prop-el-w" min="24" max="3000" value="${Math.round(selectedEl.width)}" class="input-field font-mono text-xs py-1" ${selectedEl.locked ? 'disabled' : ''} />
                            </div>
                            <div>
                              <label for="prop-el-h" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Height ${isProtectedProduct ? '(Auto)' : ''}</label>
                              <input type="number" id="prop-el-h" min="24" max="3000" value="${Math.round(selectedEl.height)}" class="input-field font-mono text-xs py-1" ${selectedEl.locked || isProtectedProduct ? 'disabled' : ''} />
                            </div>
                          </div>
                        </div>

                        <!-- Text Editing & Typography Controls (For text elements) -->
                        ${
                          selectedEl.type === 'text' || ['headline', 'subheadline', 'price', 'cta', 'badge', 'caption'].includes(selectedEl.role) && selectedEl.text !== undefined
                            ? `
                              <div class="space-y-3 pt-2 border-t border-[var(--color-border)]">
                                <label for="prop-el-text" class="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Text Content</label>
                                <textarea id="prop-el-text" rows="3" class="input-field text-xs" ${selectedEl.locked ? 'disabled' : ''}>${escapeHtml(selectedEl.text || '')}</textarea>

                                <div class="grid grid-cols-2 gap-2">
                                  <div>
                                    <label for="prop-el-fontsize" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Font Size (px)</label>
                                    <input type="number" id="prop-el-fontsize" min="10" max="200" value="${Number(selectedEl.fontSize) || 32}" class="input-field font-mono text-xs py-1" />
                                  </div>
                                  <div>
                                    <label for="prop-el-fontweight" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Font Weight</label>
                                    <select id="prop-el-fontweight" class="input-field text-xs py-1">
                                      <option value="400" ${String(selectedEl.fontWeight) === '400' ? 'selected' : ''}>400 Regular</option>
                                      <option value="500" ${String(selectedEl.fontWeight) === '500' ? 'selected' : ''}>500 Medium</option>
                                      <option value="600" ${String(selectedEl.fontWeight) === '600' ? 'selected' : ''}>600 SemiBold</option>
                                      <option value="700" ${String(selectedEl.fontWeight) === '700' ? 'selected' : ''}>700 Bold</option>
                                      <option value="800" ${String(selectedEl.fontWeight) === '800' ? 'selected' : ''}>800 ExtraBold</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label class="block text-[10px] text-[var(--color-text-secondary)] mb-1">Text Alignment</label>
                                  <div class="grid grid-cols-3 gap-1">
                                    <button type="button" data-text-align="left" class="btn btn-sm ${selectedEl.textAlign === 'left' || !selectedEl.textAlign ? 'bg-blue-50 text-blue-700 border-blue-200' : 'btn-secondary'}">Left</button>
                                    <button type="button" data-text-align="center" class="btn btn-sm ${selectedEl.textAlign === 'center' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'btn-secondary'}">Center</button>
                                    <button type="button" data-text-align="right" class="btn btn-sm ${selectedEl.textAlign === 'right' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'btn-secondary'}">Right</button>
                                  </div>
                                </div>

                                <div>
                                  <label for="prop-el-color" class="block text-[10px] text-[var(--color-text-secondary)] mb-1">Text Color</label>
                                  <div class="flex items-center gap-2">
                                    <input type="color" id="prop-el-color-picker" value="${escapeHtml(selectedEl.color || '#1E1815')}" class="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer p-0.5 bg-white" />
                                    <input type="text" id="prop-el-color" value="${escapeHtml(selectedEl.color || '#1E1815')}" class="input-field font-mono text-xs uppercase py-1" />
                                  </div>
                                  <div class="flex flex-wrap gap-1.5 mt-1.5">
                                    ${[brand.primaryColor || '#1E1815', brand.secondaryColor || '#9A5B25', brand.accentColor || '#D97706', '#FFFFFF', '#3D322C']
                                      .map(
                                        (hex) => `
                                        <button type="button" data-text-color-swatch="${escapeHtml(hex)}" class="w-5 h-5 rounded border border-slate-300" style="background-color:${escapeHtml(hex)}" title="${escapeHtml(hex)}"></button>
                                      `
                                      )
                                      .join('')}
                                  </div>
                                </div>
                              </div>
                            `
                            : ''
                        }

                        <!-- Fill, Border & Opacity Controls (For non-product layers) -->
                        ${
                          !isProtectedProduct
                            ? `
                              <div class="space-y-3 pt-2 border-t border-[var(--color-border)]">
                                <label class="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Surface Fill &amp; Opacity</label>
                                <div class="flex items-center gap-2">
                                  <input
                                    type="color"
                                    id="prop-el-bg-picker"
                                    value="${escapeHtml(selectedEl.backgroundColor && selectedEl.backgroundColor !== 'transparent' ? selectedEl.backgroundColor : '#FFFFFF')}"
                                    class="w-8 h-8 rounded border border-[var(--color-border)] cursor-pointer p-0.5 bg-white"
                                  />
                                  <input
                                    type="text"
                                    id="prop-el-bg"
                                    value="${escapeHtml(selectedEl.backgroundColor || 'transparent')}"
                                    class="input-field font-mono text-xs py-1"
                                  />
                                  <button type="button" id="prop-el-bg-clear" class="btn btn-secondary btn-sm py-1 px-2 text-[10px]">Clear</button>
                                </div>

                                <div class="grid grid-cols-2 gap-2">
                                  <div>
                                    <label for="prop-el-radius" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Corner Radius (px)</label>
                                    <input type="number" id="prop-el-radius" min="0" max="500" value="${Number(selectedEl.borderRadius) || 0}" class="input-field font-mono text-xs py-1" />
                                  </div>
                                  <div>
                                    <label for="prop-el-opacity" class="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Opacity (${Math.round((selectedEl.opacity ?? 1) * 100)}%)</label>
                                    <input type="range" id="prop-el-opacity" min="0.15" max="1" step="0.05" value="${selectedEl.opacity ?? 1}" class="w-full accent-blue-600 mt-1.5" />
                                  </div>
                                </div>
                              </div>
                            `
                            : ''
                        }

                        <!-- Layer Actions: Order, Duplicate, Lock, Delete -->
                        <div class="space-y-2 pt-2 border-t border-[var(--color-border)]">
                          <label class="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Layer Order &amp; Actions</label>
                          <div class="grid grid-cols-2 gap-1.5">
                            <button type="button" id="prop-bring-front-btn" class="btn btn-secondary btn-sm">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">flip_to_front</span>
                              <span>Bring Forward</span>
                            </button>
                            <button type="button" id="prop-send-back-btn" class="btn btn-secondary btn-sm">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">flip_to_back</span>
                              <span>Send Backward</span>
                            </button>
                            <button type="button" id="prop-duplicate-btn" class="btn btn-secondary btn-sm">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">content_copy</span>
                              <span>Duplicate</span>
                            </button>
                            <button type="button" id="prop-lock-btn" class="btn btn-secondary btn-sm">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">${selectedEl.locked ? 'lock_open' : 'lock'}</span>
                              <span>${selectedEl.locked ? 'Unlock' : 'Lock Layer'}</span>
                            </button>
                          </div>
                          <button type="button" id="prop-delete-btn" class="btn btn-danger btn-sm w-full mt-1" ${selectedEl.locked ? 'disabled' : ''}>
                            <span class="material-symbols-outlined icon-sm" aria-hidden="true">delete</span>
                            <span>Delete Element from Canvas</span>
                          </button>
                        </div>
                      </div>
                    `
                  : studioState.rightTab === 'assistant'
                  ? `
                    <!-- AI Design Assistant Panel (Section 10) -->
                    <div class="space-y-3">
                      <div class="p-3 rounded-md border border-blue-200 bg-blue-50/70 space-y-1">
                        <div class="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                          <span class="material-symbols-outlined icon-sm" aria-hidden="true">auto_awesome</span>
                          <span>Deterministic Rule-Based Assistant</span>
                        </div>
                        <p class="text-[11px] text-blue-900/85 leading-snug">
                          <strong>Transparency Notice:</strong> This assistant uses local deterministic geometry, WCAG contrast, and Brand Kit rules. It does not call an external live AI model and never alters source product imagery.
                        </p>
                      </div>

                      <div class="space-y-2.5">
                        ${recommendations
                          .map(
                            (rec) => `
                            <div class="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2 hover:border-blue-400 transition">
                              <div class="flex items-start justify-between gap-2">
                                <div>
                                  <span class="badge badge-primary text-[10px]">${escapeHtml(rec.category)}</span>
                                  <h4 class="text-xs font-semibold text-[var(--color-text-main)] mt-1">${escapeHtml(rec.title)}</h4>
                                </div>
                                <button type="button" data-dismiss-rec="${escapeHtml(rec.id)}" class="text-[var(--color-text-secondary)] hover:text-[var(--color-text-main)]" title="Dismiss recommendation" aria-label="Dismiss recommendation">
                                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">close</span>
                                </button>
                              </div>
                              <p class="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">${escapeHtml(rec.description)}</p>
                              <div class="flex items-center justify-between gap-2 pt-1">
                                ${
                                  rec.elementId
                                    ? `<button type="button" data-select-rec-el="${escapeHtml(rec.elementId)}" class="text-[11px] font-medium text-blue-600 hover:underline truncate">Target: ${escapeHtml(rec.elementName)}</button>`
                                    : `<span class="text-[11px] text-[var(--color-text-secondary)]">${escapeHtml(rec.elementName)}</span>`
                                }
                                <button type="button" data-apply-rec="${escapeHtml(rec.id)}" class="btn btn-primary btn-sm shrink-0">
                                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">bolt</span>
                                  <span>${escapeHtml(rec.actionLabel || 'Apply')}</span>
                                </button>
                              </div>
                            </div>
                          `
                          )
                          .join('')}
                      </div>
                    </div>
                  `
                  : `
                    <!-- Snapshots & Version History Tab -->
                    <div class="space-y-3">
                      <button type="button" id="studio-create-snap-panel-btn" class="btn btn-primary btn-sm w-full">
                        <span class="material-symbols-outlined icon-sm" aria-hidden="true">add_circle</span>
                        <span>Save Current Version Snapshot</span>
                      </button>
                      <div class="space-y-2">
                        ${(activeProject.snapshots || [])
                          .map(
                            (snap) => `
                            <div class="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2">
                              <div class="flex items-center justify-between gap-2">
                                <span class="font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(snap.label)}</span>
                                ${snap.isSample ? '<span class="badge badge-neutral">Sample</span>' : '<span class="badge badge-primary">Saved</span>'}
                              </div>
                              <div class="flex items-center justify-between gap-2 pt-1">
                                <span class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(new Date(snap.createdAt).toLocaleString())}</span>
                                <button type="button" data-restore-snap="${escapeHtml(snap.id)}" class="btn btn-secondary btn-sm py-1 px-2 text-[11px]">Restore</button>
                              </div>
                            </div>
                          `
                          )
                          .join('')}
                      </div>
                    </div>
                  `
              }
            </div>
          </aside>
        </div>
      </div>
    `;

    bindStudioEvents();
  };

  function bindStudioEvents() {
    const comp = studioState.composition;
    const cw = Number(comp.width) || 1080;
    const ch = Number(comp.height) || 1080;
    const selectedEl = comp.elements.find((e) => e.id === studioState.selectedElementId) || null;
    const settings = store.getState().settings || {};
    const brand = store.getState().brandKit || {};
    const recommendations = generateAssistantRecommendations(comp, brand);

    // Mobile panel toggles
    container.querySelector('#studio-mobile-left-btn')?.addEventListener('click', () => {
      studioState.mobileLeftOpen = !studioState.mobileLeftOpen;
      studioState.mobileRightOpen = false;
      paintStudio();
    });
    container.querySelector('#studio-mobile-right-btn')?.addEventListener('click', () => {
      studioState.mobileRightOpen = !studioState.mobileRightOpen;
      studioState.mobileLeftOpen = false;
      paintStudio();
    });

    // Top Toolbar Events
    container.querySelector('#studio-project-switcher')?.addEventListener('change', (e) => {
      const pid = e.target.value;
      store.setActiveProject(pid);
      studioState.projectId = null;
      renderDesignStudio(container, { projectId: pid });
    });

    container.querySelector('#studio-rename-proj-btn')?.addEventListener('click', () => {
      openCustomModal({
        title: 'Rename Project',
        bodyHtml: `
          <div>
            <label for="modal-rename-input" class="block text-xs font-medium mb-1">Project Title</label>
            <input type="text" id="modal-rename-input" class="input-field" value="${escapeHtml(activeProject.name)}" />
          </div>
        `,
        footerHtml: `
          <button type="button" id="modal-rename-cancel" class="btn btn-secondary">Cancel</button>
          <button type="button" id="modal-rename-save" class="btn btn-primary">Save Name</button>
        `,
        maxWidth: 'max-w-sm',
        onMount: () => {
          document.getElementById('modal-rename-cancel')?.addEventListener('click', closeCustomModal);
          document.getElementById('modal-rename-save')?.addEventListener('click', () => {
            const val = document.getElementById('modal-rename-input')?.value.trim();
            if (val) {
              store.renameProject(activeProject.id, val);
              closeCustomModal();
              showToast(`Renamed project to "${val}".`, 'success');
              paintStudio();
            }
          });
        }
      });
    });

    container.querySelector('#studio-undo-btn')?.addEventListener('click', () => {
      if (studioState.undoStack.length === 0) return;
      studioState.redoStack.push(cloneComp(studioState.composition));
      studioState.composition = studioState.undoStack.pop();
      commitCompositionChange();
      paintStudio();
    });

    container.querySelector('#studio-redo-btn')?.addEventListener('click', () => {
      if (studioState.redoStack.length === 0) return;
      studioState.undoStack.push(cloneComp(studioState.composition));
      studioState.composition = studioState.redoStack.pop();
      commitCompositionChange();
      paintStudio();
    });

    container.querySelector('#studio-dimension-preset')?.addEventListener('change', (e) => {
      const [tw, th] = e.target.value.split('x').map(Number);
      if (tw && th) {
        pushUndoSnapshot();
        studioState.composition = adaptCompositionToDimensions(studioState.composition, tw, th);
        const vp = container.querySelector('#studio-canvas-viewport');
        studioState.zoom = computeFitZoom(vp, tw, th);
        commitCompositionChange();
        showToast(`Adapted composition to ${tw}×${th} px with locked product proportions.`, 'success');
        paintStudio();
      }
    });

    container.querySelector('#studio-grid-toggle-btn')?.addEventListener('click', () => {
      store.updateSettings({ showCanvasGrid: !settings.showCanvasGrid });
      paintStudio();
    });

    container.querySelector('#studio-snap-toggle-btn')?.addEventListener('click', () => {
      store.updateSettings({ snapToGrid: !settings.snapToGrid });
      paintStudio();
    });

    const saveSnapHandler = () => {
      const label = `v1.${(activeProject.snapshots || []).length} — Studio Save (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      commitCompositionChange({ createSnapshot: true, snapshotLabel: label });
      showToast(`Saved version snapshot "${label}".`, 'success');
      paintStudio();
    };
    container.querySelector('#studio-save-snapshot-btn')?.addEventListener('click', saveSnapHandler);
    container.querySelector('#studio-create-snap-panel-btn')?.addEventListener('click', saveSnapHandler);

    container.querySelector('#studio-qa-badge-btn')?.addEventListener('click', () => {
      router.navigate('validation', { projectId: activeProject.id });
    });

    container.querySelector('#studio-preview-btn')?.addEventListener('click', () => {
      openCustomModal({
        title: `Clean Campaign Preview — ${activeProject.name}`,
        subtitle: `${cw} × ${ch} px · Product Asset Integrity Verified`,
        bodyHtml: `
          <div class="h-[460px] rounded-lg border border-[var(--color-border)] overflow-hidden">
            ${renderMiniComposition(studioState.composition, { maxWidth: 640, maxHeight: 430 })}
          </div>
        `,
        footerHtml: `
          <button type="button" id="preview-close-btn" class="btn btn-secondary">Close Preview</button>
          <button type="button" id="preview-quick-png-btn" class="btn btn-primary">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">download</span>
            <span>Quick Export PNG</span>
          </button>
        `,
        maxWidth: 'max-w-2xl',
        onMount: () => {
          document.getElementById('preview-close-btn')?.addEventListener('click', closeCustomModal);
          document.getElementById('preview-quick-png-btn')?.addEventListener('click', async () => {
            const { blob } = await renderCompositionToBlob(studioState.composition, 'png');
            if (blob) {
              downloadBlob(blob, `${activeProject.id}-${cw}x${ch}.png`);
              showToast('Downloaded PNG output.', 'success');
            }
            closeCustomModal();
          });
        }
      });
    });

    container.querySelector('#studio-export-btn')?.addEventListener('click', () => {
      router.navigate('export', { projectId: activeProject.id });
    });

    // Zoom Controls
    container.querySelector('#studio-zoom-in-btn')?.addEventListener('click', () => {
      studioState.autoFit = false;
      studioState.zoom = Number(clamp(studioState.zoom + 0.08, 0.2, 1.35).toFixed(2));
      paintStudio();
    });
    container.querySelector('#studio-zoom-out-btn')?.addEventListener('click', () => {
      studioState.autoFit = false;
      studioState.zoom = Number(clamp(studioState.zoom - 0.08, 0.2, 1.35).toFixed(2));
      paintStudio();
    });
    container.querySelector('#studio-zoom-fit-btn')?.addEventListener('click', () => {
      const vp = container.querySelector('#studio-canvas-viewport');
      studioState.zoom = computeFitZoom(vp, cw, ch);
      paintStudio();
    });

    // Left Panel Tabs & Quick Add Elements
    container.querySelectorAll('[data-left-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studioState.leftTab = btn.getAttribute('data-left-tab');
        paintStudio();
      });
    });

    container.querySelectorAll('[data-right-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studioState.rightTab = btn.getAttribute('data-right-tab');
        paintStudio();
      });
    });

    container.querySelectorAll('[data-add-element]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-add-element');
        pushUndoSnapshot();
        const maxZ = comp.elements.reduce((m, e) => Math.max(m, e.zIndex || 1), 1);
        let newEl;

        if (kind === 'text') {
          newEl = {
            id: uid('el_txt'),
            name: 'Text Layer',
            type: 'text',
            role: 'subheadline',
            text: 'Nikmati Kopi Segar Setiap Hari',
            x: Math.round(cw * 0.12),
            y: Math.round(ch * 0.42),
            width: 420,
            height: 72,
            fontFamily: brand.headingFont || 'Inter',
            fontSize: 32,
            fontWeight: 700,
            color: brand.primaryColor || '#1E1815',
            backgroundColor: 'transparent',
            borderRadius: 0,
            textAlign: 'left',
            lineHeight: 1.25,
            opacity: 1,
            zIndex: maxZ + 1,
            visible: true
          };
        } else if (kind === 'cta') {
          newEl = {
            id: uid('el_cta'),
            name: 'CTA Badge Button',
            type: 'text',
            role: 'cta',
            text: 'Pesan Sekarang',
            x: Math.round(cw * 0.12),
            y: Math.round(ch * 0.65),
            width: 300,
            height: 76,
            fontFamily: brand.headingFont || 'Inter',
            fontSize: 26,
            fontWeight: 700,
            color: '#FFFFFF',
            backgroundColor: brand.secondaryColor || '#9A5B25',
            borderRadius: 14,
            textAlign: 'center',
            lineHeight: 1.1,
            opacity: 1,
            zIndex: maxZ + 1,
            visible: true
          };
        } else if (kind === 'circle') {
          newEl = {
            id: uid('el_cir'),
            name: 'Circle Accent Shape',
            type: 'shape',
            shapeType: 'circle',
            role: 'decor',
            x: Math.round(cw * 0.35),
            y: Math.round(ch * 0.3),
            width: 260,
            height: 260,
            backgroundColor: '#EADBC8',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 999,
            opacity: 1,
            zIndex: maxZ + 1,
            visible: true
          };
        } else {
          newEl = {
            id: uid('el_rect'),
            name: 'Rectangle Card Shape',
            type: 'shape',
            shapeType: 'rect',
            role: 'decor',
            x: Math.round(cw * 0.2),
            y: Math.round(ch * 0.35),
            width: 360,
            height: 180,
            backgroundColor: '#EFE3D3',
            borderColor: '#D5BFA4',
            borderWidth: 2,
            borderRadius: 16,
            opacity: 1,
            zIndex: maxZ + 1,
            visible: true
          };
        }

        comp.elements.push(newEl);
        studioState.selectedElementId = newEl.id;
        commitCompositionChange();
        paintStudio();
      });
    });

    // Layer List Actions
    container.querySelectorAll('[data-layer-select]').forEach((row) => {
      row.addEventListener('click', () => {
        studioState.selectedElementId = row.getAttribute('data-layer-select');
        paintStudio();
      });
    });

    container.querySelectorAll('[data-layer-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-layer-up');
        const target = comp.elements.find((e) => e.id === id);
        if (target) {
          pushUndoSnapshot();
          target.zIndex = (target.zIndex || 1) + 2;
          commitCompositionChange();
          paintStudio();
        }
      });
    });

    container.querySelectorAll('[data-layer-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-layer-down');
        const target = comp.elements.find((e) => e.id === id);
        if (target) {
          pushUndoSnapshot();
          target.zIndex = Math.max(1, (target.zIndex || 1) - 2);
          commitCompositionChange();
          paintStudio();
        }
      });
    });

    container.querySelectorAll('[data-layer-lock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-layer-lock');
        const target = comp.elements.find((e) => e.id === id);
        if (target) {
          target.locked = !target.locked;
          commitCompositionChange();
          paintStudio();
        }
      });
    });

    container.querySelectorAll('[data-layer-vis]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-layer-vis');
        const target = comp.elements.find((e) => e.id === id);
        if (target) {
          target.visible = target.visible === false ? true : false;
          commitCompositionChange();
          paintStudio();
        }
      });
    });

    // Insert Asset from Left Panel
    container.querySelector('#studio-go-asset-lib-btn')?.addEventListener('click', () => {
      router.navigate('asset-library');
    });

    container.querySelectorAll('[data-insert-asset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const aid = btn.getAttribute('data-insert-asset');
        const asset = store.getState().assets.find((a) => a.id === aid);
        if (!asset) return;
        pushUndoSnapshot();
        const maxZ = comp.elements.reduce((m, e) => Math.max(m, e.zIndex || 1), 1);
        const aspect = (asset.width || 800) / (asset.height || 800);
        const h = asset.category === 'Logos' ? 88 : 420;
        const w = Math.round(h * aspect);
        const newEl = {
          id: uid('el_ast'),
          name: asset.name,
          type: asset.category === 'Logos' ? 'logo' : asset.protected ? 'product' : 'image',
          role: asset.category === 'Logos' ? 'logo' : asset.protected ? 'product' : 'badge',
          assetId: asset.id,
          src: asset.src,
          x: Math.round((cw - w) / 2),
          y: Math.round((ch - h) / 2),
          width: w,
          height: h,
          naturalWidth: asset.width || 800,
          naturalHeight: asset.height || 800,
          aspectRatioLocked: Boolean(asset.protected),
          objectFit: 'contain',
          opacity: 1,
          zIndex: maxZ + 1,
          protected: Boolean(asset.protected),
          visible: true
        };
        comp.elements.push(newEl);
        studioState.selectedElementId = newEl.id;
        commitCompositionChange();
        showToast(`Added "${asset.name}" to canvas.`, 'success');
        paintStudio();
      });
    });

    // Templates in Left Panel
    container.querySelector('#studio-save-as-tpl-btn')?.addEventListener('click', () => {
      const tpl = store.saveCompositionAsTemplate({
        name: `${activeProject.name} Blueprint`,
        category: 'Product Promotion',
        composition: studioState.composition
      });
      showToast(`Saved current composition as template "${tpl.name}".`, 'success');
      paintStudio();
    });

    container.querySelectorAll('[data-studio-load-tpl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-studio-load-tpl');
        const tpl = store.getState().templates.find((t) => t.id === tid);
        if (!tpl) return;
        showConfirmModal({
          title: 'Load Template onto Current Canvas',
          message: `Replace the current layout in "${activeProject.name}" with "${tpl.name}"? An undo snapshot will be saved automatically.`,
          confirmText: 'Load Template',
          onConfirm: () => {
            pushUndoSnapshot();
            studioState.composition = cloneComp(tpl.composition);
            studioState.selectedElementId = studioState.composition.elements[0]?.id || null;
            commitCompositionChange({
              createSnapshot: true,
              snapshotLabel: `Loaded Template: ${tpl.name}`
            });
            showToast(`Loaded template "${tpl.name}".`, 'success');
            paintStudio();
          }
        });
      });
    });

    // Canvas Background Click (Deselect element) & Element Pointer Drag / Resize
    const viewport = container.querySelector('#studio-canvas-viewport');
    const canvasEl = container.querySelector('#studio-design-canvas');

    viewport?.addEventListener('pointerdown', (e) => {
      if (e.target === viewport || e.target === canvasEl) {
        studioState.selectedElementId = null;
        paintStudio();
      }
    });

    container.querySelectorAll('[data-canvas-el]').forEach((domEl) => {
      domEl.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const elId = domEl.getAttribute('data-canvas-el');
        const target = comp.elements.find((item) => item.id === elId);
        if (!target) return;

        const handleDir = e.target.getAttribute?.('data-resize-handle');
        const wasAlreadySelected = studioState.selectedElementId === elId;
        studioState.selectedElementId = elId;

        if (target.locked) {
          if (!wasAlreadySelected) paintStudio();
          return;
        }

        pushUndoSnapshot();

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const origX = Number(target.x) || 0;
        const origY = Number(target.y) || 0;
        const origW = Number(target.width) || 100;
        const origH = Number(target.height) || 100;
        const isAspectLocked = Boolean(
          target.protected || target.type === 'product' || target.type === 'logo' || target.aspectRatioLocked
        );
        const natAspect =
          (Number(target.naturalWidth) || origW) / Math.max(1, Number(target.naturalHeight) || origH);
        const gridStep = settings.snapToGrid ? Number(settings.canvasGridSize) || 16 : 1;

        const guideX = container.querySelector('#guide-line-x');
        const guideY = container.querySelector('#guide-line-y');

        const onPointerMove = (moveEvt) => {
          const dx = (moveEvt.clientX - startClientX) / studioState.zoom;
          const dy = (moveEvt.clientY - startClientY) / studioState.zoom;

          if (!handleDir) {
            // Moving element
            let nx = Math.round((origX + dx) / gridStep) * gridStep;
            let ny = Math.round((origY + dy) / gridStep) * gridStep;

            // Check center alignment snap
            const centerX = nx + target.width / 2;
            const centerY = ny + target.height / 2;
            if (Math.abs(centerX - cw / 2) < 10) {
              nx = Math.round(cw / 2 - target.width / 2);
              guideX?.classList.add('visible');
            } else {
              guideX?.classList.remove('visible');
            }

            if (Math.abs(centerY - ch / 2) < 10) {
              ny = Math.round(ch / 2 - target.height / 2);
              guideY?.classList.add('visible');
            } else {
              guideY?.classList.remove('visible');
            }

            target.x = nx;
            target.y = ny;
            domEl.style.left = `${nx}px`;
            domEl.style.top = `${ny}px`;
          } else {
            // Resizing element
            let nw = origW;
            let nh = origH;
            let nx = origX;
            let ny = origY;

            if (handleDir.includes('e')) nw = Math.max(32, origW + dx);
            if (handleDir.includes('s')) nh = Math.max(32, origH + dy);
            if (handleDir.includes('w')) {
              nw = Math.max(32, origW - dx);
              nx = origX + (origW - nw);
            }
            if (handleDir.includes('n')) {
              nh = Math.max(32, origH - dy);
              ny = origY + (origH - nh);
            }

            if (isAspectLocked) {
              // Strictly preserve aspect ratio for protected product & logo assets
              nh = Math.round(nw / natAspect);
              if (handleDir.includes('n')) {
                ny = origY + (origH - nh);
              }
            }

            target.x = Math.round(nx);
            target.y = Math.round(ny);
            target.width = Math.round(nw);
            target.height = Math.round(nh);

            domEl.style.left = `${target.x}px`;
            domEl.style.top = `${target.y}px`;
            domEl.style.width = `${target.width}px`;
            domEl.style.height = `${target.height}px`;
          }
        };

        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          guideX?.classList.remove('visible');
          guideY?.classList.remove('visible');
          commitCompositionChange();
          paintStudio();
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });
    });

    // Right Panel: Canvas Properties (when no element selected)
    container.querySelector('#prop-canvas-bg-picker')?.addEventListener('input', (e) => {
      comp.backgroundColor = e.target.value.toUpperCase();
      commitCompositionChange();
      paintStudio();
    });
    container.querySelector('#prop-canvas-bg')?.addEventListener('change', (e) => {
      comp.backgroundColor = e.target.value.trim();
      commitCompositionChange();
      paintStudio();
    });
    container.querySelectorAll('[data-canvas-swatch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        pushUndoSnapshot();
        comp.backgroundColor = btn.getAttribute('data-canvas-swatch');
        commitCompositionChange();
        paintStudio();
      });
    });
    container.querySelector('#prop-canvas-w')?.addEventListener('change', (e) => {
      pushUndoSnapshot();
      comp.width = clamp(Number(e.target.value) || 1080, 320, 4096);
      commitCompositionChange();
      paintStudio();
    });
    container.querySelector('#prop-canvas-h')?.addEventListener('change', (e) => {
      pushUndoSnapshot();
      comp.height = clamp(Number(e.target.value) || 1080, 320, 4096);
      commitCompositionChange();
      paintStudio();
    });

    // Right Panel: Selected Element Properties
    if (selectedEl) {
      container.querySelector('#prop-el-name')?.addEventListener('change', (e) => {
        selectedEl.name = e.target.value.trim() || selectedEl.name;
        commitCompositionChange();
        paintStudio();
      });

      // Proportional Scale Buttons for Protected Product Assets
      container.querySelectorAll('[data-prop-scale]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const factor = Number(btn.getAttribute('data-prop-scale')) || 1;
          pushUndoSnapshot();
          const natRatio =
            (Number(selectedEl.naturalWidth) || selectedEl.width) /
            Math.max(1, Number(selectedEl.naturalHeight) || selectedEl.height);
          const newW = clamp(Math.round(selectedEl.width * factor), 60, cw);
          const newH = Math.round(newW / natRatio);
          selectedEl.width = newW;
          selectedEl.height = newH;
          commitCompositionChange();
          paintStudio();
        });
      });

      // Alignment Buttons
      container.querySelectorAll('[data-align]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (selectedEl.locked) return;
          pushUndoSnapshot();
          const mode = btn.getAttribute('data-align');
          if (mode === 'left') selectedEl.x = 64;
          if (mode === 'center-x') selectedEl.x = Math.round((cw - selectedEl.width) / 2);
          if (mode === 'right') selectedEl.x = cw - selectedEl.width - 64;
          if (mode === 'top') selectedEl.y = 64;
          if (mode === 'center-y') selectedEl.y = Math.round((ch - selectedEl.height) / 2);
          if (mode === 'bottom') selectedEl.y = ch - selectedEl.height - 64;
          commitCompositionChange();
          paintStudio();
        });
      });

      // Geometry X, Y, W, H
      container.querySelector('#prop-el-x')?.addEventListener('change', (e) => {
        pushUndoSnapshot();
        selectedEl.x = Number(e.target.value) || 0;
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-y')?.addEventListener('change', (e) => {
        pushUndoSnapshot();
        selectedEl.y = Number(e.target.value) || 0;
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-w')?.addEventListener('change', (e) => {
        pushUndoSnapshot();
        const nw = Math.max(24, Number(e.target.value) || 100);
        if (selectedEl.protected || selectedEl.type === 'product' || selectedEl.type === 'logo' || selectedEl.aspectRatioLocked) {
          const natRatio =
            (Number(selectedEl.naturalWidth) || selectedEl.width) /
            Math.max(1, Number(selectedEl.naturalHeight) || selectedEl.height);
          selectedEl.width = nw;
          selectedEl.height = Math.round(nw / natRatio);
        } else {
          selectedEl.width = nw;
        }
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-h')?.addEventListener('change', (e) => {
        if (selectedEl.protected || selectedEl.type === 'product') return;
        pushUndoSnapshot();
        selectedEl.height = Math.max(24, Number(e.target.value) || 100);
        commitCompositionChange();
        paintStudio();
      });

      // Text Controls
      container.querySelector('#prop-el-text')?.addEventListener('input', (e) => {
        selectedEl.text = e.target.value;
        commitCompositionChange();
        const domTarget = container.querySelector(`[data-canvas-el="${selectedEl.id}"] div div`);
        if (domTarget) domTarget.textContent = e.target.value;
      });
      container.querySelector('#prop-el-fontsize')?.addEventListener('change', (e) => {
        pushUndoSnapshot();
        selectedEl.fontSize = clamp(Number(e.target.value) || 32, 10, 220);
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-fontweight')?.addEventListener('change', (e) => {
        pushUndoSnapshot();
        selectedEl.fontWeight = Number(e.target.value) || 600;
        commitCompositionChange();
        paintStudio();
      });
      container.querySelectorAll('[data-text-align]').forEach((btn) => {
        btn.addEventListener('click', () => {
          pushUndoSnapshot();
          selectedEl.textAlign = btn.getAttribute('data-text-align');
          commitCompositionChange();
          paintStudio();
        });
      });
      container.querySelector('#prop-el-color-picker')?.addEventListener('input', (e) => {
        selectedEl.color = e.target.value.toUpperCase();
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-color')?.addEventListener('change', (e) => {
        selectedEl.color = e.target.value.trim();
        commitCompositionChange();
        paintStudio();
      });
      container.querySelectorAll('[data-text-color-swatch]').forEach((btn) => {
        btn.addEventListener('click', () => {
          pushUndoSnapshot();
          selectedEl.color = btn.getAttribute('data-text-color-swatch');
          commitCompositionChange();
          paintStudio();
        });
      });

      // Fill, Radius, Opacity
      container.querySelector('#prop-el-bg-picker')?.addEventListener('input', (e) => {
        selectedEl.backgroundColor = e.target.value.toUpperCase();
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-bg')?.addEventListener('change', (e) => {
        selectedEl.backgroundColor = e.target.value.trim();
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-bg-clear')?.addEventListener('click', () => {
        selectedEl.backgroundColor = 'transparent';
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-radius')?.addEventListener('change', (e) => {
        selectedEl.borderRadius = Math.max(0, Number(e.target.value) || 0);
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-el-opacity')?.addEventListener('input', (e) => {
        selectedEl.opacity = Number(e.target.value);
        commitCompositionChange();
        paintStudio();
      });

      // Layer Order, Duplicate, Lock, Delete
      container.querySelector('#prop-bring-front-btn')?.addEventListener('click', () => {
        pushUndoSnapshot();
        selectedEl.zIndex = (selectedEl.zIndex || 1) + 2;
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-send-back-btn')?.addEventListener('click', () => {
        pushUndoSnapshot();
        selectedEl.zIndex = Math.max(1, (selectedEl.zIndex || 1) - 2);
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-duplicate-btn')?.addEventListener('click', () => {
        pushUndoSnapshot();
        const dup = cloneComp(selectedEl);
        dup.id = uid('el_dup');
        dup.name = `${selectedEl.name} (Copy)`;
        dup.x = Math.min(cw - dup.width, selectedEl.x + 24);
        dup.y = Math.min(ch - dup.height, selectedEl.y + 24);
        dup.zIndex = (selectedEl.zIndex || 1) + 1;
        comp.elements.push(dup);
        studioState.selectedElementId = dup.id;
        commitCompositionChange();
        showToast(`Duplicated "${selectedEl.name}".`, 'info');
        paintStudio();
      });
      container.querySelector('#prop-lock-btn')?.addEventListener('click', () => {
        selectedEl.locked = !selectedEl.locked;
        commitCompositionChange();
        paintStudio();
      });
      container.querySelector('#prop-delete-btn')?.addEventListener('click', () => {
        if (selectedEl.locked) return;
        pushUndoSnapshot();
        comp.elements = comp.elements.filter((e) => e.id !== selectedEl.id);
        studioState.selectedElementId = comp.elements[0]?.id || null;
        commitCompositionChange();
        showToast(`Removed "${selectedEl.name}" from canvas.`, 'info');
        paintStudio();
      });
    }

    // AI Design Assistant Recommendations Actions
    container.querySelectorAll('[data-select-rec-el]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studioState.selectedElementId = btn.getAttribute('data-select-rec-el');
        paintStudio();
      });
    });

    container.querySelectorAll('[data-apply-rec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recId = btn.getAttribute('data-apply-rec');
        const rec = recommendations.find((r) => r.id === recId);
        if (!rec || typeof rec.applyFn !== 'function') return;
        pushUndoSnapshot();
        rec.applyFn(studioState.composition);
        commitCompositionChange();
        showToast(`Applied AI Assistant rule: "${rec.title}"`, 'success');
        paintStudio();
      });
    });

    container.querySelectorAll('[data-dismiss-rec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studioState.dismissedRecIds.add(btn.getAttribute('data-dismiss-rec'));
        paintStudio();
      });
    });

    // Snapshot Restore Action
    container.querySelectorAll('[data-restore-snap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const snapId = btn.getAttribute('data-restore-snap');
        showConfirmModal({
          title: 'Restore Version Snapshot',
          message: 'Restore the canvas composition to this saved version snapshot?',
          confirmText: 'Restore Snapshot',
          onConfirm: () => {
            pushUndoSnapshot();
            const restoredProj = store.restoreSnapshot(activeProject.id, snapId);
            if (restoredProj) {
              studioState.composition = cloneComp(restoredProj.composition);
              showToast('Restored version snapshot.', 'success');
              paintStudio();
            }
          }
        });
      });
    });
  }

  // Initial Fit Zoom Calculation after DOM mount
  paintStudio();
  requestAnimationFrame(() => {
    const vp = container.querySelector('#studio-canvas-viewport');
    if (vp && studioState.autoFit) {
      studioState.zoom = computeFitZoom(
        vp,
        studioState.composition.width,
        studioState.composition.height
      );
      studioState.autoFit = false;
      paintStudio();
    }
  });

  // Keyboard Shortcuts (Undo, Redo, Arrow Nudge)
  if (keydownCleanup) {
    window.removeEventListener('keydown', keydownCleanup);
  }
  keydownCleanup = (e) => {
    if (router.currentRoute !== 'design-studio') return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      container.querySelector('#studio-undo-btn')?.click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      container.querySelector('#studio-redo-btn')?.click();
      return;
    }

    const sel = studioState.composition?.elements.find((item) => item.id === studioState.selectedElementId);
    if (!sel || sel.locked) return;

    const step = e.shiftKey ? 16 : 4;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      pushUndoSnapshot();
      if (e.key === 'ArrowLeft') sel.x -= step;
      if (e.key === 'ArrowRight') sel.x += step;
      if (e.key === 'ArrowUp') sel.y -= step;
      if (e.key === 'ArrowDown') sel.y += step;
      commitCompositionChange();
      paintStudio();
    }
  };
  window.addEventListener('keydown', keydownCleanup);
}
