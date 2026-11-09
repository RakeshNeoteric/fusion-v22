import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Skeleton } from '@shared/ui/skeleton/skeleton';
import { SkeletonFields } from '@shared/ui/skeleton/skeleton-fields';

/**
 * The case page while the case loads, in the page's own layout: the header with its action icons,
 * the teal folder tabs, and a tab's sections of fields. The real page then appears in the same
 * place. Screen readers hear "Loading case…".
 */
@Component({
  selector: 'app-case-details-skeleton',
  imports: [Skeleton, SkeletonFields],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="cds-hidden" role="status">Loading case…</p>
    <div class="cds-card">
      <div class="cds-header">
        <app-skeleton class="cds-title" width="380px" height="22px" />
        <div class="cds-actions">
          @for (action of actions; track $index) {
            <app-skeleton shape="box" tone="teal" width="48px" height="48px" />
          }
        </div>
      </div>

      <div>
        <div class="cds-tabs">
          @for (width of tabs; track $index) {
            <app-skeleton class="cds-tab" tone="teal" [width]="width" height="40px" />
          }
        </div>
        <app-skeleton class="cds-tab-line" tone="teal" height="7px" />

        <div class="cds-panel">
          @for (section of sections; track $index) {
            <app-skeleton [width]="section.title" height="20px" />
            <app-skeleton-fields [count]="section.fields" />
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .cds-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* The page's white card and header box. */
    .cds-card {
      display: flex;
      flex-direction: column;
      gap: 40px;
      padding: 40px;
      border-radius: 10px;
      background: #fff;
    }
    .cds-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 12px 12px 20px;
      border: 1px solid #f0f0f0;
      border-radius: 10px;
      box-shadow: 0 0 5px #e0e0e0;
    }
    .cds-title {
      flex: 0 1 380px;
    }
    .cds-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* The folder tabs: same slanted edge and teal line underneath. */
    .cds-tabs {
      display: flex;
      gap: 4px;
      overflow: hidden;
    }
    .cds-tab {
      border-radius: 0;
      clip-path: polygon(0 0, 90% 0, 100% 100%, 0 100%);
    }
    .cds-tab-line {
      border-radius: 0;
    }

    .cds-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-top: 28px;
    }
    @media (width <= 600px) {
      .cds-card {
        padding: 20px;
      }
    }
  `,
})
export class CaseDetailsSkeleton {
  /** Vehicle Tracker, Case Stages, Messages, Exit and More. */
  protected readonly actions = Array.from({ length: 5 });
  protected readonly tabs = ['110px', '150px', '130px', '150px', '120px', '110px'];
  /** A tab's sections: the width of each title and how many fields it has. */
  protected readonly sections = [
    { title: '200px', fields: 6 },
    { title: '160px', fields: 3 },
  ];
}
