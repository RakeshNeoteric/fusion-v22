import { TestBed } from '@angular/core/testing';
import { ComingSoon } from './coming-soon';

describe('ComingSoon', () => {
  it('names the screen and what it will offer', async () => {
    const fixture = TestBed.createComponent(ComingSoon);
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.componentRef.setInput('summary', 'case figures at a glance.');
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('h2')?.textContent).toBe('Dashboard');
    expect(host.querySelector('p')?.textContent).toBe('Coming soon: case figures at a glance.');
    expect(host.querySelector('section')?.getAttribute('aria-labelledby')).toBe(
      'coming-soon-title',
    );
  });
});
