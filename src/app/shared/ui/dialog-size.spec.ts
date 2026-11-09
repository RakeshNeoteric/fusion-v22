import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, type MatDialogConfig } from '@angular/material/dialog';
import {
  DIALOG_MAX_HEIGHT,
  DIALOG_MAX_WIDTH,
  dialogSize,
  provideDialogDefaults,
} from './dialog-size';

describe('Popup sizes', () => {
  it('has five standard widths', () => {
    expect(['xs', 'sm', 'md', 'lg', 'xl'].map((size) => dialogSize(size as never).width)).toEqual([
      '420px',
      '640px',
      '800px',
      '1000px',
      '1200px',
    ]);
  });

  it('keeps every popup inside the window, with Material defaults kept', () => {
    TestBed.configureTestingModule({ providers: [provideDialogDefaults()] });
    const defaults = TestBed.inject<MatDialogConfig>(MAT_DIALOG_DEFAULT_OPTIONS);
    expect(defaults.maxWidth).toBe(DIALOG_MAX_WIDTH);
    expect(defaults.maxHeight).toBe(DIALOG_MAX_HEIGHT);
    // Material's own defaults are still there (not replaced by a partial object).
    expect(defaults.hasBackdrop).toBe(true);
    expect(defaults.role).toBe('dialog');
  });
});
