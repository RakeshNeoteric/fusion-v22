import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

const STATUS_PAGE_STYLES = `
  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    margin: 64px auto;
    text-align: center;
  }
  .status mat-icon {
    width: 48px;
    height: 48px;
    color: var(--app-navy);
  }
  .status h2 {
    margin: 0;
  }
  .status p {
    margin: 0 0 8px;
    color: #555;
  }
`;

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="status">
      <mat-icon svgIcon="lock" />
      <h2>Access denied</h2>
      <p>
        You do not have permission to open this page. Contact your administrator if you need access.
      </p>
      <a mat-flat-button routerLink="/home">Go to Home</a>
    </section>
  `,
  styles: STATUS_PAGE_STYLES,
})
export class ForbiddenPage {}

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="status">
      <mat-icon svgIcon="search" />
      <h2>Page not found</h2>
      <p>The page you are looking for does not exist.</p>
      <a mat-flat-button routerLink="/home">Go to Home</a>
    </section>
  `,
  styles: STATUS_PAGE_STYLES,
})
export class NotFoundPage {}
