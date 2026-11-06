import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SessionService } from '@core/session/session.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly menuToggle = output();

  private readonly session = inject(SessionService);
  private readonly confirm = inject(ConfirmService);

  protected readonly user = this.session.user;
  protected readonly initials = computed(() => initialsOf(this.user()?.displayName ?? ''));

  protected async signOut(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign out',
      tone: 'danger',
    });
    if (confirmed) {
      await this.session.signOut();
    }
  }
}

export function initialsOf(name: string): string {
  // For an email, use the part before @: "jane.doe@example.com" → JD.
  const parts = (name.split('@')[0] ?? '').split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}
