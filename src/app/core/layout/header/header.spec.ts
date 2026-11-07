import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '@core/icons/app-icons';
import { type SessionUser, SessionService } from '@core/session/session.service';
import { ConfirmService } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Header, initialsOf } from './header';
import { PROFILE_EDITOR } from './profile-editor';

describe('initialsOf', () => {
  it.each([
    ['Jane Doe', 'JD'],
    ['Jane van der Berg', 'JB'],
    ['jane', 'J'],
    ['jane.doe@example.com', 'JD'],
    ['', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('Header', () => {
  const user: SessionUser = {
    id: 7,
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    displayName: 'Jane Doe',
    roles: ['Case Controller', 'Admin'],
  };
  const signOut = vi.fn<() => Promise<void>>();
  const ask = vi.fn<() => Promise<boolean>>();

  const openProfile = vi.fn<() => Promise<void>>();

  async function render(withProfile = true) {
    signOut.mockReset().mockResolvedValue();
    openProfile.mockReset().mockResolvedValue();
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        { provide: SessionService, useValue: { user: signal(user), signOut } },
        { provide: ConfirmService, useValue: { ask } },
        ...(withProfile ? [{ provide: PROFILE_EDITOR, useValue: { open: openProfile } }] : []),
      ],
    });
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  function signOutButton(host: HTMLElement): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Sign out"]');
    if (!button) throw new Error('sign-out button not rendered');
    return button;
  }

  it('welcomes the signed-in user', async () => {
    const { host } = await render();
    expect(host.querySelector('.user-chip')?.textContent).toContain('Jane Doe');
    expect(host.querySelector('.avatar')?.textContent?.trim()).toBe('JD');
  });

  it('signs out after confirmation', async () => {
    ask.mockResolvedValue(true);
    const { fixture, host } = await render();
    signOutButton(host).click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it('stays signed in when the user cancels', async () => {
    ask.mockResolvedValue(false);
    const { fixture, host } = await render();
    signOutButton(host).click();
    await fixture.whenStable();
    expect(ask).toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  function menuItem(text: string): HTMLButtonElement | undefined {
    return [...document.querySelectorAll<HTMLButtonElement>('[mat-menu-item]')].find((item) =>
      item.textContent?.includes(text),
    );
  }

  it('opens My Profile from the user menu (v21 user popup)', async () => {
    const { fixture, host } = await render();
    host.querySelector<HTMLButtonElement>('.user-chip')?.click();
    await fixture.whenStable();
    menuItem('My Profile')?.click();
    expect(openProfile).toHaveBeenCalledOnce();
  });

  it('offers no My Profile when the app provides none', async () => {
    const { fixture, host } = await render(false);
    host.querySelector<HTMLButtonElement>('.user-chip')?.click();
    await fixture.whenStable();
    expect(menuItem('Sign out')).toBeDefined();
    expect(menuItem('My Profile')).toBeUndefined();
  });

  it('asks the shell to toggle the sidebar', async () => {
    const { fixture, host } = await render();
    const toggled = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(toggled);
    host.querySelector<HTMLButtonElement>('button[aria-label="Toggle navigation"]')?.click();
    expect(toggled).toHaveBeenCalledOnce();
  });
});
