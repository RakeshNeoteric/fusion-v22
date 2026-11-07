import { TestBed } from '@angular/core/testing';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('says the dashboard is coming', async () => {
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h2')?.textContent).toBe('Dashboard');
    expect(host.textContent).toContain('Coming soon');
  });
});
