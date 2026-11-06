import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, extractServerMessage, toApiError } from './api-error';

function httpError(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: 'https://api.test/Client' });
}

describe('extractServerMessage', () => {
  it.each<[string, unknown, string]>([
    ['a plain-text body', '  User Not Found  ', 'User Not Found'],
    [
      'ResultOrExceptionModel',
      { Status: 400, ErrorCode: 'DUP', Message: 'Client already exists' },
      'Client already exists',
    ],
    ['a camelCase message', { message: 'Bad input' }, 'Bad input'],
    [
      'ProblemDetails validation errors',
      { title: 'One or more validation errors occurred.', errors: { Name: ['Name is required'] } },
      'Name is required',
    ],
    [
      'ProblemDetails detail',
      { title: 'Bad Request', detail: 'Id must be positive' },
      'Id must be positive',
    ],
    ['ProblemDetails title', { title: 'Bad Request' }, 'Bad Request'],
  ])('reads %s', (_shape, body, expected) => {
    expect(extractServerMessage(body)).toBe(expected);
  });

  it.each<[string, unknown]>([
    ['null', null],
    ['an empty string', '   '],
    ['an HTML error page', '<!DOCTYPE html><html>502</html>'],
    ['a number', 42],
    ['an array', ['x']],
    ['an object without a message', { Status: 500 }],
  ])('returns null for %s', (_shape, body) => {
    expect(extractServerMessage(body)).toBeNull();
  });
});

describe('toApiError', () => {
  it('returns an ApiError unchanged', () => {
    const error = new ApiError(404, 'Gone');
    expect(toApiError(error)).toBe(error);
  });

  it('reports network failures (status 0) with a connection message', () => {
    const error = toApiError(httpError(0));
    expect(error.status).toBe(0);
    expect(error.message).toContain('Cannot reach');
  });

  it('never shows 5xx server text to the user, but keeps it for diagnostics', () => {
    const error = toApiError(httpError(500, { Message: 'SqlException: timeout' }));
    expect(error.message).toBe('Something went wrong on the server. Please try again.');
    expect(error.serverMessage).toBe('SqlException: timeout');
  });

  it('shows the server message for 4xx responses', () => {
    expect(toApiError(httpError(404, 'User Not Found')).message).toBe('User Not Found');
    expect(toApiError(httpError(400, { Message: 'user is de-activated' })).message).toBe(
      'user is de-activated',
    );
  });

  it.each<[number, string]>([
    [401, 'Your session has expired. Please sign in again.'],
    [403, 'You do not have permission to perform this action.'],
    [409, 'The request could not be completed.'],
  ])('falls back to a default message for %i without a body', (status, message) => {
    expect(toApiError(httpError(status)).message).toBe(message);
  });

  it('wraps non-HTTP errors (e.g. token acquisition) with status -1', () => {
    const error = toApiError(new Error('no_account_error'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(-1);
    expect(error.serverMessage).toBe('no_account_error');
  });
});
