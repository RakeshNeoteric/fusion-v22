import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmService } from './confirm-dialog';

describe('ConfirmService', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((element) => element.remove());
  });

  /** Waits until the dialog is open and rendered (zoneless: rendering is scheduled, not immediate). */
  async function dialogButtons(): Promise<HTMLButtonElement[]> {
    const buttons = await vi.waitFor(() => {
      const found = [...document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button')];
      if (found.length !== 2) throw new Error('dialog not open yet');
      return found;
    });
    await TestBed.inject(ApplicationRef).whenStable();
    return buttons;
  }

  it('shows the title, message and button texts', async () => {
    void TestBed.inject(ConfirmService).ask({
      title: 'Delete client',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
    });
    const [cancel, confirm] = await dialogButtons();
    expect(document.querySelector('[mat-dialog-title]')?.textContent).toContain('Delete client');
    expect(document.querySelector('mat-dialog-content')?.textContent).toContain(
      'This cannot be undone.',
    );
    expect(cancel?.textContent?.trim()).toBe('Cancel');
    expect(confirm?.textContent?.trim()).toBe('Delete');
    // v21 look: red Cancel, teal confirm.
    expect(cancel?.classList).toContain('app-button--cancel');
    expect(confirm?.classList).not.toContain('app-button--cancel');
    cancel?.click();
  });

  it('resolves true when confirmed', async () => {
    const answer = TestBed.inject(ConfirmService).ask({ title: 'Sure?', message: 'Really?' });
    const [, confirm] = await dialogButtons();
    confirm?.click();
    await expect(answer).resolves.toBe(true);
  });

  it('resolves false when closed with ×', async () => {
    const answer = TestBed.inject(ConfirmService).ask({ title: 'Sure?', message: 'Really?' });
    await dialogButtons();
    document.querySelector<HTMLButtonElement>('.dialog-close')?.click();
    await expect(answer).resolves.toBe(false);
  });

  it('resolves false when cancelled', async () => {
    const answer = TestBed.inject(ConfirmService).ask({ title: 'Sure?', message: 'Really?' });
    const [cancel] = await dialogButtons();
    cancel?.click();
    await expect(answer).resolves.toBe(false);
  });
});
