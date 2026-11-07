import { TestBed } from '@angular/core/testing';
import { InternalReportsPage } from './internal-reports-page';

describe('InternalReportsPage', () => {
  it('says the reports are coming', async () => {
    const fixture = TestBed.createComponent(InternalReportsPage);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h2')?.textContent).toBe('Internal Reports');
    expect(host.textContent).toContain('Coming soon');
  });
});
