/**
 * AutoDesign — Dashboard Module
 * Displays workspace KPIs, recent projects with live composition thumbnails,
 * recently used templates, asset approval summary, brand consistency summary, and activity log.
 */

import { store } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  formatRelativeTime,
  getAspectRatioLabel,
  renderMiniComposition,
  showToast
} from './utils.js';

export function renderDashboard(container) {
  const state = store.getState();
  const assets = state.assets || [];
  const projects = state.projects || [];
  const templates = state.templates || [];
  const brand = state.brandKit || {};
  const activities = state.activities || [];

  const totalAssets = assets.length;
  const approvedAssets = assets.filter((a) => a.status === 'approved').length;
  const pendingAssets = assets.filter((a) => a.status === 'pending').length;
  const rejectedAssets = assets.filter((a) => a.status === 'rejected').length;

  const activeProjectsCount = projects.length;
  const readyToExportCount = projects.filter(
    (p) => p.status === 'Validated' || p.status === 'Ready to Export'
  ).length;

  const approvalPct = totalAssets > 0 ? Math.round((approvedAssets / totalAssets) * 100) : 100;

  container.innerHTML = `
    <div class="max-w-[1400px] mx-auto p-5 md:p-6 space-y-6">
      <!-- Welcome Banner & Workflow Pipeline -->
      <section class="card-surface p-5 md:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div class="space-y-2 max-w-2xl">
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-semibold">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">shield_lock</span>
            <span>Asset-Based Design Automation · Active Brand: ${escapeHtml(brand.name || 'Kopi Senja')}</span>
          </div>
          <h2 class="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-text-main)]">
            Welcome to AutoDesign Workspace
          </h2>
          <p class="text-xs md:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            <strong class="text-[var(--color-text-main)]">Core Principle:</strong> "AI does not recreate the product. AI analyzes, arranges, and automates the design." Compose multi-platform promotional materials using immutable, approved product assets and deterministic brand rules.
          </p>
          <!-- Pipeline Steps -->
          <div class="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            <span class="px-2 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-main)]">1. Assets + Brand Rules</span>
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">arrow_forward</span>
            <span class="px-2 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-main)]">2. Design Analysis</span>
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">arrow_forward</span>
            <span class="px-2 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-main)]">3. Composition</span>
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">arrow_forward</span>
            <span class="px-2 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-main)]">4. Validation</span>
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">arrow_forward</span>
            <span class="px-2 py-0.5 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-[var(--color-text-main)]">5. Multi-Platform Output</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <button type="button" id="dash-btn-upload" class="btn btn-secondary">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">upload_file</span>
            <span>Upload Assets</span>
          </button>
          <button type="button" id="dash-btn-open-studio" class="btn btn-secondary">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">draw</span>
            <span>Open Design Studio</span>
          </button>
          <button type="button" id="dash-btn-new-design" class="btn btn-primary">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">add</span>
            <span>Create New Design</span>
          </button>
        </div>
      </section>

      <!-- 4 Key Metrics Cards -->
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Workspace Key Metrics">
        <div class="card-surface p-4 flex items-start justify-between">
          <div>
            <div class="text-xs font-medium text-[var(--color-text-secondary)]">Total Assets</div>
            <div class="text-2xl font-bold text-[var(--color-text-main)] mt-1">${totalAssets}</div>
            <div class="text-[11px] text-[var(--color-text-secondary)] mt-1">
              ${assets.filter((a) => a.isBuiltin).length} built-in · ${assets.filter((a) => !a.isBuiltin).length} uploaded
            </div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <span class="material-symbols-outlined" aria-hidden="true">inventory_2</span>
          </div>
        </div>

        <div class="card-surface p-4 flex items-start justify-between">
          <div>
            <div class="text-xs font-medium text-[var(--color-text-secondary)]">Approved Assets</div>
            <div class="text-2xl font-bold text-emerald-700 mt-1">${approvedAssets}</div>
            <div class="text-[11px] text-[var(--color-text-secondary)] mt-1">
              ${approvalPct}% source-locked &amp; verified
            </div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <span class="material-symbols-outlined" aria-hidden="true">verified</span>
          </div>
        </div>

        <div class="card-surface p-4 flex items-start justify-between">
          <div>
            <div class="text-xs font-medium text-[var(--color-text-secondary)]">Active Projects</div>
            <div class="text-2xl font-bold text-[var(--color-text-main)] mt-1">${activeProjectsCount}</div>
            <div class="text-[11px] text-[var(--color-text-secondary)] mt-1">
              Saved in local workspace
            </div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <span class="material-symbols-outlined" aria-hidden="true">folder_open</span>
          </div>
        </div>

        <div class="card-surface p-4 flex items-start justify-between">
          <div>
            <div class="text-xs font-medium text-[var(--color-text-secondary)]">Ready-to-Export Designs</div>
            <div class="text-2xl font-bold text-blue-600 mt-1">${readyToExportCount}</div>
            <div class="text-[11px] text-[var(--color-text-secondary)] mt-1">
              Passed critical QA checks
            </div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <span class="material-symbols-outlined" aria-hidden="true">output</span>
          </div>
        </div>
      </section>

      <!-- Recent Projects Section -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Recent Projects</h3>
            <p class="text-xs text-[var(--color-text-secondary)]">Live composition thumbnails rendered directly from project layers</p>
          </div>
          <button type="button" data-nav="projects" class="btn btn-secondary btn-sm">
            <span>View All Projects</span>
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">arrow_forward</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${projects
            .slice(0, 3)
            .map((proj) => {
              const isCurrent = proj.id === state.activeProjectId;
              const statusBadge =
                proj.status === 'Validated'
                  ? '<span class="badge badge-success"><span class="material-symbols-outlined icon-sm" aria-hidden="true">check_circle</span>Validated</span>'
                  : proj.status === 'Ready to Export'
                  ? '<span class="badge badge-primary"><span class="material-symbols-outlined icon-sm" aria-hidden="true">check</span>Ready to Export</span>'
                  : proj.status === 'Needs Review'
                  ? '<span class="badge badge-warning"><span class="material-symbols-outlined icon-sm" aria-hidden="true">warning</span>Needs Review</span>'
                  : '<span class="badge badge-neutral">In Progress</span>';

              return `
                <article class="card-surface overflow-hidden flex flex-col group hover:border-blue-500/60 transition">
                  <div class="h-52 border-b border-[var(--color-border)] relative cursor-pointer" data-open-project="${escapeHtml(proj.id)}">
                    ${renderMiniComposition(proj.composition, { maxWidth: 300, maxHeight: 192 })}
                    <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      ${isCurrent ? '<span class="badge badge-primary">Active in Studio</span>' : ''}
                      ${proj.isSample ? '<span class="badge badge-neutral">Sample</span>' : ''}
                    </div>
                    <div class="absolute top-2.5 right-2.5">
                      ${statusBadge}
                    </div>
                  </div>
                  <div class="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div class="flex items-start justify-between gap-2">
                        <h4 class="text-sm font-semibold text-[var(--color-text-main)] group-hover:text-blue-600 transition cursor-pointer" data-open-project="${escapeHtml(proj.id)}">
                          ${escapeHtml(proj.name)}
                        </h4>
                      </div>
                      <div class="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-text-secondary)]">
                        <span>${escapeHtml(proj.brand || 'Kopi Senja')}</span>
                        <span>·</span>
                        <span>${escapeHtml(getAspectRatioLabel(proj.composition?.width, proj.composition?.height))}</span>
                        <span>·</span>
                        <span>${escapeHtml(formatRelativeTime(proj.updatedAt))}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                      <button type="button" data-open-project="${escapeHtml(proj.id)}" class="btn btn-primary btn-sm flex-1">
                        <span class="material-symbols-outlined icon-sm" aria-hidden="true">edit_square</span>
                        <span>Open in Studio</span>
                      </button>
                      <button type="button" data-validate-project="${escapeHtml(proj.id)}" class="btn btn-secondary btn-sm" title="Validate composition">
                        <span class="material-symbols-outlined icon-sm" aria-hidden="true">verified</span>
                      </button>
                      <button type="button" data-export-project="${escapeHtml(proj.id)}" class="btn btn-secondary btn-sm" title="Export multi-platform">
                        <span class="material-symbols-outlined icon-sm" aria-hidden="true">ios_share</span>
                      </button>
                    </div>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>

      <!-- Middle Grid: Asset Approval Summary & Brand Consistency Summary -->
      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Asset Approval Summary -->
        <div class="card-surface p-5 flex flex-col justify-between gap-4">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Asset Approval Summary</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Source-of-truth product &amp; brand asset governance</p>
              </div>
              <button type="button" data-nav="asset-library" class="btn btn-secondary btn-sm">Manage Assets</button>
            </div>

            <!-- Stacked Bar -->
            <div class="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
              <div style="width:${totalAssets ? (approvedAssets / totalAssets) * 100 : 100}%" class="bg-emerald-600" title="Approved"></div>
              <div style="width:${totalAssets ? (pendingAssets / totalAssets) * 100 : 0}%" class="bg-amber-500" title="Pending"></div>
              <div style="width:${totalAssets ? (rejectedAssets / totalAssets) * 100 : 0}%" class="bg-red-600" title="Rejected"></div>
            </div>

            <div class="grid grid-cols-3 gap-2.5 pt-1">
              <div class="p-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div class="text-[11px] text-[var(--color-text-secondary)]">Approved</div>
                <div class="text-base font-bold text-emerald-700 mt-0.5">${approvedAssets}</div>
              </div>
              <div class="p-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div class="text-[11px] text-[var(--color-text-secondary)]">Pending Review</div>
                <div class="text-base font-bold text-amber-700 mt-0.5">${pendingAssets}</div>
              </div>
              <div class="p-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
                <div class="text-[11px] text-[var(--color-text-secondary)]">Rejected</div>
                <div class="text-base font-bold text-red-700 mt-0.5">${rejectedAssets}</div>
              </div>
            </div>

            <!-- Pending/Actionable Assets List -->
            <div class="space-y-1.5 pt-1">
              <div class="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Assets Requiring Attention</div>
              ${
                assets.filter((a) => a.status !== 'approved').length === 0
                  ? `<div class="p-3 rounded border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-800 flex items-center gap-2">
                       <span class="material-symbols-outlined icon-sm" aria-hidden="true">check_circle</span>
                       <span>All ${totalAssets} workspace assets are approved for campaign use.</span>
                     </div>`
                  : assets
                      .filter((a) => a.status !== 'approved')
                      .slice(0, 3)
                      .map(
                        (a) => `
                        <div class="flex items-center justify-between gap-2 p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <img src="${escapeHtml(a.src)}" alt="${escapeHtml(a.name)}" class="w-8 h-8 rounded object-contain bg-slate-100 border border-[var(--color-border)] shrink-0" />
                            <div class="min-w-0">
                              <div class="font-medium text-[var(--color-text-main)] truncate">${escapeHtml(a.name)}</div>
                              <div class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(a.category)} · ${escapeHtml(a.status.toUpperCase())}</div>
                            </div>
                          </div>
                          <div class="flex items-center gap-1.5 shrink-0">
                            <button type="button" data-quick-approve="${escapeHtml(a.id)}" class="btn btn-secondary btn-sm text-emerald-700">Approve</button>
                            <button type="button" data-inspect-asset="${escapeHtml(a.id)}" class="btn btn-ghost btn-sm">Inspect</button>
                          </div>
                        </div>
                      `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>

        <!-- Brand Consistency Summary -->
        <div class="card-surface p-5 flex flex-col justify-between gap-4">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Brand Consistency Summary</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Active identity rules enforced across Design Studio &amp; Export</p>
              </div>
              <button type="button" data-nav="brand-kit" class="btn btn-secondary btn-sm">Configure Brand Kit</button>
            </div>

            <!-- Palette Swatches & Typography -->
            <div class="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-xs font-semibold text-[var(--color-text-main)]">${escapeHtml(brand.name || 'Kopi Senja')}</div>
                <div class="text-[11px] text-[var(--color-text-secondary)]">Typography: ${escapeHtml(brand.headingFont || 'Inter')} (${escapeHtml(brand.headingWeight || '800')} / ${escapeHtml(brand.bodyWeight || '500')})</div>
              </div>
              <div class="flex items-center gap-1.5">
                ${[brand.primaryColor, brand.secondaryColor, brand.accentColor, brand.backgroundColor, brand.surfaceColor]
                  .filter(Boolean)
                  .map(
                    (hex) => `
                    <div class="w-7 h-7 rounded border border-slate-300 shadow-2xs" style="background-color:${escapeHtml(hex)}" title="${escapeHtml(hex)}"></div>
                  `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Enforced Rule Badges -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div class="p-2.5 rounded border border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[var(--color-text-secondary)]">Product Aspect Lock</span>
                <span class="badge ${brand.rules?.lockProductAspectRatio ? 'badge-success' : 'badge-neutral'}">
                  ${brand.rules?.lockProductAspectRatio ? 'Enforced' : 'Optional'}
                </span>
              </div>
              <div class="p-2.5 rounded border border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[var(--color-text-secondary)]">Approved Assets Only</span>
                <span class="badge ${brand.rules?.requireApprovedAssets ? 'badge-success' : 'badge-neutral'}">
                  ${brand.rules?.requireApprovedAssets ? 'Required' : 'Optional'}
                </span>
              </div>
              <div class="p-2.5 rounded border border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[var(--color-text-secondary)]">Min Text Contrast (WCAG)</span>
                <span class="badge badge-primary">${Number(brand.rules?.minContrastRatio || 4.5).toFixed(1)}:1 AA</span>
              </div>
              <div class="p-2.5 rounded border border-[var(--color-border)] flex items-center justify-between">
                <span class="text-[var(--color-text-secondary)]">Logo Clear Space</span>
                <span class="badge badge-primary">${Number(brand.rules?.minLogoClearSpacePx || 24)} px</span>
              </div>
            </div>
          </div>

          <div class="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
            <span class="text-[var(--color-text-secondary)]">Run deterministic check on active project</span>
            <button type="button" data-nav="validation" class="btn btn-secondary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">rule</span>
              <span>Open Validation Engine</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Bottom Grid: Recently Used Templates & Recent Activity -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Recently Used Templates (2 cols) -->
        <div class="lg:col-span-2 card-surface p-5 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Recently Used Templates</h3>
              <p class="text-xs text-[var(--color-text-secondary)]">Approved layout blueprints with locked product placeholders</p>
            </div>
            <button type="button" data-nav="templates" class="btn btn-secondary btn-sm">Browse All Templates</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            ${templates
              .slice(0, 3)
              .map(
                (tpl) => `
                <div class="rounded-md border border-[var(--color-border)] overflow-hidden flex flex-col bg-[var(--color-surface)] hover:border-blue-500/60 transition">
                  <div class="h-36 border-b border-[var(--color-border)]">
                    ${renderMiniComposition(tpl.composition, { maxWidth: 200, maxHeight: 132 })}
                  </div>
                  <div class="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <div class="text-xs font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(tpl.name)}</div>
                      <div class="text-[11px] text-[var(--color-text-secondary)] mt-0.5">${escapeHtml(tpl.category)} · ${escapeHtml(tpl.aspectRatio)}</div>
                    </div>
                    <button type="button" data-use-template="${escapeHtml(tpl.id)}" class="btn btn-secondary btn-sm w-full">
                      <span class="material-symbols-outlined icon-sm" aria-hidden="true">play_arrow</span>
                      <span>Use Template</span>
                    </button>
                  </div>
                </div>
              `
              )
              .join('')}
          </div>
        </div>

        <!-- Recent Activity Log (1 col) -->
        <div class="card-surface p-5 flex flex-col justify-between gap-3">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-[var(--color-text-main)]">Recent Activity</h3>
                <p class="text-xs text-[var(--color-text-secondary)]">Workspace audit trail</p>
              </div>
              <span class="badge badge-neutral">Local Log</span>
            </div>

            <div class="divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto pr-1">
              ${activities
                .slice(0, 7)
                .map((act) => {
                  const icon =
                    act.type === 'validation'
                      ? 'verified'
                      : act.type === 'asset'
                      ? 'photo_library'
                      : act.type === 'export'
                      ? 'output'
                      : act.type === 'brand'
                      ? 'palette'
                      : 'edit_note';
                  return `
                    <div class="py-2.5 flex items-start gap-2.5 text-xs">
                      <span class="material-symbols-outlined icon-sm text-[var(--color-text-secondary)] mt-0.5 shrink-0" aria-hidden="true">${icon}</span>
                      <div class="min-w-0 flex-1">
                        <div class="text-[var(--color-text-main)] leading-snug">${escapeHtml(act.title)}</div>
                        <div class="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--color-text-secondary)]">
                          <span>${escapeHtml(formatRelativeTime(act.timestamp))}</span>
                          <span>·</span>
                          <span class="${act.isSample ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}">
                            ${act.isSample ? '[Sample Data]' : '[User Action]'}
                          </span>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  // Bind Dashboard Actions
  container.querySelector('#dash-btn-upload')?.addEventListener('click', () => {
    router.navigate('asset-library', { openUpload: '1' });
  });

  container.querySelector('#dash-btn-open-studio')?.addEventListener('click', () => {
    router.navigate('design-studio');
  });

  container.querySelector('#dash-btn-new-design')?.addEventListener('click', () => {
    const newProj = store.createProject({
      name: `Kopi Senja Promo #${projects.length + 1}`,
      brand: brand.name || 'Kopi Senja',
      product: 'Kopi Susu Original',
      width: 1080,
      height: 1080
    });
    showToast(`Created "${newProj.name}" and opened in Design Studio.`, 'success');
    router.navigate('design-studio', { projectId: newProj.id });
  });

  container.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      router.navigate(btn.getAttribute('data-nav'));
    });
  });

  container.querySelectorAll('[data-open-project]').forEach((el) => {
    el.addEventListener('click', () => {
      const pid = el.getAttribute('data-open-project');
      store.setActiveProject(pid);
      router.navigate('design-studio', { projectId: pid });
    });
  });

  container.querySelectorAll('[data-validate-project]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-validate-project');
      store.setActiveProject(pid);
      router.navigate('validation', { projectId: pid, autorun: '1' });
    });
  });

  container.querySelectorAll('[data-export-project]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-export-project');
      store.setActiveProject(pid);
      router.navigate('export', { projectId: pid });
    });
  });

  container.querySelectorAll('[data-quick-approve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const aid = btn.getAttribute('data-quick-approve');
      const updated = store.updateAsset(aid, { status: 'approved' });
      if (updated) {
        showToast(`Asset "${updated.name}" marked as Approved.`, 'success');
        renderDashboard(container);
      }
    });
  });

  container.querySelectorAll('[data-inspect-asset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const aid = btn.getAttribute('data-inspect-asset');
      router.navigate('asset-library', { assetId: aid });
    });
  });

  container.querySelectorAll('[data-use-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-use-template');
      const tpl = templates.find((t) => t.id === tid);
      if (!tpl) return;
      const newProj = store.createProject({
        name: `${tpl.name} — Campaign`,
        brand: tpl.brand || 'Kopi Senja',
        product: 'Kopi Susu Original',
        width: tpl.width,
        height: tpl.height,
        templateId: tpl.id
      });
      showToast(`Loaded template "${tpl.name}" into Design Studio.`, 'success');
      router.navigate('design-studio', { projectId: newProj.id });
    });
  });
}
