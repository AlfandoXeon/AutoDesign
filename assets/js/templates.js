/**
 * AutoDesign — Templates Gallery Module
 * Provides realistic live-rendered thumbnails, category & aspect ratio filtering,
 * template details inspection, Use Template, Duplicate Template, and Save Active Composition as Template.
 */

import { store } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  renderMiniComposition,
  openCustomModal,
  closeCustomModal,
  showToast
} from './utils.js';

export const TEMPLATE_CATEGORIES = [
  'All Categories',
  'Product Promotion',
  'Social Media',
  'Marketplace',
  'Food and Beverage',
  'Beauty and Lifestyle',
  'Sale Campaign',
  'Editorial',
  'Minimalist'
];

const tplUiState = {
  search: '',
  category: 'All Categories',
  aspectRatio: 'all'
};

export function openSaveAsTemplateModal(onSaved) {
  const activeProj = store.getActiveProject();
  if (!activeProj) return;

  openCustomModal({
    title: 'Save Active Composition as Template',
    subtitle: `Source Project: ${activeProj.name} (${activeProj.composition.width}×${activeProj.composition.height} px)`,
    bodyHtml: `
      <form id="modal-save-tpl-form" class="space-y-3.5">
        <div>
          <label for="save-tpl-name" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Template Name *</label>
          <input type="text" id="save-tpl-name" class="input-field" value="${escapeHtml(activeProj.name)} Template" required />
        </div>
        <div>
          <label for="save-tpl-cat" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Category</label>
          <select id="save-tpl-cat" class="input-field">
            ${TEMPLATE_CATEGORIES.filter((c) => c !== 'All Categories')
              .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
              .join('')}
          </select>
        </div>
        <div>
          <label for="save-tpl-desc" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Template Description</label>
          <textarea id="save-tpl-desc" rows="2" class="input-field">Reusable brand-compliant layout blueprint with locked product asset placeholders.</textarea>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" id="save-tpl-cancel" class="btn btn-secondary">Cancel</button>
      <button type="button" id="save-tpl-confirm" class="btn btn-primary">Save Template</button>
    `,
    maxWidth: 'max-w-md',
    onMount: () => {
      document.getElementById('save-tpl-cancel')?.addEventListener('click', closeCustomModal);
      document.getElementById('save-tpl-confirm')?.addEventListener('click', () => {
        const name = document.getElementById('save-tpl-name')?.value.trim();
        const category = document.getElementById('save-tpl-cat')?.value || 'Product Promotion';
        const description = document.getElementById('save-tpl-desc')?.value.trim() || '';
        if (!name) return;

        const created = store.saveCompositionAsTemplate({
          name,
          category,
          description,
          composition: activeProj.composition
        });
        closeCustomModal();
        showToast(`Saved "${created.name}" to Templates Gallery.`, 'success');
        if (typeof onSaved === 'function') onSaved(created);
      });
    }
  });
}

export function renderTemplates(container) {
  const state = store.getState();
  const allTemplates = state.templates || [];
  const approvedIds = new Set(state.brandKit?.approvedTemplateIds || []);

  const filtered = allTemplates.filter((tpl) => {
    if (tplUiState.category !== 'All Categories' && tpl.category !== tplUiState.category) return false;
    if (tplUiState.aspectRatio !== 'all' && tpl.aspectRatio !== tplUiState.aspectRatio) return false;
    if (tplUiState.search.trim()) {
      const q = tplUiState.search.trim().toLowerCase();
      const hay = `${tpl.name} ${tpl.category} ${tpl.description} ${tpl.brand}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  container.innerHTML = `
    <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-5">
      <!-- Top Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--color-text-main)]">Campaign Layout Templates</h2>
            <span class="badge badge-primary">${allTemplates.length} Blueprints</span>
          </div>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Templates reference approved source product assets and Brand Kit tokens rather than generating synthetic product imagery.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" id="tpl-save-current-btn" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">bookmark_add</span>
            <span>Save Active Composition as Template</span>
          </button>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Template Categories">
        ${TEMPLATE_CATEGORIES.map((cat) => {
          const count = cat === 'All Categories' ? allTemplates.length : allTemplates.filter((t) => t.category === cat).length;
          const active = tplUiState.category === cat;
          return `
            <button
              type="button"
              role="tab"
              aria-selected="${active}"
              data-tpl-cat="${escapeHtml(cat)}"
              class="px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border transition cursor-pointer ${
                active
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-main)]'
              }"
            >
              <span>${escapeHtml(cat)}</span>
              <span class="ml-1 text-[10px] opacity-80">(${count})</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Search & Aspect Ratio Filter Bar -->
      <div class="card-surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div class="relative flex-1 min-w-[220px] max-w-sm">
          <span class="material-symbols-outlined icon-sm text-[var(--color-text-secondary)] absolute left-2.5 top-2 pointer-events-none" aria-hidden="true">search</span>
          <input
            type="search"
            id="tpl-search-input"
            value="${escapeHtml(tplUiState.search)}"
            placeholder="Search templates by name, style, or campaign..."
            aria-label="Search templates"
            class="input-field pl-8 py-1.5 text-xs"
          />
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-xs text-[var(--color-text-secondary)] mr-1">Aspect Ratio:</span>
          ${[
            { id: 'all', label: 'All Ratios' },
            { id: '1:1', label: '1:1 Square' },
            { id: '4:5', label: '4:5 Portrait' },
            { id: '9:16', label: '9:16 Story' },
            { id: '16:9', label: '16:9 Banner' }
          ]
            .map((r) => {
              const active = tplUiState.aspectRatio === r.id;
              return `
                <button
                  type="button"
                  data-tpl-ratio="${r.id}"
                  class="btn btn-sm ${active ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'btn-secondary'}"
                >
                  ${r.label}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>

      <!-- Templates Grid -->
      ${
        filtered.length === 0
          ? `
            <div class="card-surface p-10 text-center space-y-3">
              <div class="text-sm font-semibold text-[var(--color-text-main)]">No templates match your current filter</div>
              <button type="button" id="tpl-reset-filter-btn" class="btn btn-secondary btn-sm">Reset Filters</button>
            </div>
          `
          : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              ${filtered
                .map((tpl) => {
                  const isApproved = approvedIds.has(tpl.id);
                  return `
                    <article class="card-surface overflow-hidden flex flex-col group hover:border-blue-500/60 transition">
                      <div class="h-56 border-b border-[var(--color-border)] relative cursor-pointer" data-preview-tpl="${escapeHtml(tpl.id)}">
                        ${renderMiniComposition(tpl.composition, { maxWidth: 280, maxHeight: 205 })}
                        <div class="absolute top-2.5 left-2.5 flex items-center gap-1">
                          <span class="badge badge-neutral font-mono">${escapeHtml(tpl.aspectRatio)}</span>
                          ${!tpl.isBuiltin ? '<span class="badge badge-primary">Custom</span>' : ''}
                        </div>
                        <div class="absolute top-2.5 right-2.5">
                          ${
                            isApproved
                              ? '<span class="badge badge-success">Brand Approved</span>'
                              : '<span class="badge badge-neutral">Standard</span>'
                          }
                        </div>
                      </div>

                      <div class="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div class="space-y-1">
                          <div class="text-[11px] font-medium text-blue-600">${escapeHtml(tpl.category)}</div>
                          <h3 class="text-sm font-semibold text-[var(--color-text-main)]">${escapeHtml(tpl.name)}</h3>
                          <p class="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">${escapeHtml(tpl.description)}</p>
                        </div>

                        <div class="space-y-2 pt-2 border-t border-[var(--color-border)]">
                          <div class="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] font-mono">
                            <span>${tpl.width} × ${tpl.height} px</span>
                            <span>${(tpl.composition?.elements || []).length} Layers</span>
                          </div>

                          <div class="flex items-center gap-1.5">
                            <button type="button" data-use-tpl="${escapeHtml(tpl.id)}" class="btn btn-primary btn-sm flex-1">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">play_arrow</span>
                              <span>Use Template</span>
                            </button>
                            <button type="button" data-preview-tpl="${escapeHtml(tpl.id)}" class="btn btn-secondary btn-sm" title="Preview & Details">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">visibility</span>
                            </button>
                            <button type="button" data-dup-tpl="${escapeHtml(tpl.id)}" class="btn btn-secondary btn-sm" title="Duplicate Template">
                              <span class="material-symbols-outlined icon-sm" aria-hidden="true">content_copy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
      }
    </div>
  `;

  // Bind Listeners
  container.querySelector('#tpl-save-current-btn')?.addEventListener('click', () => {
    openSaveAsTemplateModal(() => renderTemplates(container));
  });

  container.querySelectorAll('[data-tpl-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tplUiState.category = btn.getAttribute('data-tpl-cat');
      renderTemplates(container);
    });
  });

  container.querySelectorAll('[data-tpl-ratio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tplUiState.aspectRatio = btn.getAttribute('data-tpl-ratio');
      renderTemplates(container);
    });
  });

  container.querySelector('#tpl-search-input')?.addEventListener('input', (e) => {
    tplUiState.search = e.target.value;
    renderTemplates(container);
    const inp = container.querySelector('#tpl-search-input');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  });

  container.querySelector('#tpl-reset-filter-btn')?.addEventListener('click', () => {
    tplUiState.search = '';
    tplUiState.category = 'All Categories';
    tplUiState.aspectRatio = 'all';
    renderTemplates(container);
  });

  container.querySelectorAll('[data-use-tpl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-use-tpl');
      const tpl = allTemplates.find((t) => t.id === tid);
      if (!tpl) return;
      const newProj = store.createProject({
        name: `${tpl.name} — Campaign`,
        brand: tpl.brand || 'Kopi Senja',
        product: 'Kopi Susu Original',
        width: tpl.width,
        height: tpl.height,
        templateId: tpl.id
      });
      showToast(`Created project "${newProj.name}" from template.`, 'success');
      router.navigate('design-studio', { projectId: newProj.id });
    });
  });

  container.querySelectorAll('[data-dup-tpl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tid = btn.getAttribute('data-dup-tpl');
      const dup = store.duplicateTemplate(tid);
      if (dup) {
        showToast(`Duplicated template "${dup.name}".`, 'success');
        renderTemplates(container);
      }
    });
  });

  container.querySelectorAll('[data-preview-tpl]').forEach((el) => {
    el.addEventListener('click', () => {
      const tid = el.getAttribute('data-preview-tpl');
      const tpl = allTemplates.find((t) => t.id === tid);
      if (!tpl) return;

      openCustomModal({
        title: tpl.name,
        subtitle: `${tpl.category} · ${tpl.aspectRatio} (${tpl.width}×${tpl.height} px)`,
        bodyHtml: `
          <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <div class="md:col-span-7 h-80 rounded-lg border border-[var(--color-border)] overflow-hidden">
              ${renderMiniComposition(tpl.composition, { maxWidth: 380, maxHeight: 300 })}
            </div>
            <div class="md:col-span-5 space-y-3 text-xs">
              <div>
                <div class="font-semibold text-[var(--color-text-main)]">Blueprint Description</div>
                <p class="text-[var(--color-text-secondary)] mt-1 leading-relaxed">${escapeHtml(tpl.description)}</p>
              </div>
              <div class="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1.5">
                <div class="font-semibold text-[var(--color-text-main)]">Composition Structure (${(tpl.composition?.elements || []).length} Layers)</div>
                <ul class="space-y-1 text-[11px] text-[var(--color-text-secondary)]">
                  ${(tpl.composition?.elements || [])
                    .map(
                      (layer) =>
                        `<li class="flex items-center justify-between"><span>• ${escapeHtml(layer.name)}</span><span class="font-mono uppercase">${escapeHtml(layer.type)}</span></li>`
                    )
                    .join('')}
                </ul>
              </div>
            </div>
          </div>
        `,
        footerHtml: `
          <button type="button" id="tpl-modal-close" class="btn btn-secondary">Close</button>
          <button type="button" id="tpl-modal-use" class="btn btn-primary">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">play_arrow</span>
            <span>Use Template in Design Studio</span>
          </button>
        `,
        maxWidth: 'max-w-3xl',
        onMount: () => {
          document.getElementById('tpl-modal-close')?.addEventListener('click', closeCustomModal);
          document.getElementById('tpl-modal-use')?.addEventListener('click', () => {
            closeCustomModal();
            const newProj = store.createProject({
              name: `${tpl.name} — Campaign`,
              brand: tpl.brand || 'Kopi Senja',
              product: 'Kopi Susu Original',
              width: tpl.width,
              height: tpl.height,
              templateId: tpl.id
            });
            showToast(`Loaded "${tpl.name}" into Design Studio.`, 'success');
            router.navigate('design-studio', { projectId: newProj.id });
          });
        }
      });
    });
  });
}
