import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AppIconName } from '@core/icons/app-icons';
import { DialogHeader } from './dialog-header';

@Component({
  imports: [DialogHeader],
  template: `<app-dialog-header
    title="Edit User"
    [icon]="icon()"
    (closed)="closes = closes + 1"
  />`,
})
class Host {
  readonly icon = signal<AppIconName | null>('edit');
  closes = 0;
}

describe('DialogHeader', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the title with its icon', async () => {
    const { element } = await render();
    const title = element.querySelector('.dialog-title');
    expect(title?.textContent?.trim()).toBe('Edit User');
    expect(title?.querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('edit');
  });

  it('shows no icon when none is given', async () => {
    const { fixture, element } = await render();
    fixture.componentInstance.icon.set(null);
    await fixture.whenStable();
    expect(element.querySelector('mat-icon')).toBeNull();
  });

  it('reports ×, leaving the closing to the popup', async () => {
    const { fixture, element } = await render();
    const close = element.querySelector<HTMLButtonElement>('.dialog-close');
    expect(close?.getAttribute('aria-label')).toBe('Close');
    close?.click();
    expect(fixture.componentInstance.closes).toBe(1);
  });
});
