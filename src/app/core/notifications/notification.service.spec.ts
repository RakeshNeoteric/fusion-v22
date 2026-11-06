import { TestBed } from '@angular/core/testing';
import { MatSnackBar, type MatSnackBarConfig } from '@angular/material/snack-bar';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  const open = vi.fn<(message: string, action: string, config: MatSnackBarConfig) => void>();
  let service: NotificationService;

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: { open } }] });
    service = TestBed.inject(NotificationService);
  });

  it('shows errors longer and announces them assertively', () => {
    service.error('Save failed');
    expect(open).toHaveBeenCalledWith(
      'Save failed',
      'Close',
      expect.objectContaining({
        duration: 6000,
        politeness: 'assertive',
        panelClass: ['app-notification', 'app-notification--error'],
      }),
    );
  });

  it('shows success messages politely', () => {
    service.success('Saved');
    expect(open).toHaveBeenCalledWith(
      'Saved',
      'Close',
      expect.objectContaining({
        duration: 3000,
        politeness: 'polite',
        panelClass: ['app-notification', 'app-notification--success'],
      }),
    );
  });
});
