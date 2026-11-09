import type { Provider } from '@angular/core';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';

/**
 * The popup sizes. Every popup picks one instead of its own pixel width, so popups look
 * consistent and all fit small screens the same way (see RESPONSIVE.md).
 *
 * - `xs` 420px: confirmations, short pickers
 * - `sm` 640px: one short form (Reject reason)
 * - `md` 800px: a standard form (most record popups)
 * - `lg` 1000px: a form with a table, or two columns of fields
 * - `xl` 1200px: big work popups (Client, Service Provider, Phase Costing)
 */
export type DialogSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const WIDTH_PX: Readonly<Record<DialogSize, number>> = {
  xs: 420,
  sm: 640,
  md: 800,
  lg: 1000,
  xl: 1200,
};

/** Never wider or taller than the window: a margin is kept and the popup scrolls inside. */
export const DIALOG_MAX_WIDTH = '96vw';
export const DIALOG_MAX_HEIGHT = '92vh';

/**
 * A full-height panel down the right of the window (v21 drawer, e.g. Contact Log Details), not a
 * centred popup: its own size, and not held to the popup limits. The one place a popup's size
 * is written in CSS units, so the lint rule allows it here only.
 */
export const SIDE_PANEL = {
  position: { right: '0', top: '0' },
  /* eslint-disable no-restricted-syntax -- the drawer's own size (see above) */
  height: '100vh',
  width: 'min(460px, 100vw)',
  maxWidth: '100vw',
  maxHeight: '100vh',
  /* eslint-enable no-restricted-syntax */
  panelClass: 'app-side-panel',
} as const satisfies MatDialogConfig;

/** The width for `MatDialog.open(..., { ...dialogSize('md'), data })`. */
export function dialogSize(size: DialogSize): Pick<MatDialogConfig, 'width'> {
  return { width: `${WIDTH_PX[size]}px` };
}

/**
 * Limits for every popup, set once for the app. Material's own limit is 80% of the window,
 * which squeezes the big popups on a laptop for no reason.
 */
export function provideDialogDefaults(): Provider {
  return {
    provide: MAT_DIALOG_DEFAULT_OPTIONS,
    useValue: {
      ...new MatDialogConfig(),
      maxWidth: DIALOG_MAX_WIDTH,
      maxHeight: DIALOG_MAX_HEIGHT,
    } satisfies MatDialogConfig,
  };
}
