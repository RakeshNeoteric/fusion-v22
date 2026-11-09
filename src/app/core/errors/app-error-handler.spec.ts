import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '@core/http/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import {
  APP_UPDATED_MESSAGE,
  AppErrorHandler,
  REPEAT_QUIET_MS,
  UNEXPECTED_ERROR_MESSAGE,
} from './app-error-handler';

describe('AppErrorHandler', () => {
  const notifications = { error: vi.fn() };
  let handler: ErrorHandler;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifications.error.mockReset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useExisting: AppErrorHandler },
        { provide: NotificationService, useValue: notifications },
      ],
    });
    handler = TestBed.inject(ErrorHandler);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('tells the user kindly and keeps the details for developers', () => {
    const fault = new TypeError("Cannot read properties of null (reading 'trim')");
    handler.handleError(fault);

    expect(notifications.error).toHaveBeenCalledWith(UNEXPECTED_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[App] Unexpected error on'),
      fault,
    );
  });

  it('unwraps a rejected promise', () => {
    const fault = new Error('boom');
    handler.handleError({ rejection: fault });
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), fault);
    expect(notifications.error).toHaveBeenCalledTimes(1);
  });

  it('shows a repeating error once, and again after a quiet while', () => {
    vi.useFakeTimers();
    handler.handleError(new Error('a'));
    handler.handleError(new Error('b'));
    vi.advanceTimersByTime(REPEAT_QUIET_MS - 1);
    handler.handleError(new Error('c'));
    expect(notifications.error).toHaveBeenCalledTimes(1);
    // Every one is still logged.
    expect(consoleError).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(1);
    handler.handleError(new Error('d'));
    expect(notifications.error).toHaveBeenCalledTimes(2);
  });

  it('does not repeat a server failure: the error interceptor already showed it', () => {
    handler.handleError(new ApiError(500, 'Something went wrong on the server.', 'SQL …'));
    handler.handleError(new HttpErrorResponse({ status: 404 }));
    expect(notifications.error).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(2);
  });

  it('ignores harmless browser noise', () => {
    handler.handleError(new Error('ResizeObserver loop completed with undelivered notifications.'));
    handler.handleError('ResizeObserver loop limit exceeded');
    expect(notifications.error).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('asks for a refresh when a new version was released meanwhile', () => {
    handler.handleError(
      new TypeError('Failed to fetch dynamically imported module: https://x/chunk-ABC.js'),
    );
    expect(notifications.error).toHaveBeenCalledWith(APP_UPDATED_MESSAGE);
  });

  it('never fails itself when the message cannot be shown', () => {
    notifications.error.mockImplementation(() => {
      throw new Error('no overlay');
    });
    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
    expect(consoleError).toHaveBeenLastCalledWith(
      '[App] Could not show the error message:',
      expect.any(Error),
    );
  });
});
