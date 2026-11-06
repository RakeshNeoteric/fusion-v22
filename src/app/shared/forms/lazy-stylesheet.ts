import { DOCUMENT, inject } from '@angular/core';

/**
 * Adds a stylesheet built as a separate, non-injected bundle (angular.json `"inject": false`)
 * the first time a screen needs it, so other screens do not download it. Call in an
 * injection context, e.g. a constructor.
 */
export function useLazyStylesheet(href: string): void {
  const document = inject(DOCUMENT);
  if (document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}
