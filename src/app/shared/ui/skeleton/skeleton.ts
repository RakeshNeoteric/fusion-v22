import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** `line` for text, `box` for a field or button, `circle` for an avatar or round icon. */
export type SkeletonShape = 'line' | 'box' | 'circle';

/** `grey` for text and fields; `teal` for what is teal on the real screen (tabs, icon buttons). */
export type SkeletonTone = 'grey' | 'teal';

/**
 * A grey placeholder block with a soft shimmer, shown where content will appear while it loads.
 * Build a screen's loading state from these in the screen's own layout, so nothing moves when the
 * real content arrives. Hidden from screen readers: the screen says "Loading …" in a status
 * region instead.
 *
 * The blocks fade in after 200ms, so a quick load never flashes grey. One shimmer sweeps across
 * the whole screen (every block shares it), and stops for users who ask for reduced motion.
 *
 *     <app-skeleton width="320px" height="24px" />
 *     <app-skeleton shape="box" height="40px" />
 *     <app-skeleton shape="box" tone="teal" width="48px" height="48px" />
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-shape]': 'shape()',
    '[attr.data-tone]': 'tone()',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  template: '',
  styles: `
    :host {
      --skeleton-base: #e9eef0;
      --skeleton-shine: #f6f9fa;

      display: block;
      flex: none;
      max-width: 100%;
      border-radius: 6px;
      /* Sized to the screen and fixed to it, so every block shows part of one sweep. */
      background: linear-gradient(
          100deg,
          var(--skeleton-base) 40%,
          var(--skeleton-shine) 50%,
          var(--skeleton-base) 60%
        )
        0 0 / 200vw 100% fixed;
      animation:
        skeleton-appear 150ms ease-in 200ms both,
        skeleton-shimmer 1.6s linear infinite;
    }
    :host([data-tone='teal']) {
      --skeleton-base: #dcf3f3;
      --skeleton-shine: #effbfb;
    }
    :host([data-shape='box']) {
      border-radius: 8px;
    }
    :host([data-shape='circle']) {
      border-radius: 50%;
    }
    @keyframes skeleton-appear {
      from {
        opacity: 0;
      }
    }
    @keyframes skeleton-shimmer {
      from {
        background-position: 100vw 0;
      }
      to {
        background-position: -100vw 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: skeleton-appear 150ms ease-in 200ms both;
      }
    }
  `,
})
export class Skeleton {
  /** Any CSS width; fills its container by default. */
  readonly width = input('100%');
  /** Any CSS height; one line of text by default. */
  readonly height = input('16px');
  readonly shape = input<SkeletonShape>('line');
  readonly tone = input<SkeletonTone>('grey');
}
