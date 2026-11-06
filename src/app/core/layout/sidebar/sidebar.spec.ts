import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { MenuConfig } from '@api/models/app.models';
import { SessionService } from '@core/session/session.service';
import { menu } from '../../../../testing/app-init.fixtures';
import { Sidebar } from './sidebar';
import { buildSidebar } from './sidebar-model';

/** Shaped like the real MenuConfiguration table. */
const MENUS: MenuConfig[] = [
  menu({
    MenuId: 30,
    MenuPath: 'Configuration/ Branches',
    DisplayName: 'Branches',
    MenuViewName: 'Branches',
    Icon: 'branches.png',
  }),
  menu({
    MenuId: 1,
    MenuPath: 'Home',
    DisplayName: 'Home',
    MenuViewName: 'Home',
    Icon: 'home.png',
  }),
  menu({ MenuId: 2, MenuPath: 'DashBoard', DisplayName: 'Dashboard', MenuViewName: 'DashBoard' }),
  menu({ MenuId: 10, MenuPath: 'Cases/ Cases', DisplayName: 'Calls', MenuViewName: 'Cases' }),
  menu({
    MenuId: 21,
    MenuPath: 'Client/ Client',
    DisplayName: 'Client',
    MenuViewName: 'Client/Client',
  }),
  menu({
    MenuId: 20,
    MenuPath: 'Client/ Client Group',
    DisplayName: 'Client Group',
    MenuViewName: 'Client/Client-Group',
  }),
  menu({
    MenuId: 25,
    MenuPath: 'Configuration/ Body Locations',
    DisplayName: 'Body Locations',
    MenuViewName: 'Body-Location',
  }),
  menu({ MenuId: 40, MenuPath: 'Security/ Users', DisplayName: 'Users', MenuViewName: 'Users' }),
  menu({ MenuId: 50, MenuPath: 'Mystery/ Thing', DisplayName: 'Thing', MenuViewName: 'Thing' }),
  menu({
    MenuId: 60,
    MenuPath: 'Security/ Old',
    DisplayName: 'Old',
    MenuViewName: 'Old',
    IsActive: false,
  }),
  menu({
    MenuId: 61,
    MenuPath: 'Security/ Unset',
    DisplayName: 'Unset',
    MenuViewName: 'Unset',
    IsActive: null,
  }),
  menu({ MenuId: 70, MenuPath: 'Orphan', DisplayName: 'Orphan', MenuViewName: 'Orphan' }),
];

describe('buildSidebar (v21 rules)', () => {
  const model = buildSidebar(MENUS);

  it('puts Home and Dashboard at the top', () => {
    expect(model.topLevel.map((item) => item.label)).toEqual(['Home', 'Dashboard']);
  });

  it('groups by section in the fixed order, "Cases" under Call Centre, unknown under General', () => {
    expect(model.sections.map((section) => section.title)).toEqual([
      'Call Centre',
      'Client',
      'Configuration',
      'Security',
      'General',
    ]);
    expect(model.sections.find((s) => s.title === 'General')?.items.map((i) => i.label)).toEqual([
      'Thing',
    ]);
  });

  it('sorts items by MenuId within a section', () => {
    const client = model.sections.find((s) => s.title === 'Client');
    expect(client?.items.map((i) => i.label)).toEqual(['Client Group', 'Client']);
  });

  it('builds lower-case routes from MenuViewName (same URLs as v21)', () => {
    const routes = [...model.topLevel, ...model.sections.flatMap((s) => s.items)].map(
      (i) => i.route,
    );
    expect(routes).toEqual([
      '/home',
      '/dashboard',
      '/cases',
      '/client/client-group',
      '/client/client',
      '/body-location',
      '/branches',
      '/users',
      '/thing',
    ]);
  });

  it('hides inactive menus, menus with unknown activity and menus without a section', () => {
    const labels = model.sections.flatMap((s) => s.items).map((i) => i.label);
    expect(labels).not.toContain('Old');
    expect(labels).not.toContain('Unset');
    expect(labels).not.toContain('Orphan');
  });

  it('uses the menu icon or the default icon', () => {
    expect(model.topLevel[0]?.iconUrl).toBe('/icons/menu/home.png');
    expect(model.topLevel[1]?.iconUrl).toBe('/icons/menu/default.png');
  });
});

describe('Sidebar', () => {
  async function render() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { menus: signal(MENUS) } },
      ],
    });
    const fixture = TestBed.createComponent(Sidebar);
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav');
    if (!nav) throw new Error('nav not rendered');
    return { fixture, nav };
  }

  it('renders the menu links and section titles', async () => {
    const { nav } = await render();
    const links = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toContain('/client/client');
    expect(nav.textContent).toContain('Call Centre');
  });

  it('starts collapsed and expands while hovered', async () => {
    const { fixture, nav } = await render();
    expect(nav.classList).toContain('collapsed');

    nav.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(nav.classList).not.toContain('collapsed');

    nav.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    expect(nav.classList).toContain('collapsed');
  });

  it('stays expanded when pinned', async () => {
    const { fixture, nav } = await render();
    fixture.componentRef.setInput('pinned', true);
    await fixture.whenStable();
    expect(nav.classList).not.toContain('collapsed');
  });
});
