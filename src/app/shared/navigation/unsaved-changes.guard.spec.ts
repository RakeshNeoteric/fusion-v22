import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { type HasUnsavedChanges, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const ask = vi.fn<() => Promise<boolean>>();

  beforeEach(() => {
    ask.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ConfirmService, useValue: { ask } }] });
  });

  function leave(page: HasUnsavedChanges) {
    return TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(
        page,
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
  }

  it('lets the user leave a page without unsaved changes', () => {
    expect(leave({ hasUnsavedChanges: () => false })).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'asks first when there are unsaved changes (answer: %s)',
    async (answer) => {
      ask.mockResolvedValue(answer);
      await expect(leave({ hasUnsavedChanges: () => true })).resolves.toBe(answer);
      expect(ask).toHaveBeenCalledOnce();
    },
  );
});
