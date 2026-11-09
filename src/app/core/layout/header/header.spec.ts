import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '@core/icons/app-icons';
import { type SessionUser, SessionService } from '@core/session/session.service';
import { UserPhotoService } from '@core/session/user-photo.service';
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
  const photo = signal<string | null>(null);

  async function render(withProfile = true) {
    signOut.mockReset().mockResolvedValue();
    openProfile.mockReset().mockResolvedValue();
    photo.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        { provide: SessionService, useValue: { user: signal(user), signOut } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: UserPhotoService, useValue: { src: photo } },
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

  it("shows the user's photo instead of the initials when they have one (v21)", async () => {
    const { fixture, host } = await render();
    photo.set('blob:photo');
    await fixture.whenStable();
    const avatar = host.querySelector<HTMLImageElement>('img.avatar');
    expect(avatar?.getAttribute('src')).toBe('blob:photo');
    expect(avatar?.alt).toBe('');
    expect(host.querySelector('.user-chip')?.textContent).not.toContain('JD');
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

  it('opens My Profile straight from the user’s name, with no menu (v21)', async () => {
    const { fixture, host } = await render();
    host.querySelector<HTMLButtonElement>('button.user-chip')?.click();
    await fixture.whenStable();
    expect(openProfile).toHaveBeenCalledOnce();
    expect(document.querySelector('.mat-mdc-menu-panel')).toBeNull();
    expect(host.querySelector('.user-chip')?.textContent).not.toContain('expand');
  });

  it('only shows the name when the app provides no profile', async () => {
    const { host } = await render(false);
    expect(host.querySelector('button.user-chip')).toBeNull();
    expect(host.querySelector('.user-chip')?.textContent).toContain('Jane Doe');
  });

  it('asks the shell to toggle the sidebar', async () => {
    const { fixture, host } = await render();
    const toggled = vi.fn();
    fixture.componentInstance.menuToggle.subscribe(toggled);
    host.querySelector<HTMLButtonElement>('button[aria-label="Toggle navigation"]')?.click();
    expect(toggled).toHaveBeenCalledOnce();
  });
});
