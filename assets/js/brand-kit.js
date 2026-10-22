/**
 * AutoDesign — Brand Kit Module
 * Manages brand identity, color pickers & validated hex inputs, typography styles,
 * product integrity rules, logo protection rules, background restrictions, approved templates, and live brand preview.
 */

import { store, getDefaultBrandKit } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  isValidHexColor,
  normalizeHex,
  getContrastRatio,
  showToast,
  showConfirmModal
} from './utils.js';

const FONT_OPTIONS = [
  'Inter',
  'Plus Jakarta Sans',
  'Space Grotesk',
  'DM Sans',
  'Playfair Display',
  'Merriweather'
];

export function renderBrandKit(container) {
  const state = store.getState();
  const brand = JSON.parse(JSON.stringify(state.brandKit || getDefaultBrandKit()));
  const templates = state.templates || [];
  const logoAssets = (state.assets || []).filter((a) => a.category === 'Logos');

  const renderView = () => {
    const primaryBgContrast = getContrastRatio(
      normalizeHex(brand.primaryColor, '#1E1815'),
      normalizeHex(brand.backgroundColor, '#F6EFE6')
    );
    const ctaWhiteContrast = getContrastRatio(
      normalizeHex(brand.secondaryColor, '#9A5B25'),
      '#FFFFFF'
    );
    const minRequiredContrast = Number(brand.rules?.minContrastRatio) || 4.5;

    const hexFields = [
      { key: 'primaryColor', label: 'Primary Brand / Ink', value: brand.primaryColor },
      { key: 'secondaryColor', label: 'Secondary / CTA Fill', value: brand.secondaryColor },
      { key: 'accentColor', label: 'Accent / Highlight', value: brand.accentColor },
      { key: 'backgroundColor', label: 'Campaign Canvas Surface', value: brand.backgroundColor },
      { key: 'surfaceColor', label: 'Card / Price Callout Surface', value: brand.surfaceColor }
    ];

    const invalidHexList = hexFields.filter((f) => !isValidHexColor(f.value));
    const isNameEmpty = !brand.name || !brand.name.trim();
    const hasContrastWarning = primaryBgContrast < minRequiredContrast || ctaWhiteContrast < 3.0;

    container.innerHTML = `
      <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-6">
        <!-- Top Header Bar -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-[var(--color-text-main)]">Brand Identity &amp; Governance Kit</h2>
              <span class="badge ${invalidHexList.length === 0 && !isNameEmpty ? 'badge-success' : 'badge-error'}">
                ${invalidHexList.length === 0 && !isNameEmpty ? 'Configuration Valid' : 'Validation Error'}
              </span>
            </div>
            <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Define official colors, typography, product integrity locks, and logo clear-space rules enforced by the Validation Engine.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" id="brand-reset-default-btn" class="btn btn-secondary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">restart_alt</span>
              <span>Reset Kopi Senja Defaults</span>
            </button>
            <button type="button" id="brand-apply-to-active-btn" class="btn btn-secondary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">format_paint</span>
              <span>Sync Palette to Active Project</span>
            </button>
            <button type="button" id="brand-save-btn" class="btn btn-primary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">check</span>
              <span>Save Brand Kit</span>
            </button>
          </div>
        </div>

        <!-- Validation Banner -->
        <div id="brand-validation-banner" class="card-surface p-3.5 border-l-4 ${
          invalidHexList.length > 0 || isNameEmpty
            ? 'border-l-red-600 bg-red-50/50'
            : hasContrastWarning
            ? 'border-l-amber-600 bg-amber-50/50'
            : 'border-l-emerald-600 bg-emerald-50/40'
        } flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined ${
              invalidHexList.length > 0 || isNameEmpty
                ? 'text-red-700'
                : hasContrastWarning
                ? 'text-amber-700'
                : 'text-emerald-700'
            }" aria-hidden="true">
              ${invalidHexList.length > 0 || isNameEmpty ? 'error' : hasContrastWarning ? 'warning' : 'verified'}
            </span>
            <div>
              ${
                invalidHexList.length > 0
                  ? `<strong class="text-red-800">Invalid Hexadecimal Color Detected:</strong> ${invalidHexList.map((f) => escapeHtml(f.label)).join(', ')}. Use #RRGGBB format.`
                  : isNameEmpty
                  ? `<strong class="text-red-800">Incomplete Configuration:</strong> Brand name is required.`
                  : hasContrastWarning
                  ? `<strong class="text-amber-900">Contrast Advisory:</strong> Primary/Background contrast is ${primaryBgContrast}:1 (Target ≥ ${minRequiredContrast}:1); Secondary/White CTA contrast is ${ctaWhiteContrast}:1.`
                  : `<strong class="text-emerald-900">Live Rule Check Passed:</strong> Primary on Background contrast is <strong>${primaryBgContrast}:1</strong> (Target ≥ ${minRequiredContrast}:1) · Secondary CTA contrast is <strong>${ctaWhiteContrast}:1</strong>.`
              }
            </div>
          </div>
          <span class="font-mono text-[11px] text-[var(--color-text-secondary)]">Calculated via WCAG 2.1 Relative Luminance</span>
        </div>

        <!-- Main Grid: Left Configuration Controls (7 cols) + Right Live Brand Preview (5 cols) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Left Column: Settings & Rules -->
          <div class="lg:col-span-7 space-y-5">
            <!-- 1. Brand Profile & Guidelines -->
            <section class="card-surface p-5 space-y-4">
              <div class="border-b border-[var(--color-border)] pb-3">
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">1. Brand Identity &amp; Voice Guidelines</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Core brand attributes and editorial direction</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label for="bk-name" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Brand Name *</label>
                  <input type="text" id="bk-name" class="input-field" value="${escapeHtml(brand.name)}" placeholder="e.g., Kopi Senja" required />
                </div>
                <div>
                  <label for="bk-tagline" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Campaign Tagline</label>
                  <input type="text" id="bk-tagline" class="input-field" value="${escapeHtml(brand.tagline || 'Temukan Jeda Terbaikmu')}" />
                </div>
              </div>

              <div>
                <label for="bk-desc" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Brand Description</label>
                <textarea id="bk-desc" rows="2" class="input-field">${escapeHtml(brand.description || '')}</textarea>
              </div>

              <div>
                <label for="bk-guidelines" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Brand Composition &amp; Integrity Guidelines</label>
                <textarea id="bk-guidelines" rows="3" class="input-field">${escapeHtml(brand.guidelines || '')}</textarea>
              </div>
            </section>

            <!-- 2. Color System (Pickers + Hex Inputs) -->
            <section class="card-surface p-5 space-y-4">
              <div class="border-b border-[var(--color-border)] pb-3 flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-main)]">2. Brand Color System</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">Synchronized color pickers and validated hexadecimal inputs</p>
                </div>
                <span class="badge badge-neutral">WCAG Checked</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                ${hexFields
                  .map((field) => {
                    const valid = isValidHexColor(field.value);
                    const safePickerVal = normalizeHex(field.value, '#1E1815');
                    return `
                      <div class="p-3 rounded-md border ${valid ? 'border-[var(--color-border)]' : 'border-red-500 bg-red-50/30'} space-y-1.5">
                        <label class="block text-xs font-medium text-[var(--color-text-main)]">${escapeHtml(field.label)}</label>
                        <div class="flex items-center gap-2">
                          <input
                            type="color"
                            data-color-picker="${field.key}"
                            value="${safePickerVal}"
                            class="w-9 h-9 rounded border border-[var(--color-border)] cursor-pointer p-0.5 bg-white shrink-0"
                            aria-label="${escapeHtml(field.label)} color picker"
                          />
                          <input
                            type="text"
                            data-hex-input="${field.key}"
                            value="${escapeHtml(field.value)}"
                            maxlength="7"
                            class="input-field font-mono uppercase text-xs"
                            placeholder="#RRGGBB"
                            aria-label="${escapeHtml(field.label)} hex code"
                          />
                        </div>
                        ${
                          !valid
                            ? `<div class="text-[11px] text-red-700 font-medium">Enter a valid 3 or 6 digit hex color (e.g., #1E1815)</div>`
                            : ''
                        }
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            </section>

            <!-- 3. Logo Collection & Protection -->
            <section class="card-surface p-5 space-y-4">
              <div class="border-b border-[var(--color-border)] pb-3 flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-main)]">3. Official Logo Collection</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">Approved vector marks from Asset Library</p>
                </div>
                <button type="button" id="bk-manage-logos-btn" class="btn btn-secondary btn-sm">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">photo_library</span>
                  <span>View in Asset Library</span>
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${logoAssets
                  .map(
                    (logo, idx) => `
                    <div class="p-3 rounded-md border border-[var(--color-border)] flex flex-col justify-between gap-2 ${idx === 1 ? 'bg-slate-900 text-white' : 'bg-[var(--color-bg)]'}">
                      <div class="h-16 flex items-center justify-center p-2">
                        <img src="${escapeHtml(logo.src)}" alt="${escapeHtml(logo.name)}" class="max-h-full max-w-full object-contain" />
                      </div>
                      <div class="flex items-center justify-between text-[11px] pt-2 border-t ${idx === 1 ? 'border-slate-700 text-slate-300' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}">
                        <span class="font-medium truncate">${escapeHtml(logo.name)}</span>
                        <span class="font-mono">${logo.width}×${logo.height}</span>
                      </div>
                    </div>
                  `
                  )
                  .join('')}
              </div>
            </section>

            <!-- 4. Typography System -->
            <section class="card-surface p-5 space-y-4">
              <div class="border-b border-[var(--color-border)] pb-3">
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">4. Typography Hierarchy</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Heading and body font families and weights</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label for="bk-heading-font" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Heading Font Family</label>
                  <select id="bk-heading-font" class="input-field">
                    ${FONT_OPTIONS.map(
                      (f) => `<option value="${escapeHtml(f)}" ${brand.headingFont === f ? 'selected' : ''}>${escapeHtml(f)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div>
                  <label for="bk-heading-weight" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Heading Font Weight</label>
                  <select id="bk-heading-weight" class="input-field">
                    <option value="700" ${String(brand.headingWeight) === '700' ? 'selected' : ''}>700 (Bold)</option>
                    <option value="800" ${String(brand.headingWeight) === '800' ? 'selected' : ''}>800 (ExtraBold)</option>
                    <option value="600" ${String(brand.headingWeight) === '600' ? 'selected' : ''}>600 (SemiBold)</option>
                  </select>
                </div>
                <div>
                  <label for="bk-body-font" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Body Copy Font Family</label>
                  <select id="bk-body-font" class="input-field">
                    ${FONT_OPTIONS.map(
                      (f) => `<option value="${escapeHtml(f)}" ${brand.bodyFont === f ? 'selected' : ''}>${escapeHtml(f)}</option>`
                    ).join('')}
                  </select>
                </div>
                <div>
                  <label for="bk-body-weight" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Body Copy Font Weight</label>
                  <select id="bk-body-weight" class="input-field">
                    <option value="400" ${String(brand.bodyWeight) === '400' ? 'selected' : ''}>400 (Regular)</option>
                    <option value="500" ${String(brand.bodyWeight) === '500' ? 'selected' : ''}>500 (Medium)</option>
                    <option value="600" ${String(brand.bodyWeight) === '600' ? 'selected' : ''}>600 (SemiBold)</option>
                  </select>
                </div>
              </div>
            </section>

            <!-- 5. Product Integrity, Logo Protection & Background Rules -->
            <section class="card-surface p-5 space-y-4">
              <div class="border-b border-[var(--color-border)] pb-3">
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">5. Automated Protection &amp; Validation Rules</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Rules actively enforced in Design Studio and Validation Engine</p>
              </div>

              <div class="space-y-3 text-xs">
                <label class="flex items-start justify-between gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                  <div>
                    <div class="font-semibold text-[var(--color-text-main)]">Product Integrity: Lock Aspect Ratio</div>
                    <div class="text-[11px] text-[var(--color-text-secondary)]">Prevent non-proportional stretching or distortion of product photos on canvas.</div>
                  </div>
                  <input type="checkbox" data-rule-check="lockProductAspectRatio" class="w-4 h-4 accent-blue-600 mt-0.5" ${brand.rules?.lockProductAspectRatio ? 'checked' : ''} />
                </label>

                <label class="flex items-start justify-between gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                  <div>
                    <div class="font-semibold text-[var(--color-text-main)]">Product Integrity: Require Approved Source Assets</div>
                    <div class="text-[11px] text-[var(--color-text-secondary)]">Flag compositions that use Pending or Rejected assets in Validation Engine.</div>
                  </div>
                  <input type="checkbox" data-rule-check="requireApprovedAssets" class="w-4 h-4 accent-blue-600 mt-0.5" ${brand.rules?.requireApprovedAssets ? 'checked' : ''} />
                </label>

                <label class="flex items-start justify-between gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                  <div>
                    <div class="font-semibold text-[var(--color-text-main)]">Logo Protection: Require Official Brand Logo</div>
                    <div class="text-[11px] text-[var(--color-text-secondary)]">Require an approved brand logo with 100% opacity in promotional outputs.</div>
                  </div>
                  <input type="checkbox" data-rule-check="requireBrandLogo" class="w-4 h-4 accent-blue-600 mt-0.5" ${brand.rules?.requireBrandLogo ? 'checked' : ''} />
                </label>

                <label class="flex items-start justify-between gap-3 p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                  <div>
                    <div class="font-semibold text-[var(--color-text-main)]">Background Restriction: Enforce Approved Brand Palette</div>
                    <div class="text-[11px] text-[var(--color-text-secondary)]">Warn if canvas background color deviates from approved Brand Kit surfaces.</div>
                  </div>
                  <input type="checkbox" data-rule-check="restrictBackgroundPalette" class="w-4 h-4 accent-blue-600 mt-0.5" ${brand.rules?.restrictBackgroundPalette ? 'checked' : ''} />
                </label>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div class="p-3 rounded border border-[var(--color-border)]">
                    <label for="bk-clear-space" class="block font-semibold text-[var(--color-text-main)] mb-1">Minimum Logo Clear Space (px)</label>
                    <input type="number" id="bk-clear-space" min="0" max="120" class="input-field" value="${Number(brand.rules?.minLogoClearSpacePx ?? 24)}" />
                  </div>
                  <div class="p-3 rounded border border-[var(--color-border)]">
                    <label for="bk-min-contrast" class="block font-semibold text-[var(--color-text-main)] mb-1">Minimum WCAG Contrast Ratio</label>
                    <input type="number" id="bk-min-contrast" min="3" max="12" step="0.1" class="input-field" value="${Number(brand.rules?.minContrastRatio ?? 4.5)}" />
                  </div>
                </div>
              </div>
            </section>

            <!-- 6. Approved Templates -->
            <section class="card-surface p-5 space-y-3">
              <div class="border-b border-[var(--color-border)] pb-3">
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">6. Approved Brand Templates</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Select templates authorized for ${escapeHtml(brand.name || 'Kopi Senja')} campaigns</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                ${templates
                  .map((tpl) => {
                    const checked = (brand.approvedTemplateIds || []).includes(tpl.id);
                    return `
                      <label class="flex items-center gap-2.5 p-2.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] cursor-pointer">
                        <input type="checkbox" data-approved-tpl="${escapeHtml(tpl.id)}" class="w-4 h-4 accent-blue-600" ${checked ? 'checked' : ''} />
                        <div class="min-w-0">
                          <div class="font-medium text-[var(--color-text-main)] truncate">${escapeHtml(tpl.name)}</div>
                          <div class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(tpl.category)} · ${escapeHtml(tpl.aspectRatio)}</div>
                        </div>
                      </label>
                    `;
                  })
                  .join('')}
              </div>
            </section>
          </div>

          <!-- Right Column: Live Brand Preview (Sticky) -->
          <aside class="lg:col-span-5 space-y-4 sticky top-4" aria-label="Live Brand Preview">
            <div class="card-surface p-5 space-y-4">
              <div class="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                <div>
                  <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Live Brand Preview</h3>
                  <p class="text-xs text-[var(--color-text-secondary)]">Updates immediately as you adjust colors &amp; typography</p>
                </div>
                <span class="badge badge-primary">Real-Time</span>
              </div>

              <!-- Live Poster Card Simulation -->
              <div
                class="rounded-xl p-6 border shadow-sm transition-colors relative overflow-hidden"
                style="background-color:${normalizeHex(brand.backgroundColor, '#F6EFE6')}; border-color:${normalizeHex(brand.accentColor, '#D97706')}44;"
              >
                <div class="flex items-center justify-between mb-5">
                  <div class="px-2.5 py-1 rounded text-[11px] font-bold tracking-wider uppercase" style="background-color:${normalizeHex(brand.primaryColor, '#1E1815')}; color:${normalizeHex(brand.surfaceColor, '#FFFFFF')};">
                    ${escapeHtml(brand.name || 'KOPI SENJA')}
                  </div>
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded" style="background-color:${normalizeHex(brand.accentColor, '#D97706')}26; color:${normalizeHex(brand.primaryColor, '#1E1815')};">
                    Protected Asset Preview
                  </span>
                </div>

                <div class="grid grid-cols-12 gap-4 items-center">
                  <div class="col-span-7 space-y-3">
                    <div
                      style="font-family:'${escapeHtml(brand.headingFont || 'Inter')}', sans-serif; font-weight:${escapeHtml(brand.headingWeight || '800')}; color:${normalizeHex(brand.primaryColor, '#1E1815')}; line-height:1.12;"
                      class="text-2xl tracking-tight"
                    >
                      ${escapeHtml(brand.tagline || 'Temukan Jeda Terbaikmu')}
                    </div>
                    <p
                      style="font-family:'${escapeHtml(brand.bodyFont || 'Inter')}', sans-serif; font-weight:${escapeHtml(brand.bodyWeight || '500')}; color:${normalizeHex(brand.primaryColor, '#1E1815')}CC;"
                      class="text-xs leading-relaxed"
                    >
                      Kopi Susu Original · 100% Arabica Nusantara &amp; Gula Aren Organik.
                    </p>
                    <div class="pt-1 flex flex-wrap items-center gap-2">
                      <span
                        class="px-3 py-1.5 rounded-lg text-sm font-extrabold border"
                        style="background-color:${normalizeHex(brand.surfaceColor, '#FFFFFF')}; color:${normalizeHex(brand.primaryColor, '#1E1815')}; border-color:${normalizeHex(brand.accentColor, '#D97706')}55;"
                      >
                        Rp18.000
                      </span>
                      <span
                        class="px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs"
                        style="background-color:${normalizeHex(brand.secondaryColor, '#9A5B25')}; color:#FFFFFF;"
                      >
                        Pesan Sekarang
                      </span>
                    </div>
                  </div>
                  <div class="col-span-5 flex justify-center">
                    <img
                      src="./assets/images/sample-assets/kopi-susu-original.png"
                      alt="Kopi Susu Original Preview"
                      class="h-44 object-contain drop-shadow-md"
                    />
                  </div>
                </div>
              </div>

              <!-- Typography & Contrast Verification Matrix -->
              <div class="p-3.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2.5 text-xs">
                <div class="font-semibold text-[var(--color-text-main)]">Live Contrast &amp; Rule Matrix</div>
                <div class="flex items-center justify-between">
                  <span class="text-[var(--color-text-secondary)]">Headline on Canvas Background:</span>
                  <span class="font-mono font-semibold ${primaryBgContrast >= minRequiredContrast ? 'text-emerald-700' : 'text-red-700'}">
                    ${primaryBgContrast}:1 (${primaryBgContrast >= 7 ? 'AAA' : primaryBgContrast >= 4.5 ? 'AA Pass' : 'Below AA'})
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[var(--color-text-secondary)]">White Label on Secondary CTA:</span>
                  <span class="font-mono font-semibold ${ctaWhiteContrast >= 4.5 ? 'text-emerald-700' : ctaWhiteContrast >= 3.0 ? 'text-amber-700' : 'text-red-700'}">
                    ${ctaWhiteContrast}:1 (${ctaWhiteContrast >= 4.5 ? 'AA Pass' : ctaWhiteContrast >= 3.0 ? 'AA Large Text' : 'Low Contrast'})
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[var(--color-text-secondary)]">Approved Templates Linked:</span>
                  <span class="font-semibold text-[var(--color-text-main)]">${(brand.approvedTemplateIds || []).length} of ${templates.length}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;

    // Bind live inputs
    container.querySelector('#bk-name')?.addEventListener('input', (e) => {
      brand.name = e.target.value;
    });
    container.querySelector('#bk-tagline')?.addEventListener('input', (e) => {
      brand.tagline = e.target.value;
      renderView();
    });
    container.querySelector('#bk-desc')?.addEventListener('input', (e) => {
      brand.description = e.target.value;
    });
    container.querySelector('#bk-guidelines')?.addEventListener('input', (e) => {
      brand.guidelines = e.target.value;
    });

    container.querySelectorAll('[data-color-picker]').forEach((picker) => {
      picker.addEventListener('input', (e) => {
        const key = picker.getAttribute('data-color-picker');
        brand[key] = e.target.value.toUpperCase();
        renderView();
      });
    });

    container.querySelectorAll('[data-hex-input]').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const key = inp.getAttribute('data-hex-input');
        brand[key] = e.target.value.trim();
        renderView();
      });
    });

    container.querySelector('#bk-heading-font')?.addEventListener('change', (e) => {
      brand.headingFont = e.target.value;
      renderView();
    });
    container.querySelector('#bk-heading-weight')?.addEventListener('change', (e) => {
      brand.headingWeight = e.target.value;
      renderView();
    });
    container.querySelector('#bk-body-font')?.addEventListener('change', (e) => {
      brand.bodyFont = e.target.value;
      renderView();
    });
    container.querySelector('#bk-body-weight')?.addEventListener('change', (e) => {
      brand.bodyWeight = e.target.value;
      renderView();
    });

    container.querySelectorAll('[data-rule-check]').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const ruleKey = chk.getAttribute('data-rule-check');
        brand.rules = brand.rules || {};
        brand.rules[ruleKey] = Boolean(e.target.checked);
        renderView();
      });
    });

    container.querySelector('#bk-clear-space')?.addEventListener('change', (e) => {
      brand.rules.minLogoClearSpacePx = Math.max(0, Number(e.target.value) || 24);
      renderView();
    });

    container.querySelector('#bk-min-contrast')?.addEventListener('change', (e) => {
      brand.rules.minContrastRatio = Math.max(3, Number(e.target.value) || 4.5);
      renderView();
    });

    container.querySelectorAll('[data-approved-tpl]').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const tid = chk.getAttribute('data-approved-tpl');
        const set = new Set(brand.approvedTemplateIds || []);
        if (e.target.checked) set.add(tid);
        else set.delete(tid);
        brand.approvedTemplateIds = Array.from(set);
        renderView();
      });
    });

    container.querySelector('#bk-manage-logos-btn')?.addEventListener('click', () => {
      router.navigate('asset-library');
    });

    container.querySelector('#brand-save-btn')?.addEventListener('click', () => {
      saveCurrentBrand();
    });

    container.querySelector('#brand-apply-to-active-btn')?.addEventListener('click', () => {
      if (!saveCurrentBrand()) return;
      const proj = store.getActiveProject();
      if (!proj) return;
      const comp = JSON.parse(JSON.stringify(proj.composition));
      comp.backgroundColor = normalizeHex(brand.backgroundColor, '#F6EFE6');
      for (const el of comp.elements) {
        if (el.role === 'headline') {
          el.color = normalizeHex(brand.primaryColor, '#1E1815');
          el.fontFamily = brand.headingFont || 'Inter';
        } else if (el.role === 'cta') {
          el.backgroundColor = normalizeHex(brand.secondaryColor, '#9A5B25');
          el.color = '#FFFFFF';
          el.fontFamily = brand.headingFont || 'Inter';
        } else if (el.role === 'price') {
          el.backgroundColor = normalizeHex(brand.surfaceColor, '#FFFFFF');
          el.color = normalizeHex(brand.primaryColor, '#1E1815');
        }
      }
      store.saveProjectComposition(proj.id, comp);
      showToast(`Applied Brand Kit palette & typography to "${proj.name}".`, 'success');
    });

    container.querySelector('#brand-reset-default-btn')?.addEventListener('click', () => {
      showConfirmModal({
        title: 'Reset Brand Kit to Defaults',
        message: 'Restore the original Kopi Senja colors, typography, and protection rules?',
        confirmText: 'Reset Brand Kit',
        onConfirm: () => {
          const def = getDefaultBrandKit();
          Object.assign(brand, def);
          store.updateBrandKit(def);
          showToast('Restored default Kopi Senja Brand Kit.', 'info');
          renderView();
        }
      });
    });
  };

  function saveCurrentBrand() {
    const nameInput = container.querySelector('#bk-name');
    if (nameInput) brand.name = nameInput.value.trim();
    if (!brand.name) {
      showToast('Brand name cannot be empty.', 'error');
      renderView();
      return false;
    }

    const keys = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'surfaceColor'];
    for (const k of keys) {
      if (!isValidHexColor(brand[k])) {
        showToast(`Invalid hexadecimal color for ${k}: "${brand[k]}".`, 'error');
        renderView();
        return false;
      }
      brand[k] = normalizeHex(brand[k]);
    }

    brand.approvedColors = Array.from(
      new Set([
        brand.primaryColor,
        brand.secondaryColor,
        brand.accentColor,
        brand.backgroundColor,
        brand.surfaceColor,
        '#EFE3D3',
        '#EADBC8',
        '#FFFFFF',
        '#181310'
      ])
    );

    store.updateBrandKit(brand);
    showToast(`Saved Brand Kit configuration for "${brand.name}".`, 'success');
    renderView();
    return true;
  }

  renderView();
}
