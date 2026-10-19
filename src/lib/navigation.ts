export const NAVIGATION_GROUPS = ['Work', 'Projects', 'System', 'Tools', 'Usage'] as const;
export type NavigationGroup = typeof NAVIGATION_GROUPS[number];

export interface NavigationItem {
  id: string;
  label: string;
  group: NavigationGroup | null;
  href: string;
  shortcut?: string;
  external?: boolean;
  action?: 'shell';
}

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { id: 'overview', label: 'Overview', group: null, href: '/' },
  { id: 'setfarm', label: 'Setfarm', group: 'Work', href: '/setfarm', shortcut: '1' },
  { id: 'active-run', label: 'Active run', group: 'Work', href: '/setfarm/active', shortcut: 'D' },
  { id: 'live', label: 'Live feed', group: 'Work', href: '/live', shortcut: 'L' },
  { id: 'projects', label: 'Projects', group: 'Projects', href: '/projects', shortcut: '6' },
  { id: 'prd', label: 'PRD generator', group: 'Projects', href: '/prd', shortcut: 'P' },
  { id: 'ops', label: 'Operations', group: 'System', href: '/ops', shortcut: '3' },
  { id: 'controls', label: 'Controls', group: 'System', href: '/controls' },
  { id: 'changelog', label: 'Changelog', group: 'System', href: '/changelog', external: true },
  { id: 'dashboard', label: 'Setfarm dashboard :3333', group: 'System', href: 'http://127.0.0.1:3333', external: true },
  { id: 'office', label: 'Office', group: 'Tools', href: '/office', shortcut: '0' },
  { id: 'chat', label: 'Chat', group: 'Tools', href: '/chat', shortcut: '2' },
  { id: 'agents', label: 'Agent catalog', group: 'Tools', href: '/agents' },
  { id: 'files', label: 'Files', group: 'Tools', href: '/files', shortcut: '7' },
  { id: 'scrape', label: 'Scrape', group: 'Tools', href: '/scrape', shortcut: '9' },
  { id: 'rules', label: 'Rules', group: 'Tools', href: '/rules', shortcut: 'R' },
  { id: 'workflows', label: 'Workflows', group: 'Tools', href: '/workflows' },
  { id: 'tasks', label: 'Tasks', group: 'Tools', href: '/tasks' },
  { id: 'shell', label: 'Shell', group: 'Tools', href: '', shortcut: '8', action: 'shell' },
  { id: 'costs', label: 'Costs', group: 'Usage', href: '/costs', shortcut: '4' },
  { id: 'performance', label: 'Performance', group: 'Usage', href: '/performance', shortcut: '5' },
];

export function filterNavigationItems(query: string): NavigationItem[] {
  const term = query.trim().toLowerCase();
  return NAVIGATION_ITEMS.filter(item => `${item.label} ${item.group ?? ''} ${item.href}`.toLowerCase().includes(term));
}

export function isNavigationItemActive(item: NavigationItem, pathname: string): boolean {
  if (item.external || item.action) return false;
  if (item.id === 'active-run') return pathname === item.href || pathname.startsWith('/setfarm/runs/');
  if (item.id === 'performance' && pathname === '/perf') return true;
  if (item.href === '/' || item.id === 'setfarm') return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type NavigationShortcut = { type: 'navigate'; href: string } | { type: 'shell' };

export function resolveNavigationShortcut(event: KeyboardEvent): NavigationShortcut | null {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return null;
  // Avoid HTMLElement/Element globals so resolution is safe during SSR too.
  const target = event.target as HTMLElement | null;
  if (target && (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable ||
    target.closest?.('[contenteditable]:not([contenteditable="false"])')
  )) return null;
  const item = NAVIGATION_ITEMS.find(candidate => candidate.shortcut?.toLowerCase() === event.key.toLowerCase());
  if (!item) return null;
  return item.action === 'shell' ? { type: 'shell' } : { type: 'navigate', href: item.href };
}
