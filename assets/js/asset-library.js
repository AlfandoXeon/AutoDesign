/**
 * AutoDesign — Asset Library Module
 * Manages source-of-truth product photos, transparent PNGs, logos, typography, colors, icons, backgrounds, templates, and 3D models.
 */

import { store } from './store.js';
import { router } from './router.js';
import {
  escapeHtml,
  formatBytes,
  formatDate,
  showToast,
  showConfirmModal,
  uid
} from './utils.js';

export const ASSET_CATEGORIES = [
  'All Categories',
  'Product Photos',
  'Transparent PNGs',
  'Logos',
  'Typography',
  'Brand Colors',
  'Icons',
  'Backgrounds',
  'Templates',
  '3D Models'
];

const uiState = {
  search: '',
  category: 'All Categories',
  status: 'all',
  source: 'all',
  sortBy: 'date-desc',
  viewMode: 'grid',
  selectedAssetId: null,
  showUploadZone: false
};

function readImageDimensions(file) {
  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 800;
      const h = img.naturalHeight || 800;
      URL.revokeObjectURL(tempUrl);
      resolve({ width: w, height: h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(tempUrl);
      resolve({ width: 800, height: 800 });
    };
    img.src = tempUrl;
  });
}

export async function handleFilesUpload(fileList, defaultCategory = 'Product Photos', onComplete = null) {
  if (!fileList || fileList.length === 0) return;
  const files = Array.from(fileList);
  let uploadedCount = 0;
  let lastAsset = null;

  for (const file of files) {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpe?g|webp|svg|gif)$/i)) {
      showToast(`Skipped "${file.name}": unsupported image format.`, 'warning');
      continue;
    }
    const dims = await readImageDimensions(file);
    const inferredCategory =
      defaultCategory !== 'All Categories'
        ? defaultCategory
        : file.name.toLowerCase().endsWith('.svg')
        ? 'Logos'
        : file.type === 'image/png'
        ? 'Transparent PNGs'
        : 'Product Photos';

    lastAsset = await store.addUploadedAsset({
      file,
      name: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
      category: inferredCategory,
      brand: store.getState().brandKit?.name || 'Kopi Senja',
      product: 'Kopi Susu Original',
      width: dims.width,
      height: dims.height
    });
    uploadedCount++;
  }

  if (uploadedCount > 0) {
    if (lastAsset) uiState.selectedAssetId = lastAsset.id;
    showToast(
      `Uploaded ${uploadedCount} immutable source ${uploadedCount === 1 ? 'asset' : 'assets'}.`,
      'success'
    );
    if (typeof onComplete === 'function') onComplete(lastAsset);
  }
}

export function renderAssetLibrary(container, params = {}) {
  if (params.assetId) {
    uiState.selectedAssetId = params.assetId;
  }
  if (params.openUpload === '1') {
    uiState.showUploadZone = true;
  }

  const state = store.getState();
  const allAssets = state.assets || [];

  if (!uiState.selectedAssetId && allAssets.length > 0) {
    uiState.selectedAssetId = allAssets[0].id;
  } else if (uiState.selectedAssetId && !allAssets.some((a) => a.id === uiState.selectedAssetId)) {
    uiState.selectedAssetId = allAssets[0]?.id || null;
  }

  // Filter & Sort
  const filtered = allAssets
    .filter((a) => {
      if (uiState.category !== 'All Categories' && a.category !== uiState.category) return false;
      if (uiState.status !== 'all' && a.status !== uiState.status) return false;
      if (uiState.source === 'builtin' && !a.isBuiltin) return false;
      if (uiState.source === 'uploaded' && a.isBuiltin) return false;
      if (uiState.search.trim()) {
        const q = uiState.search.trim().toLowerCase();
        const hay = `${a.name} ${a.originalFileName} ${a.brand} ${a.product} ${a.category} ${(a.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (uiState.sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (uiState.sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (uiState.sortBy === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const selectedAsset = allAssets.find((a) => a.id === uiState.selectedAssetId) || null;

  container.innerHTML = `
    <div class="max-w-[1440px] mx-auto p-5 md:p-6 space-y-5">
      <!-- Top Bar & Actions -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-[var(--color-text-main)]">Source-of-Truth Asset Library</h2>
            <span class="badge badge-primary">${allAssets.length} Total</span>
            <span class="badge badge-success">${allAssets.filter((a) => a.status === 'approved').length} Approved</span>
          </div>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Uploaded files are preserved as immutable source assets. Layout compositions reference these assets without altering original pixel data.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" id="asset-restore-samples-btn" class="btn btn-secondary btn-sm" title="Add or restore built-in Kopi Senja sample assets">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">library_add</span>
            <span>Restore Sample Library</span>
          </button>
          <button type="button" id="asset-toggle-dropzone-btn" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">cloud_upload</span>
            <span>${uiState.showUploadZone ? 'Hide Dropzone' : 'Drag & Drop Zone'}</span>
          </button>
          <button type="button" id="asset-upload-trigger-btn" class="btn btn-primary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">upload_file</span>
            <span>Upload Images</span>
          </button>
          <input type="file" id="asset-lib-file-input" class="hidden" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        </div>
      </div>

      <!-- Drag and Drop Upload Area -->
      <div id="asset-dropzone" class="${uiState.showUploadZone ? 'block' : 'hidden'} card-surface border-2 border-dashed border-blue-400/70 bg-blue-50/40 p-6 text-center transition cursor-pointer">
        <div class="max-w-md mx-auto space-y-2">
          <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
            <span class="material-symbols-outlined" aria-hidden="true">upload_file</span>
          </div>
          <div class="text-sm font-semibold text-[var(--color-text-main)]">
            Drag and drop product photos, transparent PNGs, or SVG logos here
          </div>
          <p class="text-xs text-[var(--color-text-secondary)]">
            Original files are locked as immutable sources and stored locally in IndexedDB with automatic Object URL management.
          </p>
          <div class="pt-1">
            <span class="btn btn-secondary btn-sm inline-flex">Select Files from Computer</span>
          </div>
        </div>
      </div>

      <!-- Category Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Asset Categories">
        ${ASSET_CATEGORIES.map((cat) => {
          const count = cat === 'All Categories' ? allAssets.length : allAssets.filter((a) => a.category === cat).length;
          const active = uiState.category === cat;
          return `
            <button
              type="button"
              role="tab"
              aria-selected="${active}"
              data-asset-cat="${escapeHtml(cat)}"
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

      <!-- Filter, Search, Sort & View Controls -->
      <div class="card-surface p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div class="relative flex-1 min-w-[200px] max-w-xs">
            <span class="material-symbols-outlined icon-sm text-[var(--color-text-secondary)] absolute left-2.5 top-2 pointer-events-none" aria-hidden="true">search</span>
            <input
              type="search"
              id="asset-search-input"
              value="${escapeHtml(uiState.search)}"
              placeholder="Search by asset name, product, file..."
              aria-label="Search assets by name"
              class="input-field pl-8 py-1.5 text-xs"
            />
          </div>

          <select id="asset-status-filter" aria-label="Filter by approval status" class="input-field w-auto py-1.5 text-xs">
            <option value="all" ${uiState.status === 'all' ? 'selected' : ''}>Status: All</option>
            <option value="approved" ${uiState.status === 'approved' ? 'selected' : ''}>Approved Only</option>
            <option value="pending" ${uiState.status === 'pending' ? 'selected' : ''}>Pending Review</option>
            <option value="rejected" ${uiState.status === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>

          <select id="asset-source-filter" aria-label="Filter by asset origin" class="input-field w-auto py-1.5 text-xs">
            <option value="all" ${uiState.source === 'all' ? 'selected' : ''}>Origin: All Assets</option>
            <option value="builtin" ${uiState.source === 'builtin' ? 'selected' : ''}>Built-in Demo Assets</option>
            <option value="uploaded" ${uiState.source === 'uploaded' ? 'selected' : ''}>User-Uploaded Assets</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <select id="asset-sort-select" aria-label="Sort assets" class="input-field w-auto py-1.5 text-xs">
            <option value="date-desc" ${uiState.sortBy === 'date-desc' ? 'selected' : ''}>Sort: Newest First</option>
            <option value="date-asc" ${uiState.sortBy === 'date-asc' ? 'selected' : ''}>Sort: Oldest First</option>
            <option value="name-asc" ${uiState.sortBy === 'name-asc' ? 'selected' : ''}>Sort: Name (A–Z)</option>
            <option value="name-desc" ${uiState.sortBy === 'name-desc' ? 'selected' : ''}>Sort: Name (Z–A)</option>
          </select>

          <div class="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
            <button type="button" data-view-mode="grid" class="px-2.5 py-1.5 text-xs ${uiState.viewMode === 'grid' ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}" aria-label="Grid view" title="Grid View">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">grid_view</span>
            </button>
            <button type="button" data-view-mode="list" class="px-2.5 py-1.5 text-xs border-l border-[var(--color-border)] ${uiState.viewMode === 'list' ? 'bg-blue-50 text-blue-700 font-semibold' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]'}" aria-label="List view" title="List View">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">view_list</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Main Split Content: Asset Grid/List + Asset Inspector Panel -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- Left 8 cols: Assets Display -->
        <div class="lg:col-span-8">
          ${
            filtered.length === 0
              ? `
                <div class="card-surface p-10 text-center space-y-3">
                  <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                    <span class="material-symbols-outlined" aria-hidden="true">search_off</span>
                  </div>
                  <div class="text-sm font-semibold text-[var(--color-text-main)]">No matching assets found</div>
                  <p class="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                    Try clearing your search or filters, upload a new image, or restore the sample asset library.
                  </p>
                  <div class="flex justify-center gap-2 pt-1">
                    <button type="button" id="asset-reset-filters-btn" class="btn btn-secondary btn-sm">Reset Filters</button>
                  </div>
                </div>
              `
              : uiState.viewMode === 'grid'
              ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  ${filtered
                    .map((asset) => {
                      const isSelected = asset.id === uiState.selectedAssetId;
                      const statusBadge =
                        asset.status === 'approved'
                          ? '<span class="badge badge-success">Approved</span>'
                          : asset.status === 'pending'
                          ? '<span class="badge badge-warning">Pending</span>'
                          : '<span class="badge badge-error">Rejected</span>';
                      const originBadge = asset.isBuiltin
                        ? '<span class="badge badge-neutral">Built-in Demo</span>'
                        : '<span class="badge badge-primary">User Upload</span>';

                      return `
                        <article
                          data-select-asset="${escapeHtml(asset.id)}"
                          class="card-surface overflow-hidden flex flex-col cursor-pointer transition ${
                            isSelected ? 'ring-2 ring-[#2563EB] border-[#2563EB]' : 'hover:border-slate-300'
                          }"
                        >
                          <div class="h-44 bg-slate-100/90 border-b border-[var(--color-border)] relative flex items-center justify-center p-3" style="background-image: radial-gradient(#CBD5E1 1px, transparent 1px); background-size: 12px 12px;">
                            <img
                              src="${escapeHtml(asset.src)}"
                              alt="${escapeHtml(asset.name)}"
                              class="max-h-full max-w-full object-contain drop-shadow-xs"
                              loading="lazy"
                            />
                            <div class="absolute top-2 left-2 flex flex-wrap gap-1">
                              ${originBadge}
                            </div>
                            <div class="absolute top-2 right-2">
                              ${statusBadge}
                            </div>
                            ${
                              asset.protected
                                ? `<div class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/85 text-amber-200 text-[10px] font-semibold flex items-center gap-1">
                                     <span class="material-symbols-outlined" style="font-size:13px" aria-hidden="true">lock</span>
                                     <span>Source Locked</span>
                                   </div>`
                                : ''
                            }
                          </div>
                          <div class="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                            <div>
                              <div class="text-xs font-semibold text-[var(--color-text-main)] truncate">${escapeHtml(asset.name)}</div>
                              <div class="text-[11px] text-[var(--color-text-secondary)] truncate">${escapeHtml(asset.category)} · ${escapeHtml(asset.product || asset.brand)}</div>
                            </div>
                            <div class="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] font-mono">
                              <span>${escapeHtml(asset.format)} · ${asset.width}×${asset.height}</span>
                              <span>${escapeHtml(formatBytes(asset.sizeBytes))}</span>
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
                        <th class="py-2.5 px-3">Asset</th>
                        <th class="py-2.5 px-3">Category</th>
                        <th class="py-2.5 px-3">Dimensions</th>
                        <th class="py-2.5 px-3">Origin</th>
                        <th class="py-2.5 px-3">Integrity</th>
                        <th class="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--color-border)]">
                      ${filtered
                        .map((asset) => {
                          const isSelected = asset.id === uiState.selectedAssetId;
                          return `
                            <tr
                              data-select-asset="${escapeHtml(asset.id)}"
                              class="cursor-pointer transition ${isSelected ? 'bg-blue-50/70' : 'hover:bg-[var(--color-surface-subtle)]'}"
                            >
                              <td class="py-2.5 px-3">
                                <div class="flex items-center gap-2.5">
                                  <img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.name)}" class="w-9 h-9 rounded object-contain bg-slate-100 border border-[var(--color-border)] shrink-0" />
                                  <div>
                                    <div class="font-semibold text-[var(--color-text-main)]">${escapeHtml(asset.name)}</div>
                                    <div class="text-[11px] text-[var(--color-text-secondary)] font-mono">${escapeHtml(asset.originalFileName)}</div>
                                  </div>
                                </div>
                              </td>
                              <td class="py-2.5 px-3 text-[var(--color-text-secondary)]">${escapeHtml(asset.category)}</td>
                              <td class="py-2.5 px-3 font-mono text-[11px]">${escapeHtml(asset.format)} · ${asset.width}×${asset.height}</td>
                              <td class="py-2.5 px-3">
                                ${asset.isBuiltin ? '<span class="badge badge-neutral">Built-in Demo</span>' : '<span class="badge badge-primary">User Upload</span>'}
                              </td>
                              <td class="py-2.5 px-3">
                                ${asset.protected ? '<span class="badge badge-warning">Locked Source</span>' : '<span class="badge badge-neutral">Standard</span>'}
                              </td>
                              <td class="py-2.5 px-3">
                                ${
                                  asset.status === 'approved'
                                    ? '<span class="badge badge-success">Approved</span>'
                                    : asset.status === 'pending'
                                    ? '<span class="badge badge-warning">Pending</span>'
                                    : '<span class="badge badge-error">Rejected</span>'
                                }
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>

        <!-- Right 4 cols: Asset Detail & Metadata Inspector Drawer -->
        <aside class="lg:col-span-4 card-surface p-4 space-y-4 sticky top-4" aria-label="Asset Detail Inspector">
          ${
            !selectedAsset
              ? `<div class="py-12 text-center text-xs text-[var(--color-text-secondary)]">Select an asset to inspect metadata, dimensions, and approval status.</div>`
              : `
                <div class="flex items-start justify-between gap-2 border-b border-[var(--color-border)] pb-3">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Asset Inspector</span>
                      ${selectedAsset.isBuiltin ? '<span class="badge badge-neutral">Built-in Demo</span>' : '<span class="badge badge-primary">User Uploaded</span>'}
                    </div>
                    <h3 class="text-sm font-semibold text-[var(--color-text-main)] mt-1">${escapeHtml(selectedAsset.name)}</h3>
                  </div>
                </div>

                <!-- Preview Box -->
                <div class="h-48 rounded-md border border-[var(--color-border)] bg-slate-100 flex items-center justify-center p-3 relative" style="background-image: radial-gradient(#CBD5E1 1px, transparent 1px); background-size: 12px 12px;">
                  <img src="${escapeHtml(selectedAsset.src)}" alt="${escapeHtml(selectedAsset.name)}" class="max-h-full max-w-full object-contain" />
                </div>

                <!-- Quick Studio Action -->
                <div class="flex items-center gap-2">
                  <button type="button" id="inspector-use-in-studio-btn" class="btn btn-primary btn-sm flex-1">
                    <span class="material-symbols-outlined icon-sm" aria-hidden="true">add_photo_alternate</span>
                    <span>Place in Active Design</span>
                  </button>
                  <button type="button" id="inspector-delete-asset-btn" class="btn btn-danger btn-sm" title="Delete asset">
                    <span class="material-symbols-outlined icon-sm" aria-hidden="true">delete</span>
                  </button>
                </div>

                <!-- Approval Governance Controls -->
                <div class="space-y-1.5">
                  <label class="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Approval Governance Status</label>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button type="button" data-set-status="approved" class="btn btn-sm ${selectedAsset.status === 'approved' ? 'bg-emerald-700 text-white border-emerald-700' : 'btn-secondary'}">
                      Approved
                    </button>
                    <button type="button" data-set-status="pending" class="btn btn-sm ${selectedAsset.status === 'pending' ? 'bg-amber-600 text-white border-amber-600' : 'btn-secondary'}">
                      Pending
                    </button>
                    <button type="button" data-set-status="rejected" class="btn btn-sm ${selectedAsset.status === 'rejected' ? 'bg-red-700 text-white border-red-700' : 'btn-secondary'}">
                      Rejected
                    </button>
                  </div>
                </div>

                <!-- Immutable Technical Specs -->
                <div class="p-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] space-y-1.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-[var(--color-text-secondary)]">Original File:</span>
                    <span class="font-mono font-medium text-[var(--color-text-main)] truncate max-w-[180px]" title="${escapeHtml(selectedAsset.originalFileName)}">${escapeHtml(selectedAsset.originalFileName)}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[var(--color-text-secondary)]">Dimensions &amp; Format:</span>
                    <span class="font-mono font-medium text-[var(--color-text-main)]">${selectedAsset.width} × ${selectedAsset.height} px (${escapeHtml(selectedAsset.format)})</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[var(--color-text-secondary)]">File Size:</span>
                    <span class="font-mono text-[var(--color-text-main)]">${escapeHtml(formatBytes(selectedAsset.sizeBytes))}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[var(--color-text-secondary)]">Version:</span>
                    <span class="font-medium text-[var(--color-text-main)]">${escapeHtml(selectedAsset.version || 'v1.0')}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[var(--color-text-secondary)]">Added On:</span>
                    <span class="text-[var(--color-text-main)]">${escapeHtml(formatDate(selectedAsset.createdAt, false))}</span>
                  </div>
                </div>

                <!-- Asset Integrity Protection Toggle -->
                <div class="p-3 rounded-md border ${selectedAsset.protected ? 'border-amber-300 bg-amber-50/60' : 'border-[var(--color-border)] bg-[var(--color-surface)]'} space-y-1.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-main)]">
                      <span class="material-symbols-outlined icon-sm text-amber-700" aria-hidden="true">shield_lock</span>
                      <span>Product Asset Integrity Lock</span>
                    </div>
                    <input type="checkbox" id="inspector-protect-toggle" class="w-4 h-4 accent-blue-600 cursor-pointer" ${selectedAsset.protected ? 'checked' : ''} aria-label="Toggle product asset integrity protection" />
                  </div>
                  <p class="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                    When enabled, Design Studio locks aspect ratio and disables destructive filters/cropping to preserve authentic product representation.
                  </p>
                </div>

                <!-- Editable Metadata Form -->
                <form id="inspector-metadata-form" class="space-y-3 pt-1 border-t border-[var(--color-border)]">
                  <div>
                    <label for="meta-asset-name" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Display Name</label>
                    <input type="text" id="meta-asset-name" class="input-field text-xs" value="${escapeHtml(selectedAsset.name)}" required />
                  </div>

                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="meta-asset-cat" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Category</label>
                      <select id="meta-asset-cat" class="input-field text-xs">
                        ${ASSET_CATEGORIES.filter((c) => c !== 'All Categories')
                          .map(
                            (c) => `<option value="${escapeHtml(c)}" ${selectedAsset.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                          )
                          .join('')}
                      </select>
                    </div>
                    <div>
                      <label for="meta-asset-brand" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Assigned Brand</label>
                      <input type="text" id="meta-asset-brand" class="input-field text-xs" value="${escapeHtml(selectedAsset.brand || 'Kopi Senja')}" />
                    </div>
                  </div>

                  <div>
                    <label for="meta-asset-product" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Assigned Product / Campaign</label>
                    <input type="text" id="meta-asset-product" class="input-field text-xs" value="${escapeHtml(selectedAsset.product || '')}" placeholder="e.g., Kopi Susu Original" />
                  </div>

                  <div>
                    <label for="meta-asset-desc" class="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">Usage Notes / Metadata</label>
                    <textarea id="meta-asset-desc" rows="2" class="input-field text-xs">${escapeHtml(selectedAsset.description || '')}</textarea>
                  </div>

                  <button type="submit" class="btn btn-secondary btn-sm w-full">
                    <span class="material-symbols-outlined icon-sm" aria-hidden="true">save</span>
                    <span>Save Asset Metadata</span>
                  </button>
                </form>
              `
          }
        </aside>
      </div>
    </div>
  `;

  // Event Listeners
  const fileInput = container.querySelector('#asset-lib-file-input');
  const dropzone = container.querySelector('#asset-dropzone');

  container.querySelector('#asset-upload-trigger-btn')?.addEventListener('click', () => {
    fileInput?.click();
  });

  container.querySelector('#asset-toggle-dropzone-btn')?.addEventListener('click', () => {
    uiState.showUploadZone = !uiState.showUploadZone;
    renderAssetLibrary(container);
  });

  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('bg-blue-100/70', 'border-blue-600');
  });
  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('bg-blue-100/70', 'border-blue-600');
  });
  dropzone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('bg-blue-100/70', 'border-blue-600');
    await handleFilesUpload(e.dataTransfer?.files, uiState.category, () => {
      renderAssetLibrary(container);
    });
  });

  fileInput?.addEventListener('change', async (e) => {
    await handleFilesUpload(e.target.files, uiState.category, () => {
      fileInput.value = '';
      renderAssetLibrary(container);
    });
  });

  container.querySelector('#asset-restore-samples-btn')?.addEventListener('click', () => {
    const count = store.restoreSampleAssets();
    if (count > 0) {
      showToast(`Restored ${count} sample assets to library.`, 'success');
    } else {
      showToast('All built-in sample assets are already present in the library.', 'info');
    }
    renderAssetLibrary(container);
  });

  container.querySelectorAll('[data-asset-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.category = btn.getAttribute('data-asset-cat');
      renderAssetLibrary(container);
    });
  });

  container.querySelector('#asset-search-input')?.addEventListener('input', (e) => {
    uiState.search = e.target.value;
    renderAssetLibrary(container);
    const input = container.querySelector('#asset-search-input');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  container.querySelector('#asset-status-filter')?.addEventListener('change', (e) => {
    uiState.status = e.target.value;
    renderAssetLibrary(container);
  });

  container.querySelector('#asset-source-filter')?.addEventListener('change', (e) => {
    uiState.source = e.target.value;
    renderAssetLibrary(container);
  });

  container.querySelector('#asset-sort-select')?.addEventListener('change', (e) => {
    uiState.sortBy = e.target.value;
    renderAssetLibrary(container);
  });

  container.querySelectorAll('[data-view-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.viewMode = btn.getAttribute('data-view-mode');
      renderAssetLibrary(container);
    });
  });

  container.querySelector('#asset-reset-filters-btn')?.addEventListener('click', () => {
    uiState.search = '';
    uiState.category = 'All Categories';
    uiState.status = 'all';
    uiState.source = 'all';
    renderAssetLibrary(container);
  });

  container.querySelectorAll('[data-select-asset]').forEach((el) => {
    el.addEventListener('click', () => {
      uiState.selectedAssetId = el.getAttribute('data-select-asset');
      renderAssetLibrary(container);
    });
  });

  // Inspector Actions
  container.querySelectorAll('[data-set-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!selectedAsset) return;
      const newStatus = btn.getAttribute('data-set-status');
      store.updateAsset(selectedAsset.id, { status: newStatus });
      showToast(`Marked "${selectedAsset.name}" as ${newStatus.toUpperCase()}.`, 'success');
      renderAssetLibrary(container);
    });
  });

  container.querySelector('#inspector-protect-toggle')?.addEventListener('change', (e) => {
    if (!selectedAsset) return;
    const isProt = Boolean(e.target.checked);
    store.updateAsset(selectedAsset.id, { protected: isProt, locked: isProt });
    showToast(
      isProt
        ? `Enabled Product Integrity Protection for "${selectedAsset.name}".`
        : `Unlocked layout protection on "${selectedAsset.name}" (source file remains immutable).`,
      'info'
    );
    renderAssetLibrary(container);
  });

  container.querySelector('#inspector-metadata-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    const name = container.querySelector('#meta-asset-name')?.value.trim() || selectedAsset.name;
    const category = container.querySelector('#meta-asset-cat')?.value || selectedAsset.category;
    const brand = container.querySelector('#meta-asset-brand')?.value.trim() || 'Kopi Senja';
    const product = container.querySelector('#meta-asset-product')?.value.trim() || '';
    const description = container.querySelector('#meta-asset-desc')?.value.trim() || '';

    store.updateAsset(selectedAsset.id, { name, category, brand, product, description });
    showToast(`Saved metadata for "${name}".`, 'success');
    renderAssetLibrary(container);
  });

  container.querySelector('#inspector-use-in-studio-btn')?.addEventListener('click', () => {
    if (!selectedAsset) return;
    const proj = store.getActiveProject();
    if (!proj) return;

    const comp = JSON.parse(JSON.stringify(proj.composition));
    const maxZ = comp.elements.reduce((m, el) => Math.max(m, el.zIndex || 1), 1);
    const ratio = (selectedAsset.width || 800) / (selectedAsset.height || 800);
    const targetH = selectedAsset.category === 'Logos' ? 90 : 420;
    const targetW = Math.round(targetH * ratio);

    const newEl = {
      id: uid('el_ast'),
      name: selectedAsset.name,
      type: selectedAsset.category === 'Logos' ? 'logo' : selectedAsset.protected ? 'product' : 'image',
      role: selectedAsset.category === 'Logos' ? 'logo' : selectedAsset.protected ? 'product' : 'badge',
      assetId: selectedAsset.id,
      src: selectedAsset.src,
      x: Math.round((comp.width - targetW) / 2),
      y: Math.round((comp.height - targetH) / 2),
      width: targetW,
      height: targetH,
      naturalWidth: selectedAsset.width || 800,
      naturalHeight: selectedAsset.height || 800,
      aspectRatioLocked: Boolean(selectedAsset.protected),
      objectFit: 'contain',
      opacity: 1,
      zIndex: maxZ + 1,
      locked: false,
      protected: Boolean(selectedAsset.protected),
      visible: true
    };

    comp.elements.push(newEl);
    store.saveProjectComposition(proj.id, comp);
    showToast(`Placed "${selectedAsset.name}" into "${proj.name}".`, 'success');
    router.navigate('design-studio', { projectId: proj.id, selectElementId: newEl.id });
  });

  container.querySelector('#inspector-delete-asset-btn')?.addEventListener('click', () => {
    if (!selectedAsset) return;
    showConfirmModal({
      title: 'Delete Asset from Library',
      message: `Are you sure you want to remove "${selectedAsset.name}" (${selectedAsset.originalFileName}) from your workspace asset library?`,
      confirmText: 'Delete Asset',
      danger: true,
      onConfirm: async () => {
        await store.deleteAsset(selectedAsset.id);
        uiState.selectedAssetId = null;
        showToast(`Deleted "${selectedAsset.name}".`, 'info');
        renderAssetLibrary(container);
      }
    });
  });
}
