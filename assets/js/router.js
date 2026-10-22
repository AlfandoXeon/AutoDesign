/**
 * AutoDesign — Client-Side Hash Router (GitHub Pages Subpath Compatible)
 * Supports browser back/forward history, query parameters, and contextual header actions.
 */

export const ROUTES = {
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Workspace overview, approved assets & campaign readiness',
    icon: 'space_dashboard',
    primaryAction: { label: 'Create New Design', icon: 'add', action: 'new-design' }
  },
  projects: {
    id: 'projects',
    title: 'Projects & History',
    subtitle: 'Saved promotional compositions and local version snapshots',
    icon: 'folder_open',
    primaryAction: { label: 'New Project', icon: 'create_new_folder', action: 'new-project' }
  },
  'design-studio': {
    id: 'design-studio',
    title: 'Design Studio',
    subtitle: 'Asset-locked visual composition editor & rule-based AI assistant',
    icon: 'draw',
    primaryAction: { label: 'Export Output', icon: 'ios_share', action: 'go-export' }
  },
  'asset-library': {
    id: 'asset-library',
    title: 'Asset Library',
    subtitle: 'Immutable source-of-truth product photos, logos & brand elements',
    icon: 'photo_library',
    primaryAction: { label: 'Upload Assets', icon: 'upload_file', action: 'upload-asset' }
  },
  'brand-kit': {
    id: 'brand-kit',
    title: 'Brand Kit',
    subtitle: 'Identity colors, typography, product integrity & logo protection rules',
    icon: 'palette',
    primaryAction: { label: 'Save Brand Rules', icon: 'check', action: 'save-brand' }
  },
  templates: {
    id: 'templates',
    title: 'Templates',
    subtitle: 'Approved multi-format layout blueprints for product campaigns',
    icon: 'grid_view',
    primaryAction: { label: 'Save Active as Template', icon: 'bookmark_add', action: 'save-as-template' }
  },
  export: {
    id: 'export',
    title: 'Multi-Platform Export',
    subtitle: 'Rule-based aspect ratio adaptation & client-side PNG, JPEG, SVG rendering',
    icon: 'output',
    primaryAction: { label: 'Download Active Preset', icon: 'download', action: 'trigger-export' }
  },
  validation: {
    id: 'validation',
    title: 'Validation History & QA',
    subtitle: 'Automated brand compliance, WCAG contrast & asset integrity engine',
    icon: 'verified',
    primaryAction: { label: 'Run Validation Check', icon: 'play_arrow', action: 'run-validation' }
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Workspace preferences, canvas grid defaults & local data management',
    icon: 'settings',
    primaryAction: { label: 'Export Workspace JSON', icon: 'data_Object', action: 'export-json' }
  }
};

class Router {
  constructor() {
    this.currentRoute = 'dashboard';
    this.currentParams = {};
    this.handlers = new Map();
    this.onRouteChangeCallback = null;
  }

  register(routeId, renderFn) {
    this.handlers.set(routeId, renderFn);
  }

  onRouteChange(cb) {
    this.onRouteChangeCallback = cb;
  }

  parseHash(hashStr) {
    const raw = (hashStr || window.location.hash || '#dashboard').replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const routeId = ROUTES[pathPart] ? pathPart : 'dashboard';
    const params = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [k, v] of searchParams.entries()) {
        params[k] = v;
      }
    }
    return { routeId, params };
  }

  navigate(routeId, params = {}) {
    const validRoute = ROUTES[routeId] ? routeId : 'dashboard';
    const qs = new URLSearchParams(params).toString();
    const targetHash = qs ? `#${validRoute}?${qs}` : `#${validRoute}`;

    if (window.location.hash === targetHash) {
      this.handleLocationChange();
    } else {
      window.location.hash = targetHash;
    }
  }

  handleLocationChange() {
    const { routeId, params } = this.parseHash(window.location.hash);
    this.currentRoute = routeId;
    this.currentParams = params;

    // Close mobile sidebar drawer if open
    const sidebar = document.getElementById('app-sidebar');
    const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
    sidebar?.classList.remove('mobile-open');
    mobileBackdrop?.classList.add('hidden');

    if (typeof this.onRouteChangeCallback === 'function') {
      this.onRouteChangeCallback(routeId, params, ROUTES[routeId]);
    }

    const container = document.getElementById('app-view-container');
    if (!container) return;

    if (routeId === 'design-studio') {
      container.classList.add('studio-mode');
    } else {
      container.classList.remove('studio-mode');
    }

    const handler = this.handlers.get(routeId);
    if (typeof handler === 'function') {
      handler(container, params);
    }
  }

  start() {
    window.addEventListener('hashchange', () => this.handleLocationChange());
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#dashboard');
    }
    this.handleLocationChange();
  }
}

export const router = new Router();
