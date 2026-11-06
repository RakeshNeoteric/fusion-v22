import type { MenuConfig } from '@api/models/app.models';

export interface SidebarItem {
  readonly id: number;
  readonly label: string;
  /** App route, e.g. `/client/client`. */
  readonly route: string;
  readonly iconUrl: string;
}

export interface SidebarSection {
  readonly title: string;
  readonly items: readonly SidebarItem[];
}

export interface SidebarModel {
  readonly topLevel: readonly SidebarItem[];
  readonly sections: readonly SidebarSection[];
}

/** Sidebar section order (v21). Sections not listed here are shown under "General". */
export const SECTION_ORDER = [
  'Reports',
  'Call Centre',
  'Client',
  'Services',
  'Rating Questions',
  'Configuration',
  'Transport',
  'Security',
  'Company',
  'Admin',
  'Import',
  'Sms',
  'General',
] as const;

const TOP_LEVEL_PATHS: readonly string[] = ['Home', 'DashBoard'];
const DEFAULT_ICON = 'default.png';

/**
 * Builds the sidebar from AppInit's menu configuration, with v21's rules:
 * - only active menus (`IsActive` true)
 * - `MenuPath` "Home" / "DashBoard" are shown at the top
 * - `MenuPath` "Section/ Name" goes under its section ("Cases" is shown as "Call Centre")
 * - other menus are not shown
 * - route is `/` + lower-cased `MenuViewName`; items sorted by `MenuId`
 */
export function buildSidebar(menus: readonly MenuConfig[]): SidebarModel {
  const active = menus.filter((menu) => menu.IsActive === true);
  const topLevel = active.filter((menu) => TOP_LEVEL_PATHS.includes(menu.MenuPath));

  const bySection = new Map<string, MenuConfig[]>();
  const grouped = active
    .filter((menu) => menu.MenuPath.includes('/') && !TOP_LEVEL_PATHS.includes(menu.MenuPath))
    .sort((a, b) => a.MenuId - b.MenuId);
  for (const menu of grouped) {
    const section = sectionOf(menu.MenuPath);
    const items = bySection.get(section) ?? [];
    items.push(menu);
    bySection.set(section, items);
  }

  return {
    topLevel: topLevel.map(toItem),
    sections: SECTION_ORDER.flatMap((title) => {
      const items = bySection.get(title);
      return items ? [{ title, items: items.map(toItem) }] : [];
    }),
  };
}

function sectionOf(menuPath: string): string {
  const name = (menuPath.split('/')[0] ?? '').trim();
  if (name === 'Cases' || name === 'Call Centre') return 'Call Centre';
  return (SECTION_ORDER as readonly string[]).includes(name) ? name : 'General';
}

function toItem(menu: MenuConfig): SidebarItem {
  return {
    id: menu.MenuId,
    label: menu.DisplayName,
    route: `/${menu.MenuViewName.toLowerCase()}`,
    iconUrl: `/icons/menu/${menu.Icon || DEFAULT_ICON}`,
  };
}
