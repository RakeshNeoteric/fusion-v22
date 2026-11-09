import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BusyButton } from './busy-button';

@Component({
  imports: [BusyButton],
  template: `
    <button type="button" [disabled]="busy()" [appBusy]="busy()" busyText="Sending…">Send</button>
  `,
})
class Host {
  readonly busy = signal(false);
}

describe('BusyButton', () => {
  it('shows its label, then a spinner and what it is doing while busy', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.textContent?.trim()).toBe('Send');
    expect(button?.getAttribute('aria-busy')).toBeNull();
    expect(button?.querySelector('app-spinner')).toBeNull();

    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();
    expect(button?.textContent?.trim()).toBe('Sending…');
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(button?.querySelector('app-spinner')).not.toBeNull();
    expect(button?.disabled).toBe(true);

    fixture.componentInstance.busy.set(false);
    await fixture.whenStable();
    expect(button?.textContent?.trim()).toBe('Send');
  });
});
