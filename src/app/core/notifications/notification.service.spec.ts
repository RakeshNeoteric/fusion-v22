import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MatSnackBar, type MatSnackBarConfig } from '@angular/material/snack-bar';
import { NotificationService } from './notification.service';
import { Toast, type ToastData } from './toast';

describe('NotificationService', () => {
  const openFromComponent = vi.fn<(component: unknown, config: MatSnackBarConfig) => void>();
  let service: NotificationService;

  beforeEach(() => {
    openFromComponent.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { openFromComponent } }],
    });
    service = TestBed.inject(NotificationService);
  });

  it('shows errors longer and announces them assertively', () => {
    service.error('Save failed');
    expect(openFromComponent).toHaveBeenCalledWith(
      Toast,
      expect.objectContaining({
        data: { kind: 'error', message: 'Save failed', durationMs: 6000 },
        duration: 6000,
        politeness: 'assertive',
        panelClass: ['app-notification', 'app-notification--error'],
      }),
    );
  });

  it('shows success messages politely, top right as in v21', () => {
    service.success('Saved');
    expect(openFromComponent).toHaveBeenCalledWith(
      Toast,
      expect.objectContaining({
        data: { kind: 'success', message: 'Saved', durationMs: 3000 },
        duration: 3000,
        politeness: 'polite',
        horizontalPosition: 'end',
        verticalPosition: 'top',
      }),
    );
  });
});

describe('Toast (v21 look)', () => {
  const toast = () => document.querySelector<HTMLElement>('app-toast');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } }],
    });
  });

  afterEach(() => TestBed.inject(MatSnackBar).dismiss());

  function show(data: ToastData): void {
    TestBed.inject(NotificationService)[data.kind](data.message);
    TestBed.tick();
  }

  it('shows the kind, icon, message and a progress bar timed to the toast', () => {
    show({ kind: 'warning', message: 'Name is required', durationMs: 5000 });
    const shown = toast();
    expect(shown?.classList).toContain('toast--warning');
    expect(shown?.querySelector('.toast-icon')?.textContent?.trim()).toBe('⚠️');
    expect(shown?.querySelector('.toast-message')?.textContent?.trim()).toBe('Name is required');
    expect(shown?.style.getPropertyValue('--toast-duration')).toBe('5000ms');
    expect(shown?.querySelector('.toast-progress')).not.toBeNull();
  });

  it('closes from its cross', async () => {
    show({ kind: 'success', message: 'Saved', durationMs: 3000 });
    toast()?.querySelector<HTMLButtonElement>('button[aria-label="Close"]')?.click();
    await vi.waitFor(() => {
      if (toast()) throw new Error('still open');
    });
  });

  it('closes when the toast itself is clicked, as in v21', async () => {
    show({ kind: 'info', message: 'Already saved', durationMs: 3000 });
    toast()?.click();
    await vi.waitFor(() => {
      if (toast()) throw new Error('still open');
    });
  });
});
