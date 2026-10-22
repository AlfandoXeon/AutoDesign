/**
 * AutoDesign — Projects & Version History Module
 * Manages project creation, renaming, duplication, deletion with confirmation,
 * grid/list views, real composition thumbnails, and local version snapshot restoration.
 */

import { store } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  formatDate,
  formatRelativeTime,
  getAspectRatioLabel,
  renderMiniComposition,
  openCustomModal,
  closeCustomModal,
  showConfirmModal,
  showToast
} from './utils.js';

const projUiState = {
  search: '',
  statusFilter: 'all',
  viewMode: 'grid',
  selectedHistoryProjectId: null
};

export function openCreateProjectModal(onCreated) {
  const state = store.getState();
  const templates = state.templates || [];
  const brandName = state.brandKit?.name || 'Kopi Senja';

  openCustomModal({
    title: 'Create New Promotional Project',
    subtitle: 'Initialize an asset-locked campaign composition from a blueprint or custom dimensions',
    bodyHtml: `
      <form id="modal-create-proj-form" class="space-y-3.5">
        <div>
          <label for="cp-name" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Project Title *</label>
          <input type="text" id="cp-name" class="input-field" value="Kopi Senja — Seasonal Promo" required />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="cp-brand" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Brand Association</label>
            <input type="text" id="cp-brand" class="input-field" value="${escapeHtml(brandName)}" />
          </div>
          <div>
            <label for="cp-product" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Featured Product</label>
            <input type="text" id="cp-product" class="input-field" value="Kopi Susu Original" />
          </div>
        </div>
        <div>
          <label for="cp-template" class="block text-xs font-medium text-[var(--color-text-main)] mb-1">Starting Blueprint Template</label>
          <select id="cp-template" class="input-field">
            ${templates
              .map(
                (t) =>
                  `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${t.width}×${t.height} · ${escapeHtml(t.aspectRatio)})</option>`
              )
              .join('')}
          </select>
        </div>
      </form>
    `,
    footerHtml: `
      <button type="button" id="cp-cancel" class="btn btn-secondary">Cancel</button>
      <button type="button" id="cp-submit" class="btn btn-primary">
        <span class="material-symbols-outlined icon-sm" aria-hidden="true">add</span>
        <span>Create &amp; Open in Studio</span>
      </button>
    `,
    maxWidth: 'max-w-md',
    onMount: () => {
      document.getElementById('cp-cancel')?.addEventListener('click', closeCustomModal);
      document.getElementById('cp-submit')?.addEventListener('click', () => {
        const name = document.getElementById('cp-name')?.value.trim();
        const brand = document.getElementById('cp-brand')?.value.trim() || brandName;
        const product = document.getElementById('cp-product')?.value.trim() || 'Kopi Susu Original';
        const templateId = document.getElementById('cp-template')?.value;
        const tpl = templates.find((t) => t.id === templateId);

        if (!name) return;
        const created = store.createProject({
          name,
          brand,
          product,
          width: tpl?.width || 1080,
          height: tpl?.height || 1080,
          templateId
        });
        closeCustomModal();
        showToast(`Created project "${created.name}".`, 'success');
        if (typeof onCreated === 'function') {
          onCreated(created);
        } else {
          router.navigate('design-studio', { projectId: created.id });
        }
      });
    }
  });
}

export function renderProjects(container) {
  const state = store.getState();
  const projects = state.projects || [];

  if (!projUiState.selectedHistoryProjectId || !projects.some((p) => p.id === projUiState.selectedHistoryProjectId)) {
    projUiState.selectedHistoryProjectId = state.activeProjectId || projects[0]?.id || null;
  }

  const filtered = projects.filter((p) => {
    if (projUiState.statusFilter !== 'all' && p.status !== projUiState.statusFilter) return false;
    if (projUiState.search.trim()) {
      const q = projUiState.search.trim().toLowerCase();
      const hay = `${p.name} ${p.brand} ${p.product} ${p.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const inspectedProject = projects.find((p) => p.id === projUiState.selectedHistoryProjectId) || projects[0] || null;

  container.innerHTML = `
    <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--color-text-main)]">Projects &amp; Version Snapshots</h2>
            <span class="badge badge-primary">${projects.length} Projects</span>
          </div>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Manage saved campaign compositions and restore local point-in-time version snapshots.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" id="proj-create-btn" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">create_new_folder</span>
            <span>Create New Project</span>
          </button>
        </div>
      </div>

      <!-- Filter, Search & View Mode Bar -->
      <div class="card-surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div class="relative flex-1 min-w-[200px] max-w-xs">
            <span class="material-symbols-outlined icon-sm text-[var(--color-text-secondary)] absolute left-2.5 top-2 pointer-events-none" aria-hidden="true">search</span>
            <input
              type="search"
              id="proj-search-input"
              value="${escapeHtml(projUiState.search)}"
              placeholder="Search projects by title, brand, or product..."
              aria-label="Search projects"
              class="input-field pl-8 py-1.5 text-xs"
            />
          </div>

          <select id="proj-status-filter" aria-label="Filter projects by status" class="input-field w-auto py-1.5 text-xs">
            <option value="all" ${projUiState.statusFilter === 'all' ? 'selected' : ''}>Status: All Projects</option>
            <option value="Validated" ${projUiState.statusFilter === 'Validated' ? 'selected' : ''}>Validated</option>
            <option value="Ready to Export" ${projUiState.statusFilter === 'Ready to Export' ? 'selected' : ''}>Ready to Export</option>
            <option value="In Progress" ${projUiState.statusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Needs Review" ${projUiState.statusFilter === 'Needs Review' ? 'selected' : ''}>Needs Review</option>
          </select>
        </div>

        <div class="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
          <button type="button" data-proj-view="grid" class="px-2.5 py-1.5 text-xs ${projUiState.viewMode === 'grid' ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}" aria-label="Grid view">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">grid_view</span>
          </button>
          <button type="button" data-proj-view="list" class="px-2.5 py-1.5 text-xs border-l border-[var(--color-border)] ${projUiState.viewMode === 'list' ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}" aria-label="List view">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">view_list</span>
          </button>
        </div>
      </div>

      <!-- Main Grid: Projects (8 cols) + Version Snapshot Inspector (4 cols) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-8">
          ${
            filtered.length === 0
              ? `<div class="card-surface p-10 text-center text-xs text-[var(--color-text-secondary)]">No projects match your current filter.</div>`
              : projUiState.viewMode === 'grid'
              ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${filtered
                    .map((proj) => {
                      const isSel = proj.id === projUiState.selectedHistoryProjectId;
                      const statusBadge =
                        proj.status === 'Validated'
                          ? '<span class="badge badge-success">Validated</span>'
                          : proj.status === 'Ready to Export'
                          ? '<span class="badge badge-primary">Ready to Export</span>'
                          : proj.status === 'Needs Review'
                          ? '<span class="badge badge-warning">Needs Review</span>'
                          : '<span class="badge badge-neutral">In Progress</span>';

                      return `
                        <article
                          data-select-proj-history="${escapeHtml(proj.id)}"
                          class="card-surface overflow-hidden flex flex-col cursor-pointer transition ${
                            isSel ? 'ring-2 ring-[#2563EB] border-[#2563EB]' : 'hover:border-slate-300'
                          }"
                        >
                          <div class="h-52 border-b border-[var(--color-border)] relative">
                            ${renderMiniComposition(proj.composition, { maxWidth: 320, maxHeight: 192 })}
                            <div class="absolute top-2.5 left-2.5 flex gap-1">
                              ${proj.id === state.activeProjectId ? '<span class="badge badge-primary">Active</span>' : ''}
                              ${proj.isSample ? '<span class="badge badge-neutral">Sample Data</span>' : '<span class="badge badge-neutral">User Project</span>'}
                            </div>
                            <div class="absolute top-2.5 right-2.5">${statusBadge}</div>
                          </div>

                          <div class="p-4 space-y-3 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">${escapeHtml(proj.name)}</h3>
                              <div class="text-[11px] text-[var(--color-text-secondary)] mt-1 flex flex-wrap items-center gap-1.5">
                                <span>Brand: <strong>${escapeHtml(proj.brand)}</strong></span>
                                <span>·</span>
                                <span>${escapeHtml(getAspectRatioLabel(proj.composition?.width, proj.composition?.height))}</span>
                                <span>·</span>
                                <span>Modified ${escapeHtml(formatRelativeTime(proj.updatedAt))}</span>
                              </div>
                            </div>

                            <div class="pt-2 border-t border-[var(--color-border)] flex items-center justify-between gap-1.5" onclick="event.stopPropagation()">
                              <button type="button" data-open-studio="${escapeHtml(proj.id)}" class="btn btn-primary btn-sm flex-1">
                                <span class="material-symbols-outlined icon-sm" aria-hidden="true">edit_square</span>
                                <span>Open in Studio</span>
                              </button>
                              <button type="button" data-rename-proj="${escapeHtml(proj.id)}" class="btn btn-secondary btn-sm" title="Rename Project">
                                <span class="material-symbols-outlined icon-sm" aria-hidden="true">edit</span>
                              </button>
                              <button type="button" data-dup-proj="${escapeHtml(proj.id)}" class="btn btn-secondary btn-sm" title="Duplicate Project">
                                <span class="material-symbols-outlined icon-sm" aria-hidden="true">content_copy</span>
                              </button>
                              <button type="button" data-del-proj="${escapeHtml(proj.id)}" class="btn btn-danger btn-sm" title="Delete Project" ${projects.length <= 1 ? 'disabled' : ''}>
                                <span class="material-symbols-outlined icon-sm" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      `;
                    })
                    .join('')}
                </div>
              `
              : `
                <div class="card-surface overflow-x-auto">
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr class="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                        <th class="py-2.5 px-3">Project</th>
                        <th class="py-2.5 px-3">Brand</th>
                        <th class="py-2.5 px-3">Dimensions</th>
                        <th class="py-2.5 px-3">Status</th>
                        <th class="py-2.5 px-3">Last Modified</th>
                        <th class="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--color-border)]">
                      ${filtered
                        .map((proj) => `
                          <tr data-select-proj-history="${escapeHtml(proj.id)}" class="cursor-pointer hover:bg-[var(--color-surface-subtle)]">
                            <td class="py-2.5 px-3 font-semibold text-[var(--color-text-main)]">${escapeHtml(proj.name)}</td>
                            <td class="py-2.5 px-3 text-[var(--color-text-secondary)]">${escapeHtml(proj.brand)}</td>
                            <td class="py-2.5 px-3 font-mono">${proj.composition?.width}×${proj.composition?.height}</td>
                            <td class="py-2.5 px-3"><span class="badge badge-neutral">${escapeHtml(proj.status)}</span></td>
                            <td class="py-2.5 px-3 text-[var(--color-text-secondary)]">${escapeHtml(formatDate(proj.updatedAt))}</td>
                            <td class="py-2.5 px-3 text-right" onclick="event.stopPropagation()">
                              <button type="button" data-open-studio="${escapeHtml(proj.id)}" class="btn btn-primary btn-sm">Open</button>
                              <button type="button" data-dup-proj="${escapeHtml(proj.id)}" class="btn btn-secondary btn-sm">Duplicate</button>
                            </td>
                          </tr>
                        `)
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>

        <!-- Right 4 Cols: Version Snapshots & History Inspector -->
        <aside class="lg:col-span-4 card-surface p-4 space-y-4 sticky top-4" aria-label="Project Version History">
          ${
            !inspectedProject
              ? `<div class="py-8 text-center text-xs text-[var(--color-text-secondary)]">Select a project to inspect version snapshots.</div>`
              : `
                <div class="border-b border-[var(--color-border)] pb-3 flex items-start justify-between gap-2">
                  <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Version Snapshots</div>
                    <h3 class="text-sm font-semibold text-[var(--color-text-main)] mt-0.5">${escapeHtml(inspectedProject.name)}</h3>
                  </div>
                  <span class="badge badge-primary">${(inspectedProject.snapshots || []).length} Versions</span>
                </div>

                <button type="button" id="proj-save-new-snapshot-btn" class="btn btn-secondary btn-sm w-full">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">add_circle</span>
                  <span>Create Snapshot of Current State</span>
                </button>

                <div class="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  ${(inspectedProject.snapshots || [])
                    .map(
                      (snap) => `
                      <div class="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] space-y-2.5">
                        <div class="h-32 rounded border border-[var(--color-border)] overflow-hidden bg-white">
                          ${renderMiniComposition(snap.composition, { maxWidth: 240, maxHeight: 118 })}
                        </div>
                        <div class="space-y-1">
                          <div class="flex items-center justify-between gap-1">
                            <span class="text-xs font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(snap.label)}</span>
                            <span class="text-[10px] font-semibold ${snap.isSample ? 'text-amber-700' : 'text-blue-700'}">
                              ${snap.isSample ? '[Sample]' : '[User Saved]'}
                            </span>
                          </div>
                          <div class="text-[11px] text-[var(--color-text-secondary)]">${escapeHtml(formatDate(snap.createdAt))}</div>
                        </div>
                        <button type="button" data-restore-proj-snap="${escapeHtml(snap.id)}" class="btn btn-secondary btn-sm w-full">
                          <span class="material-symbols-outlined icon-sm" aria-hidden="true">restore</span>
                          <span>Restore This Snapshot</span>
                        </button>
                      </div>
                    `
                    )
                    .join('')}
                </div>
              `
          }
        </aside>
      </div>
    </div>
  `;

  // Bind Listeners
  container.querySelector('#proj-create-btn')?.addEventListener('click', () => {
    openCreateProjectModal((created) => {
      router.navigate('design-studio', { projectId: created.id });
    });
  });

  container.querySelector('#proj-search-input')?.addEventListener('input', (e) => {
    projUiState.search = e.target.value;
    renderProjects(container);
    const inp = container.querySelector('#proj-search-input');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  });

  container.querySelector('#proj-status-filter')?.addEventListener('change', (e) => {
    projUiState.statusFilter = e.target.value;
    renderProjects(container);
  });

  container.querySelectorAll('[data-proj-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      projUiState.viewMode = btn.getAttribute('data-proj-view');
      renderProjects(container);
    });
  });

  container.querySelectorAll('[data-select-proj-history]').forEach((el) => {
    el.addEventListener('click', () => {
      projUiState.selectedHistoryProjectId = el.getAttribute('data-select-proj-history');
      renderProjects(container);
    });
  });

  container.querySelectorAll('[data-open-studio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-open-studio');
      store.setActiveProject(pid);
      router.navigate('design-studio', { projectId: pid });
    });
  });

  container.querySelectorAll('[data-rename-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-rename-proj');
      const target = projects.find((p) => p.id === pid);
      if (!target) return;
      openCustomModal({
        title: 'Rename Project',
        bodyHtml: `
          <div>
            <label for="proj-rename-field" class="block text-xs font-medium mb-1">New Project Title</label>
            <input type="text" id="proj-rename-field" class="input-field" value="${escapeHtml(target.name)}" />
          </div>
        `,
        footerHtml: `
          <button type="button" id="proj-rename-cancel" class="btn btn-secondary">Cancel</button>
          <button type="button" id="proj-rename-ok" class="btn btn-primary">Save</button>
        `,
        maxWidth: 'max-w-sm',
        onMount: () => {
          document.getElementById('proj-rename-cancel')?.addEventListener('click', closeCustomModal);
          document.getElementById('proj-rename-ok')?.addEventListener('click', () => {
            const val = document.getElementById('proj-rename-field')?.value.trim();
            if (val) {
              store.renameProject(pid, val);
              closeCustomModal();
              showToast(`Renamed project to "${val}".`, 'success');
              renderProjects(container);
            }
          });
        }
      });
    });
  });

  container.querySelectorAll('[data-dup-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-dup-proj');
      const dup = store.duplicateProject(pid);
      if (dup) {
        projUiState.selectedHistoryProjectId = dup.id;
        showToast(`Duplicated project as "${dup.name}".`, 'success');
        renderProjects(container);
      }
    });
  });

  container.querySelectorAll('[data-del-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-del-proj');
      const target = projects.find((p) => p.id === pid);
      if (!target) return;
      showConfirmModal({
        title: 'Delete Project',
        message: `Are you sure you want to permanently delete "${target.name}" and its version snapshots from local storage?`,
        confirmText: 'Delete Project',
        danger: true,
        onConfirm: () => {
          if (store.deleteProject(pid)) {
            showToast(`Deleted "${target.name}".`, 'info');
            renderProjects(container);
          }
        }
      });
    });
  });

  container.querySelector('#proj-save-new-snapshot-btn')?.addEventListener('click', () => {
    if (!inspectedProject) return;
    const label = `v1.${(inspectedProject.snapshots || []).length} — Manual Checkpoint`;
    store.saveProjectComposition(inspectedProject.id, inspectedProject.composition, {
      createSnapshot: true,
      snapshotLabel: label,
      preserveValidated: true
    });
    showToast(`Saved snapshot "${label}".`, 'success');
    renderProjects(container);
  });

  container.querySelectorAll('[data-restore-proj-snap]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!inspectedProject) return;
      const snapId = btn.getAttribute('data-restore-proj-snap');
      showConfirmModal({
        title: 'Restore Version Snapshot',
        message: `Restore "${inspectedProject.name}" to this snapshot? You can continue editing it immediately in Design Studio.`,
        confirmText: 'Restore Snapshot',
        onConfirm: () => {
          store.restoreSnapshot(inspectedProject.id, snapId);
          showToast(`Restored snapshot in "${inspectedProject.name}".`, 'success');
          renderProjects(container);
        }
      });
    });
  });
}
