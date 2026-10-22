/**
 * AutoDesign — Main Application Entry Point, Shell Controller & Settings View
 * Connects Store, Router, Global Search, Notifications, Workspace Switcher, and all 9 Feature Views.
 */

import { store } from './store.js';
import { router, ROUTES } from './router.js';
import { renderDashboard } from './dashboard.js';
import { renderAssetLibrary, handleFilesUpload } from './asset-library.js';
import { renderBrandKit } from './brand-kit.js';
import { renderDesignStudio } from './design-studio.js';
import { renderTemplates, openSaveAsTemplateModal } from './templates.js';
import { renderExport } from './export.js';
import { renderValidation, evaluateProjectValidation } from './validation.js';
import { renderProjects, openCreateProjectModal } from './projects.js';
import {
  escapeHtml,
  formatRelativeTime,
  downloadBlob,
  showToast,
  showConfirmModal
} from './utils.js';

/* ==========================================================================
   Settings Screen Implementation (Section 15 & Section 16)
   ========================================================================== */

function renderSettings(container) {
  const state = store.getState();
  const ws = state.workspace || {};
  const settings = state.settings || {};
  const brand = state.brandKit || {};

  // Estimate local storage usage
  let storageSizeKb = '0.0';
  try {
    const raw = localStorage.getItem('autodesign_workspace_state_v1') || '';
    storageSizeKb = ((raw.length * 2) / 1024).toFixed(1);
  } catch {
    storageSizeKb = 'N/A';
  }

  container.innerHTML = `
    <div class="max-w-[1200px] mx-auto p-5 md:p-6 space-y-6">
      <!-- Top Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-lg font-bold text-[var(--color-text-main)]">Workspace Settings &amp; Local Persistence</h2>
          <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Configure workspace metadata, editor grid defaults, appearance preferences, and local JSON data backups.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="set-export-json-btn" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">download</span>
            <span>Export Workspace JSON</span>
          </button>
          <button type="button" id="set-import-json-btn" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">upload</span>
            <span>Import Workspace JSON</span>
          </button>
          <input type="file" id="set-import-json-input" class="hidden" accept="application/json,.json" />
        </div>
      </div>

      <!-- Honest Local Storage Notice (Section 15) -->
      <div class="card-surface p-4 border-l-4 border-l-blue-600 bg-blue-50/40 flex items-start gap-3 text-xs">
        <span class="material-symbols-outlined text-blue-700 mt-0.5" aria-hidden="true">storage</span>
        <div class="space-y-1">
          <div class="font-semibold text-[var(--color-text-main)]">Browser Local Persistence Notice (localStorage + IndexedDB)</div>
          <p class="text-[var(--color-text-secondary)] leading-relaxed">
            AutoDesign is a static frontend application hosted on GitHub Pages. All projects, brand rules, and uploaded source image blobs are saved locally in this browser (current metadata footprint: <strong>${storageSizeKb} KB</strong>). Data does <strong>not</strong> synchronize automatically across different devices or browsers. Use the JSON Export/Import controls below to transfer project metadata.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- Left 7 Cols: Workspace, Appearance, Canvas & Export Defaults -->
        <div class="lg:col-span-7 space-y-5">
          <!-- Workspace Information -->
          <section class="card-surface p-5 space-y-4">
            <div class="border-b border-[var(--color-border)] pb-3">
              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">1. Workspace Information</h3>
              <p class="text-xs text-[var(--color-text-secondary)]">Organization and team context displayed in the application shell</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label for="set-ws-name" class="block font-medium text-[var(--color-text-main)] mb-1">Workspace Name</label>
                <input type="text" id="set-ws-name" class="input-field" value="${escapeHtml(ws.name || 'Kopi Senja Official')}" />
              </div>
              <div>
                <label for="set-ws-role" class="block font-medium text-[var(--color-text-main)] mb-1">Active Role / Department</label>
                <input type="text" id="set-ws-role" class="input-field" value="${escapeHtml(ws.role || 'Brand Design Lead')}" />
              </div>
              <div>
                <label for="set-default-brand" class="block font-medium text-[var(--color-text-main)] mb-1">Default Brand Association</label>
                <input type="text" id="set-default-brand" class="input-field" value="${escapeHtml(settings.defaultBrand || brand.name || 'Kopi Senja')}" />
              </div>
              <div>
                <label class="block font-medium text-[var(--color-text-main)] mb-1">Persistence Engine Status</label>
                <div class="input-field bg-[var(--color-bg)] flex items-center gap-2 text-emerald-700 font-semibold">
                  <span class="material-symbols-outlined icon-sm" aria-hidden="true">check_circle</span>
                  <span>${state.saveStatus?.storageAvailable !== false ? 'localStorage + IndexedDB Active' : 'In-Memory Fallback Mode'}</span>
                </div>
              </div>
            </div>

            <button type="button" id="set-save-ws-btn" class="btn btn-primary btn-sm">
              <span class="material-symbols-outlined icon-sm" aria-hidden="true">save</span>
              <span>Save Workspace Info</span>
            </button>
          </section>

          <!-- Appearance, Canvas Grid & Export Preferences -->
          <section class="card-surface p-5 space-y-4">
            <div class="border-b border-[var(--color-border)] pb-3">
              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">2. Appearance, Canvas Grid &amp; Export Defaults</h3>
              <p class="text-xs text-[var(--color-text-secondary)]">Customize Design Studio behavior and default output presets</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label for="set-theme-select" class="block font-medium text-[var(--color-text-main)] mb-1">Interface Appearance Theme</label>
                <select id="set-theme-select" class="input-field">
                  <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light Editorial Workspace (Default)</option>
                  <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark Studio Slate</option>
                </select>
              </div>

              <div>
                <label for="set-grid-size" class="block font-medium text-[var(--color-text-main)] mb-1">Canvas Grid Spacing (px)</label>
                <select id="set-grid-size" class="input-field font-mono">
                  <option value="8" ${Number(settings.canvasGridSize) === 8 ? 'selected' : ''}>8 px (Fine Swiss Grid)</option>
                  <option value="16" ${Number(settings.canvasGridSize) === 16 ? 'selected' : ''}>16 px (Standard 2x Grid)</option>
                  <option value="24" ${Number(settings.canvasGridSize) === 24 ? 'selected' : ''}>24 px (Editorial Margin Grid)</option>
                </select>
              </div>

              <div>
                <label for="set-exp-preset" class="block font-medium text-[var(--color-text-main)] mb-1">Default Export Aspect Ratio</label>
                <select id="set-exp-preset" class="input-field">
                  <option value="ig-square" ${settings.defaultExportPreset === 'ig-square' ? 'selected' : ''}>Instagram Square (1080×1080)</option>
                  <option value="ig-portrait" ${settings.defaultExportPreset === 'ig-portrait' ? 'selected' : ''}>Instagram Portrait (1080×1350)</option>
                  <option value="story-reels" ${settings.defaultExportPreset === 'story-reels' ? 'selected' : ''}>Story &amp; Reels Cover (1080×1920)</option>
                  <option value="landscape-banner" ${settings.defaultExportPreset === 'landscape-banner' ? 'selected' : ''}>Landscape Banner (1920×1080)</option>
                </select>
              </div>

              <div>
                <label for="set-exp-format" class="block font-medium text-[var(--color-text-main)] mb-1">Default Export File Format</label>
                <select id="set-exp-format" class="input-field">
                  <option value="png" ${settings.defaultExportFormat === 'png' ? 'selected' : ''}>PNG (Lossless Raster)</option>
                  <option value="jpeg" ${settings.defaultExportFormat === 'jpeg' ? 'selected' : ''}>JPEG (Compressed Raster)</option>
                  <option value="svg" ${settings.defaultExportFormat === 'svg' ? 'selected' : ''}>SVG (Scalable Vector XML)</option>
                </select>
              </div>
            </div>

            <div class="space-y-2.5 pt-2 text-xs">
              <label class="flex items-center justify-between p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                <div>
                  <div class="font-semibold text-[var(--color-text-main)]">Show Canvas Grid Overlay by Default</div>
                  <div class="text-[11px] text-[var(--color-text-secondary)]">Display alignment grid lines inside the Design Studio canvas.</div>
                </div>
                <input type="checkbox" id="set-show-grid" class="w-4 h-4 accent-blue-600" ${settings.showCanvasGrid ? 'checked' : ''} />
              </label>

              <label class="flex items-center justify-between p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                <div>
                  <div class="font-semibold text-[var(--color-text-main)]">Snap Elements to Grid on Drag</div>
                  <div class="text-[11px] text-[var(--color-text-secondary)]">Automatically align dragged elements to grid increments and canvas center guides.</div>
                </div>
                <input type="checkbox" id="set-snap-grid" class="w-4 h-4 accent-blue-600" ${settings.snapToGrid ? 'checked' : ''} />
              </label>

              <label class="flex items-center justify-between p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] cursor-pointer">
                <div>
                  <div class="font-semibold text-[var(--color-text-main)]">Show Platform Safe-Area Guides on Canvas</div>
                  <div class="text-[11px] text-[var(--color-text-secondary)]">Display 80% central safe-zone boundary inside Design Studio.</div>
                </div>
                <input type="checkbox" id="set-safe-guides" class="w-4 h-4 accent-blue-600" ${settings.showSafeAreaGuides ? 'checked' : ''} />
              </label>
            </div>
          </section>
        </div>

        <!-- Right 5 Cols: Local Data Management & About AutoDesign -->
        <div class="lg:col-span-5 space-y-5">
          <!-- Local Data Management -->
          <section class="card-surface p-5 space-y-4">
            <div class="border-b border-[var(--color-border)] pb-3">
              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">3. Local Data Management &amp; Recovery</h3>
              <p class="text-xs text-[var(--color-text-secondary)]">Backup, restore, or reset local browser storage</p>
            </div>

            <div class="space-y-2.5 text-xs">
              <div class="p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-between">
                <span>Saved Projects:</span>
                <span class="font-mono font-bold">${(state.projects || []).length}</span>
              </div>
              <div class="p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-between">
                <span>Library Assets (Built-in + Uploaded):</span>
                <span class="font-mono font-bold">${(state.assets || []).length}</span>
              </div>
              <div class="p-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-between">
                <span>Saved Templates:</span>
                <span class="font-mono font-bold">${(state.templates || []).length}</span>
              </div>
            </div>

            <div class="pt-2 border-t border-[var(--color-border)] space-y-2">
              <button type="button" id="set-reset-demo-btn" class="btn btn-danger btn-sm w-full">
                <span class="material-symbols-outlined icon-sm" aria-hidden="true">restart_alt</span>
                <span>Reset Workspace to Default Demo Data</span>
              </button>
              <p class="text-[11px] text-[var(--color-text-secondary)] text-center">
                Requires confirmation before clearing custom edits and uploaded IndexedDB blobs.
              </p>
            </div>
          </section>

          <!-- About AutoDesign -->
          <section class="card-surface p-5 space-y-3 text-xs">
            <div class="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 class="text-sm font-semibold text-[var(--color-text-main)]">About AutoDesign</h3>
              <span class="badge badge-primary">Static SaaS Prototype</span>
            </div>
            <p class="text-[var(--color-text-secondary)] leading-relaxed">
              <strong class="text-[var(--color-text-main)]">AutoDesign</strong> demonstrates an asset-locked design automation architecture where AI/rule engines analyze, arrange, validate, and adapt promotional layouts without synthesizing or distorting real product assets.
            </p>
            <div class="p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] font-mono text-[11px] text-[var(--color-text-main)] space-y-1">
              <div>Stack: HTML5 + CSS3 + Vanilla ES6 Modules + Tailwind CDN</div>
              <div>Storage: Browser localStorage + IndexedDB</div>
              <div>Hosting: 100% GitHub Pages Subpath Compatible</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Bind Settings Actions
  container.querySelector('#set-save-ws-btn')?.addEventListener('click', () => {
    const name = container.querySelector('#set-ws-name')?.value.trim() || 'Kopi Senja Official';
    const role = container.querySelector('#set-ws-role')?.value.trim() || 'Brand Design Lead';
    const defBrand = container.querySelector('#set-default-brand')?.value.trim() || 'Kopi Senja';
    store.updateWorkspaceInfo({ name, role });
    store.updateSettings({ defaultBrand: defBrand });
    showToast('Saved workspace information.', 'success');
    updateShellUI();
  });

  container.querySelector('#set-theme-select')?.addEventListener('change', (e) => {
    store.updateSettings({ theme: e.target.value });
    showToast(`Switched appearance to ${e.target.value} theme.`, 'info');
  });

  container.querySelector('#set-grid-size')?.addEventListener('change', (e) => {
    store.updateSettings({ canvasGridSize: Number(e.target.value) || 16 });
    showToast(`Canvas grid spacing set to ${e.target.value}px.`, 'info');
  });

  container.querySelector('#set-exp-preset')?.addEventListener('change', (e) => {
    store.updateSettings({ defaultExportPreset: e.target.value });
    showToast('Updated default export preset.', 'info');
  });

  container.querySelector('#set-exp-format')?.addEventListener('change', (e) => {
    store.updateSettings({ defaultExportFormat: e.target.value });
    showToast('Updated default export format.', 'info');
  });

  container.querySelector('#set-show-grid')?.addEventListener('change', (e) => {
    store.updateSettings({ showCanvasGrid: Boolean(e.target.checked) });
  });

  container.querySelector('#set-snap-grid')?.addEventListener('change', (e) => {
    store.updateSettings({ snapToGrid: Boolean(e.target.checked) });
  });

  container.querySelector('#set-safe-guides')?.addEventListener('change', (e) => {
    store.updateSettings({ showSafeAreaGuides: Boolean(e.target.checked) });
  });

  container.querySelector('#set-export-json-btn')?.addEventListener('click', () => {
    triggerWorkspaceJsonDownload();
  });

  const importInput = container.querySelector('#set-import-json-input');
  container.querySelector('#set-import-json-btn')?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showConfirmModal({
      title: 'Import Workspace JSON Backup',
      message: `Importing "${file.name}" will replace your current workspace projects, brand kit, and settings. Continue?`,
      confirmText: 'Import & Overwrite',
      onConfirm: () => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            store.importWorkspaceJson(reader.result);
            showToast('Successfully imported workspace JSON data.', 'success');
            updateShellUI();
            renderSettings(container);
          } catch (err) {
            showToast(`Import failed: ${err.message}`, 'error');
          }
        };
        reader.readAsText(file);
      }
    });
    importInput.value = '';
  });

  container.querySelector('#set-reset-demo-btn')?.addEventListener('click', () => {
    showConfirmModal({
      title: 'Reset All Workspace Data to Demo Defaults',
      message: 'This will clear all custom project changes, uploaded IndexedDB assets, and custom templates, restoring the initial Kopi Senja campaign state. Proceed?',
      confirmText: 'Reset Demo Data',
      danger: true,
      onConfirm: async () => {
        await store.resetToDemoDefaults();
        showToast('Workspace reset to initial Kopi Senja demo defaults.', 'info');
        updateShellUI();
        renderSettings(container);
      }
    });
  });
}

function triggerWorkspaceJsonDownload() {
  const json = store.exportWorkspaceJson();
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `autodesign-workspace-backup-${dateStr}.json`);
  showToast('Downloaded workspace JSON backup.', 'success');
}

/* ==========================================================================
   Application Shell Synchronization & Interactive Dropdowns
   ========================================================================== */

function updateShellUI() {
  const state = store.getState();
  const ws = state.workspace || {};

  // Workspace labels
  const wsNameEl = document.getElementById('sidebar-workspace-name');
  const wsRoleEl = document.getElementById('sidebar-workspace-role');
  const wsCrumbEl = document.getElementById('header-workspace-crumb');
  const wsAvatarEl = document.getElementById('workspace-avatar-badge');

  if (wsNameEl) wsNameEl.textContent = ws.name || 'Kopi Senja Official';
  if (wsRoleEl) wsRoleEl.textContent = ws.role || 'Brand Design Lead';
  if (wsCrumbEl) wsCrumbEl.textContent = ws.name || 'Kopi Senja Official';
  if (wsAvatarEl) {
    const initials = (ws.name || 'KS')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    wsAvatarEl.textContent = initials || 'KS';
  }

  // Sidebar counters
  const projBadge = document.getElementById('nav-badge-projects');
  const assetBadge = document.getElementById('nav-badge-assets');
  const valDot = document.getElementById('nav-badge-validation');

  if (projBadge) projBadge.textContent = String((state.projects || []).length);
  if (assetBadge) assetBadge.textContent = String((state.assets || []).length);

  const activeProj = store.getActiveProject();
  if (valDot && activeProj) {
    const rep = evaluateProjectValidation(activeProj, state);
    valDot.className = `sidebar-label w-2 h-2 rounded-full ${
      rep.errorCount > 0 ? 'bg-red-600' : rep.warningCount > 0 ? 'bg-amber-500' : 'bg-emerald-600'
    }`;
  }

  // Save status indicator
  const saveDot = document.getElementById('header-save-dot');
  const saveLabel = document.getElementById('header-save-label');
  if (saveDot && saveLabel) {
    if (state.saveStatus?.storageAvailable === false) {
      saveDot.className = 'w-2 h-2 rounded-full bg-amber-500';
      saveLabel.textContent = 'Session Memory Mode';
    } else {
      saveDot.className = 'w-2 h-2 rounded-full bg-emerald-600';
      saveLabel.textContent = `Saved · ${formatRelativeTime(state.saveStatus?.lastSavedAt)}`;
    }
  }

  // Notifications
  const unreadCount = (state.notifications || []).filter((n) => !n.read).length;
  const notifBadge = document.getElementById('header-notif-badge');
  if (notifBadge) {
    notifBadge.textContent = String(unreadCount);
    notifBadge.classList.toggle('hidden', unreadCount === 0);
  }
}

function initShellInteractions() {
  // 1. Sidebar Route Navigation Buttons
  document.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const routeId = btn.getAttribute('data-route');
      router.navigate(routeId);
    });
  });

  // 2. Sidebar Collapse Toggle (Desktop/Tablet)
  const sidebar = document.getElementById('app-sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  collapseBtn?.addEventListener('click', () => {
    const isCollapsed = sidebar?.classList.toggle('collapsed');
    store.updateSettings({ sidebarCollapsed: Boolean(isCollapsed) });
  });

  // Restore saved collapsed state
  if (store.getState().settings?.sidebarCollapsed) {
    sidebar?.classList.add('collapsed');
  }

  // 3. Mobile Drawer Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
  mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.add('mobile-open');
    mobileBackdrop?.classList.remove('hidden');
  });
  mobileBackdrop?.addEventListener('click', () => {
    sidebar?.classList.remove('mobile-open');
    mobileBackdrop?.classList.add('hidden');
  });

  // 4. Workspace Switcher Dropdown
  const wsBtn = document.getElementById('workspace-switcher-btn');
  const wsDropdown = document.getElementById('workspace-dropdown');
  const wsList = document.getElementById('workspace-list-items');

  const renderWorkspaceDropdownItems = () => {
    const ws = store.getState().workspace || {};
    const list = ws.availableWorkspaces || [];
    if (!wsList) return;
    wsList.innerHTML = list
      .map(
        (item) => `
        <button
          type="button"
          data-switch-ws="${escapeHtml(item.id)}"
          class="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs ${
            item.id === ws.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-main)]'
          }"
        >
          <span class="truncate">${escapeHtml(item.name)}</span>
          ${item.id === ws.id ? '<span class="material-symbols-outlined icon-sm" aria-hidden="true">check</span>' : ''}
        </button>
      `
      )
      .join('');

    wsList.querySelectorAll('[data-switch-ws]').forEach((b) => {
      b.addEventListener('click', () => {
        const targetId = b.getAttribute('data-switch-ws');
        const found = list.find((w) => w.id === targetId);
        if (found) {
          store.updateWorkspaceInfo({ id: found.id, name: found.name });
          wsDropdown?.classList.add('hidden');
          updateShellUI();
          showToast(`Switched active workspace to "${found.name}".`, 'info');
        }
      });
    });
  };

  wsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    renderWorkspaceDropdownItems();
    wsDropdown?.classList.toggle('hidden');
  });

  document.getElementById('workspace-manage-btn')?.addEventListener('click', () => {
    wsDropdown?.classList.add('hidden');
    router.navigate('settings');
  });

  // 5. Global Search Control + Ctrl+K Shortcut
  const searchInput = document.getElementById('global-search-input');
  const searchDropdown = document.getElementById('global-search-dropdown');

  const updateSearchResults = () => {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q || !searchDropdown) {
      searchDropdown?.classList.add('hidden');
      return;
    }

    const st = store.getState();
    const matchedProjects = (st.projects || []).filter((p) => `${p.name} ${p.brand} ${p.product}`.toLowerCase().includes(q)).slice(0, 3);
    const matchedAssets = (st.assets || []).filter((a) => `${a.name} ${a.category} ${a.originalFileName}`.toLowerCase().includes(q)).slice(0, 4);
    const matchedTemplates = (st.templates || []).filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(q)).slice(0, 3);

    if (matchedProjects.length === 0 && matchedAssets.length === 0 && matchedTemplates.length === 0) {
      searchDropdown.innerHTML = `<div class="p-3 text-xs text-[var(--color-text-secondary)] text-center">No matching projects, assets, or templates for "${escapeHtml(q)}".</div>`;
      searchDropdown.classList.remove('hidden');
      return;
    }

    searchDropdown.innerHTML = `
      <div class="space-y-2 text-xs">
        ${
          matchedProjects.length > 0
            ? `
              <div>
                <div class="px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">Projects</div>
                ${matchedProjects
                  .map(
                    (p) => `
                    <button type="button" data-search-proj="${escapeHtml(p.id)}" class="w-full px-2.5 py-1.5 rounded hover:bg-[var(--color-surface-subtle)] flex items-center justify-between text-left">
                      <span class="font-medium text-[var(--color-text-main)] truncate">${escapeHtml(p.name)}</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">Open in Studio</span>
                    </button>
                  `
                  )
                  .join('')}
              </div>
            `
            : ''
        }
        ${
          matchedAssets.length > 0
            ? `
              <div>
                <div class="px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">Assets</div>
                ${matchedAssets
                  .map(
                    (a) => `
                    <button type="button" data-search-asset="${escapeHtml(a.id)}" class="w-full px-2.5 py-1.5 rounded hover:bg-[var(--color-surface-subtle)] flex items-center justify-between text-left">
                      <span class="font-medium text-[var(--color-text-main)] truncate">${escapeHtml(a.name)}</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(a.category)}</span>
                    </button>
                  `
                  )
                  .join('')}
              </div>
            `
            : ''
        }
        ${
          matchedTemplates.length > 0
            ? `
              <div>
                <div class="px-2 py-1 text-[10px] font-bold uppercase text-[var(--color-text-secondary)]">Templates</div>
                ${matchedTemplates
                  .map(
                    (t) => `
                    <button type="button" data-search-tpl="${escapeHtml(t.id)}" class="w-full px-2.5 py-1.5 rounded hover:bg-[var(--color-surface-subtle)] flex items-center justify-between text-left">
                      <span class="font-medium text-[var(--color-text-main)] truncate">${escapeHtml(t.name)}</span>
                      <span class="text-[10px] text-[var(--color-text-secondary)]">${escapeHtml(t.aspectRatio)}</span>
                    </button>
                  `
                  )
                  .join('')}
              </div>
            `
            : ''
        }
      </div>
    `;
    searchDropdown.classList.remove('hidden');

    searchDropdown.querySelectorAll('[data-search-proj]').forEach((b) => {
      b.addEventListener('click', () => {
        const pid = b.getAttribute('data-search-proj');
        store.setActiveProject(pid);
        searchDropdown.classList.add('hidden');
        searchInput.value = '';
        router.navigate('design-studio', { projectId: pid });
      });
    });

    searchDropdown.querySelectorAll('[data-search-asset]').forEach((b) => {
      b.addEventListener('click', () => {
        const aid = b.getAttribute('data-search-asset');
        searchDropdown.classList.add('hidden');
        searchInput.value = '';
        router.navigate('asset-library', { assetId: aid });
      });
    });

    searchDropdown.querySelectorAll('[data-search-tpl]').forEach((b) => {
      b.addEventListener('click', () => {
        searchDropdown.classList.add('hidden');
        searchInput.value = '';
        router.navigate('templates');
      });
    });
  };

  searchInput?.addEventListener('input', updateSearchResults);
  searchInput?.addEventListener('focus', updateSearchResults);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput?.focus();
    }
  });

  // 6. Notifications Dropdown
  const notifBtn = document.getElementById('header-notif-btn');
  const notifDropdown = document.getElementById('header-notif-dropdown');
  const notifList = document.getElementById('header-notif-list');

  const renderNotifList = () => {
    const notes = store.getState().notifications || [];
    if (!notifList) return;
    notifList.innerHTML = notes
      .map(
        (n) => `
        <button
          type="button"
          data-notif-route="${escapeHtml(n.route || 'dashboard')}"
          class="w-full p-3 text-left hover:bg-[var(--color-surface-subtle)] transition block ${n.read ? 'opacity-75' : 'bg-blue-50/30'}"
        >
          <div class="flex items-center justify-between text-xs font-semibold text-[var(--color-text-main)]">
            <span>${escapeHtml(n.title)}</span>
            ${!n.read ? '<span class="w-2 h-2 rounded-full bg-blue-600"></span>' : ''}
          </div>
          <p class="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">${escapeHtml(n.message)}</p>
        </button>
      `
      )
      .join('');

    notifList.querySelectorAll('[data-notif-route]').forEach((b) => {
      b.addEventListener('click', () => {
        const rt = b.getAttribute('data-notif-route');
        store.markAllNotificationsRead();
        notifDropdown?.classList.add('hidden');
        updateShellUI();
        router.navigate(rt);
      });
    });
  };

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    renderNotifList();
    notifDropdown?.classList.toggle('hidden');
  });

  document.getElementById('notif-mark-read-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    store.markAllNotificationsRead();
    renderNotifList();
    updateShellUI();
  });

  // 7. Profile Menu Dropdown
  const profileBtn = document.getElementById('header-profile-btn');
  const profileDropdown = document.getElementById('header-profile-dropdown');

  profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown?.classList.toggle('hidden');
  });

  profileDropdown?.querySelectorAll('[data-profile-action]').forEach((b) => {
    b.addEventListener('click', () => {
      const act = b.getAttribute('data-profile-action');
      profileDropdown.classList.add('hidden');
      if (act === 'open-studio') router.navigate('design-studio');
      if (act === 'export-backup') triggerWorkspaceJsonDownload();
      if (act === 'settings') router.navigate('settings');
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!wsDropdown?.contains(e.target) && !wsBtn?.contains(e.target)) {
      wsDropdown?.classList.add('hidden');
    }
    if (!notifDropdown?.contains(e.target) && !notifBtn?.contains(e.target)) {
      notifDropdown?.classList.add('hidden');
    }
    if (!profileDropdown?.contains(e.target) && !profileBtn?.contains(e.target)) {
      profileDropdown?.classList.add('hidden');
    }
    if (!searchDropdown?.contains(e.target) && !searchInput?.contains(e.target)) {
      searchDropdown?.classList.add('hidden');
    }
  });

  // 8. Global File Upload Input Handler
  const globalUploadInput = document.getElementById('global-asset-upload-input');
  globalUploadInput?.addEventListener('change', async (e) => {
    await handleFilesUpload(e.target.files, 'Product Photos', (lastAsset) => {
      globalUploadInput.value = '';
      router.navigate('asset-library', lastAsset ? { assetId: lastAsset.id } : {});
    });
  });

  // 9. Contextual Primary Action Button in Header
  const primaryActionBtn = document.getElementById('header-primary-action-btn');
  primaryActionBtn?.addEventListener('click', () => {
    const route = router.currentRoute;
    if (route === 'dashboard' || route === 'projects') {
      openCreateProjectModal((created) => {
        router.navigate('design-studio', { projectId: created.id });
      });
    } else if (route === 'design-studio') {
      router.navigate('export');
    } else if (route === 'asset-library') {
      globalUploadInput?.click();
    } else if (route === 'brand-kit') {
      document.getElementById('brand-save-btn')?.click();
    } else if (route === 'templates') {
      openSaveAsTemplateModal(() => {
        if (router.currentRoute === 'templates') {
          router.handleLocationChange();
        }
      });
    } else if (route === 'export') {
      document.getElementById('exp-download-main-btn')?.click();
    } else if (route === 'validation') {
      document.getElementById('val-run-check-btn')?.click();
    } else if (route === 'settings') {
      triggerWorkspaceJsonDownload();
    }
  });
}

/* ==========================================================================
   Bootstrap Application
   ========================================================================== */

async function bootstrap() {
  await store.init();

  router.register('dashboard', renderDashboard);
  router.register('projects', renderProjects);
  router.register('design-studio', renderDesignStudio);
  router.register('asset-library', renderAssetLibrary);
  router.register('brand-kit', renderBrandKit);
  router.register('templates', renderTemplates);
  router.register('export', renderExport);
  router.register('validation', renderValidation);
  router.register('settings', renderSettings);

  router.onRouteChange((routeId, _params, routeMeta) => {
    // Update active state on sidebar navigation items
    document.querySelectorAll('[data-route]').forEach((btn) => {
      const isMatch = btn.getAttribute('data-route') === routeId;
      btn.classList.toggle('active', isMatch);
      if (isMatch) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    // Update header title & contextual primary button
    const titleEl = document.getElementById('header-page-title');
    const actionIconEl = document.getElementById('header-primary-action-icon');
    const actionLabelEl = document.getElementById('header-primary-action-label');

    if (titleEl && routeMeta) titleEl.textContent = routeMeta.title;
    if (actionIconEl && routeMeta?.primaryAction) actionIconEl.textContent = routeMeta.primaryAction.icon;
    if (actionLabelEl && routeMeta?.primaryAction) actionLabelEl.textContent = routeMeta.primaryAction.label;

    updateShellUI();
  });

  store.subscribe(() => {
    updateShellUI();
  });

  initShellInteractions();
  updateShellUI();
  router.start();
}

bootstrap();
