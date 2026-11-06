import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { provideAppIcons } from '@core/icons/app-icons';
import { NotificationService } from '@core/notifications/notification.service';
import { type SessionState, SessionService } from '@core/session/session.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  const login = vi.fn<(email: string, returnUrl: string | null) => Promise<void>>();
  const signOut = vi.fn<() => Promise<void>>();
  const notifyError = vi.fn<(message: string) => void>();
  const state = signal<SessionState>({ status: 'signed-out' });

  async function render(returnUrl?: string) {
    login.mockReset().mockResolvedValue();
    signOut.mockReset().mockResolvedValue();
    notifyError.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideAppIcons(),
        { provide: AuthService, useValue: { login, email: signal('jane@example.com') } },
        { provide: SessionService, useValue: { state, signOut } },
        { provide: NotificationService, useValue: { error: notifyError } },
      ],
    });
    const fixture = TestBed.createComponent(LoginPage);
    if (returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  async function submit(
    host: HTMLElement,
    fixture: { whenStable(): Promise<unknown> },
    email: string,
  ) {
    const input = host.querySelector<HTMLInputElement>('input[type="email"]');
    if (!input) throw new Error('email input not rendered');
    input.value = email;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  beforeEach(() => state.set({ status: 'signed-out' }));

  it('starts Microsoft sign-in with the email and the return URL', async () => {
    const { fixture, host } = await render('/client/client');
    await submit(host, fixture, 'jane@example.com');
    expect(login).toHaveBeenCalledWith('jane@example.com', '/client/client');
    expect(host.querySelector('button[type="submit"]')?.textContent).toContain('Opening Microsoft');
  });

  it('drops an unsafe return URL', async () => {
    const { fixture, host } = await render('//evil.com');
    await submit(host, fixture, 'jane@example.com');
    expect(login).toHaveBeenCalledWith('jane@example.com', null);
  });

  it('does not sign in with an invalid email', async () => {
    const { fixture, host } = await render();
    await submit(host, fixture, 'not-an-email');
    expect(login).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Enter a valid email address');
  });

  it('explains a denied sign-in and offers to sign out of Microsoft', async () => {
    state.set({
      status: 'denied',
      reason: 'Your Microsoft account is not registered in Fusion Edge.',
    });
    const { fixture, host } = await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('not registered');
    expect(host.textContent).toContain('Signed in to Microsoft as jane@example.com');
    expect(host.querySelector('form')).toBeNull();

    const button = [...host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Sign out'),
    );
    button?.click();
    await fixture.whenStable();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('shows a startup error with the sign-in form still available', async () => {
    state.set({ status: 'error', reason: 'Fusion Edge could not start. Please try again.' });
    const { host } = await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not start');
    expect(host.textContent).toContain('Try again');
    expect(host.querySelector('form')).not.toBeNull();
  });

  it('reports when Microsoft sign-in cannot be opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { fixture, host } = await render();
    login.mockRejectedValue(new Error('popup_window_error'));
    await submit(host, fixture, 'jane@example.com');
    await vi.waitFor(() => expect(notifyError).toHaveBeenCalledOnce());
  });
});
