/**
 * AutoDesign — Core Utilities, WCAG Math, Geometry, Miniature Renderer & Modal/Toast Helpers
 */

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid(prefix = 'ad') {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rand}`;
}

export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatDate(isoString, includeTime = true) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return String(isoString);
    const opts = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
    };
    return d.toLocaleDateString('en-US', opts);
  } catch {
    return String(isoString);
  }
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Just now';
  try {
    const d = new Date(isoString);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return formatDate(isoString, false);
  } catch {
    return 'Recently';
  }
}

/* ==========================================================================
   Color & WCAG 2.1 Contrast Verification Utilities
   ========================================================================== */

export function isValidHexColor(hex) {
  if (typeof hex !== 'string') return false;
  return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(hex.trim());
}

export function normalizeHex(hex, fallback = '#171A23') {
  if (!isValidHexColor(hex)) return fallback;
  let clean = hex.trim().toUpperCase();
  if (clean.length === 4) {
    clean = '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  return clean;
}

export function hexToRgb(hex) {
  const norm = normalizeHex(hex, '#000000');
  const num = parseInt(norm.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function getRelativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function getContrastRatio(hex1, hex2) {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function suggestAccessibleTextColor(bgHex, candidates = ['#1E1815', '#FFFFFF', '#171A23', '#FFFBEB']) {
  let best = candidates[0];
  let bestRatio = 0;
  for (const c of candidates) {
    const ratio = getContrastRatio(bgHex, c);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return { color: best, ratio: bestRatio };
}

/* ==========================================================================
   Geometry, Aspect Ratio & Overlap Detection
   ========================================================================== */

export function getAspectRatioLabel(width, height) {
  const w = Number(width) || 1080;
  const h = Number(height) || 1080;
  const ratio = w / h;
  if (Math.abs(ratio - 1) < 0.03) return '1:1 Square';
  if (Math.abs(ratio - 0.8) < 0.03) return '4:5 Portrait';
  if (Math.abs(ratio - 0.5625) < 0.03) return '9:16 Story';
  if (Math.abs(ratio - 1.7778) < 0.04) return '16:9 Landscape';
  return `${w}×${h} Custom`;
}

export function rectsOverlap(a, b, margin = 0) {
  const ax1 = a.x + margin;
  const ay1 = a.y + margin;
  const ax2 = a.x + a.width - margin;
  const ay2 = a.y + a.height - margin;

  const bx1 = b.x + margin;
  const by1 = b.y + margin;
  const bx2 = b.x + b.width - margin;
  const by2 = b.y + b.height - margin;

  const overlapX = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const overlapY = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const area = overlapX * overlapY;
  return {
    overlaps: area > 0,
    area,
    overlapX,
    overlapY
  };
}

export function checkElementBounds(el, canvasWidth, canvasHeight) {
  const leftOut = el.x < -1;
  const topOut = el.y < -1;
  const rightOut = el.x + el.width > canvasWidth + 1;
  const bottomOut = el.y + el.height > canvasHeight + 1;
  return {
    overflows: leftOut || topOut || rightOut || bottomOut,
    leftOut,
    topOut,
    rightOut,
    bottomOut
  };
}

/* ==========================================================================
   Live Composition Thumbnail Renderer (Real Visual Previews for Cards)
   ========================================================================== */

export function renderMiniComposition(composition, options = {}) {
  if (!composition || !Array.isArray(composition.elements)) {
    return `<div class="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-xs">No composition</div>`;
  }

  const cw = Number(composition.width) || 1080;
  const ch = Number(composition.height) || 1080;
  const bg = escapeHtml(composition.backgroundColor || '#F6EFE6');
  const maxBoxWidth = options.maxWidth || 260;
  const maxBoxHeight = options.maxHeight || 190;

  const scale = Math.min(maxBoxWidth / cw, maxBoxHeight / ch);
  const scaledW = Math.round(cw * scale);
  const scaledH = Math.round(ch * scale);

  const sorted = [...composition.elements]
    .filter((el) => el.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const layersHtml = sorted
    .map((el) => {
      const leftPct = ((el.x / cw) * 100).toFixed(2);
      const topPct = ((el.y / ch) * 100).toFixed(2);
      const widthPct = ((el.width / cw) * 100).toFixed(2);
      const heightPct = ((el.height / ch) * 100).toFixed(2);
      const opacity = el.opacity !== undefined ? el.opacity : 1;
      const radiusPx = Math.round((el.borderRadius || 0) * scale);

      const baseStyle = `position:absolute;left:${leftPct}%;top:${topPct}%;width:${widthPct}%;height:${heightPct}%;opacity:${opacity};box-sizing:border-box;`;

      if (el.type === 'image' || el.type === 'product' || el.type === 'logo') {
        const src = escapeHtml(el.src || './assets/images/sample-assets/kopi-susu-original.png');
        const fit = el.objectFit || 'contain';
        return `<div style="${baseStyle}border-radius:${radiusPx}px;overflow:hidden;">
          <img src="${src}" alt="${escapeHtml(el.name || 'Asset')}" style="width:100%;height:100%;object-fit:${fit};display:block;" loading="lazy" onerror="this.style.display='none'" />
        </div>`;
      }

      if (el.type === 'shape') {
        const fill = escapeHtml(el.backgroundColor || '#EADBC8');
        const border = el.borderWidth
          ? `border:${Math.max(1, Math.round(el.borderWidth * scale))}px solid ${escapeHtml(el.borderColor || '#D5BFA4')};`
          : '';
        const br = el.shapeType === 'circle' ? '9999px' : `${radiusPx}px`;
        return `<div style="${baseStyle}background:${fill};border-radius:${br};${border}"></div>`;
      }

      // Text, Headline, Price, Badge, CTA
      const fontSizePx = Math.max(6, Math.round((el.fontSize || 36) * scale));
      const fontWeight = el.fontWeight || 600;
      const textColor = escapeHtml(el.color || '#1E1815');
      const bgFill = el.backgroundColor && el.backgroundColor !== 'transparent'
        ? `background:${escapeHtml(el.backgroundColor)};`
        : '';
      const borderStyle = el.borderWidth
        ? `border:${Math.max(1, Math.round(el.borderWidth * scale))}px solid ${escapeHtml(el.borderColor || '#D5BFA4')};`
        : '';
      const textAlign = el.textAlign || 'left';
      const justify = textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';
      const lineHeight = el.lineHeight || 1.2;
      const fontFamily = escapeHtml(el.fontFamily || 'Inter, sans-serif');
      const padPx = el.backgroundColor && el.backgroundColor !== 'transparent' ? Math.max(2, Math.round(12 * scale)) : 0;

      return `<div style="${baseStyle}${bgFill}${borderStyle}border-radius:${radiusPx}px;display:flex;align-items:center;justify-content:${justify};padding:${padPx}px;overflow:hidden;">
        <div style="width:100%;font-family:${fontFamily};font-size:${fontSizePx}px;font-weight:${fontWeight};color:${textColor};text-align:${textAlign};line-height:${lineHeight};white-space:pre-line;overflow:hidden;">${escapeHtml(el.text || '')}</div>
      </div>`;
    })
    .join('');

  return `
    <div class="w-full h-full flex items-center justify-center p-2 bg-slate-100/80 overflow-hidden">
      <div class="mini-composition-stage shadow-sm rounded-[4px]" style="width:${scaledW}px;height:${scaledH}px;background-color:${bg};border:1px solid rgba(23,26,35,0.08);">
        ${layersHtml}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Toast & Accessible Modal System
   ========================================================================== */

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  const iconMap = {
    success: { icon: 'check_circle', cls: 'border-emerald-600/30 bg-emerald-50 text-emerald-900' },
    warning: { icon: 'warning', cls: 'border-amber-600/30 bg-amber-50 text-amber-900' },
    error: { icon: 'error', cls: 'border-red-600/30 bg-red-50 text-red-900' },
    info: { icon: 'info', cls: 'border-slate-200 bg-white text-slate-900' }
  };
  const cfg = iconMap[type] || iconMap.info;

  const toast = document.createElement('div');
  toast.className = `flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-md text-xs font-medium transition-all duration-200 ${cfg.cls}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined icon-sm mt-0.5 shrink-0" aria-hidden="true">${cfg.icon}</span>
    <div class="flex-1 leading-relaxed">${escapeHtml(message)}</div>
    <button type="button" class="text-current opacity-60 hover:opacity-100 ml-1" aria-label="Dismiss notification">
      <span class="material-symbols-outlined icon-sm" aria-hidden="true">close</span>
    </button>
  `;

  const closeBtn = toast.querySelector('button');
  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 160);
  };
  closeBtn.addEventListener('click', remove);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(remove, duration);
  }
}

let activeModalKeyHandler = null;

export function closeCustomModal() {
  const root = document.getElementById('modal-root');
  if (root) {
    root.innerHTML = '';
    root.classList.add('hidden');
  }
  if (activeModalKeyHandler) {
    document.removeEventListener('keydown', activeModalKeyHandler);
    activeModalKeyHandler = null;
  }
}

export function openCustomModal({
  title,
  subtitle = '',
  bodyHtml = '',
  footerHtml = '',
  maxWidth = 'max-w-lg',
  onMount = null
}) {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }

  root.classList.remove('hidden');
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-dialog-title">
      <div class="card-surface w-full ${maxWidth} max-h-[90vh] flex flex-col overflow-hidden shadow-xl animate-fade-in" onclick="event.stopPropagation()">
        <div class="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 id="modal-dialog-title" class="text-sm font-semibold text-[var(--color-text-main)]">${escapeHtml(title)}</h2>
            ${subtitle ? `<p class="text-xs text-[var(--color-text-secondary)] mt-0.5">${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <button type="button" id="modal-close-x" class="btn btn-ghost btn-icon -mr-1 -mt-1" aria-label="Close modal">
            <span class="material-symbols-outlined icon-sm" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 text-xs text-[var(--color-text-main)]" id="modal-dialog-body">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="px-5 py-3.5 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] flex items-center justify-end gap-2" id="modal-dialog-footer">${footerHtml}</div>` : ''}
      </div>
    </div>
  `;

  const backdrop = document.getElementById('modal-backdrop-overlay');
  const closeX = document.getElementById('modal-close-x');
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeCustomModal();
  });
  closeX?.addEventListener('click', closeCustomModal);

  if (activeModalKeyHandler) {
    document.removeEventListener('keydown', activeModalKeyHandler);
  }
  activeModalKeyHandler = (e) => {
    if (e.key === 'Escape') closeCustomModal();
  };
  document.addEventListener('keydown', activeModalKeyHandler);

  if (typeof onMount === 'function') {
    onMount(root);
  }
}

export function showConfirmModal({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm
}) {
  openCustomModal({
    title,
    bodyHtml: `
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${danger ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
          <span class="material-symbols-outlined" aria-hidden="true">${danger ? 'warning' : 'help'}</span>
        </div>
        <div class="text-xs leading-relaxed text-[var(--color-text-secondary)] pt-0.5">
          ${escapeHtml(message)}
        </div>
      </div>
    `,
    footerHtml: `
      <button type="button" id="confirm-modal-cancel" class="btn btn-secondary">${escapeHtml(cancelText)}</button>
      <button type="button" id="confirm-modal-ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmText)}</button>
    `,
    maxWidth: 'max-w-md',
    onMount: () => {
      document.getElementById('confirm-modal-cancel')?.addEventListener('click', closeCustomModal);
      document.getElementById('confirm-modal-ok')?.addEventListener('click', () => {
        closeCustomModal();
        if (typeof onConfirm === 'function') onConfirm();
      });
    }
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
