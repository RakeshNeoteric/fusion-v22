import { HttpErrorResponse } from '@angular/common/http';

/**
 * The single error type HTTP callers receive (thrown by errorInterceptor).
 * `message` is safe to show to users; `serverMessage` keeps the raw backend text for diagnostics.
 */
export class ApiError extends Error {
  constructor(
    /** HTTP status; 0 = network failure, -1 = not an HTTP error (e.g. token acquisition failed). */
    readonly status: number,
    message: string,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const NETWORK_MESSAGE = 'Cannot reach the Fusion Edge server. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on the server. Please try again.';
const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.';
const UNAUTHORIZED_MESSAGE = 'Your session has expired. Please sign in again.';
const FALLBACK_MESSAGE = 'The request could not be completed.';
const UNEXPECTED_MESSAGE = 'An unexpected error occurred.';
const DUPLICATE_MESSAGE = 'This record already exists.';
const IN_USE_MESSAGE = 'This record is used elsewhere, so it cannot be changed or removed.';
const NOT_SAVED_MESSAGE = 'The data could not be saved. Please check it and try again.';

/** How the backend's exception middleware marks a database failure (422). */
const DATABASE_EXCEPTION = 'Database exception occurred';

/** Converts anything thrown during an HTTP call into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return new ApiError(-1, UNEXPECTED_MESSAGE, error instanceof Error ? error.message : null);
  }

  const serverMessage = extractServerMessage(error.error);
  const { status } = error;

  if (status === 0) return new ApiError(0, NETWORK_MESSAGE, serverMessage);
  // 5xx bodies carry raw exception text (stack-derived codes, SQL messages): never show them to users.
  if (status >= 500) return new ApiError(status, SERVER_MESSAGE, serverMessage);
  if (status === 403)
    return new ApiError(status, serverMessage ?? FORBIDDEN_MESSAGE, serverMessage);
  if (status === 401)
    return new ApiError(status, serverMessage ?? UNAUTHORIZED_MESSAGE, serverMessage);
  // Database failures carry the raw SQL Server text: say what it means instead.
  if (isRecord(error.error) && error.error['ExceptionType'] === DATABASE_EXCEPTION)
    return new ApiError(status, databaseMessage(serverMessage ?? ''), serverMessage);
  return new ApiError(status, serverMessage ?? FALLBACK_MESSAGE, serverMessage);
}

function databaseMessage(raw: string): string {
  if (/duplicate key|unique index|UNIQUE KEY/i.test(raw)) return DUPLICATE_MESSAGE;
  if (/REFERENCE constraint|FOREIGN KEY/i.test(raw)) return IN_USE_MESSAGE;
  return NOT_SAVED_MESSAGE;
}

/**
 * The backend returns errors in several shapes:
 * - plain text (`NotFound("User Not Found")`, `BadRequest("...")`)
 * - `ResultOrExceptionModel` from its exception middleware: `{ Status, ErrorCode, Message, ... }`
 * - ASP.NET `ProblemDetails` from model validation: `{ title, detail, errors: { Field: [msg] } }`
 */
export function extractServerMessage(body: unknown): string | null {
  if (typeof body === 'string') {
    const text = body.trim();
    // Ignore HTML error pages (IIS / proxy).
    return text && !text.startsWith('<') ? text : null;
  }
  if (!isRecord(body)) {
    return null;
  }
  const message = firstString(body['Message'], body['message']);
  if (message) {
    return message;
  }
  const firstValidationError = firstValidationMessage(body['errors']);
  if (firstValidationError) {
    return firstValidationError;
  }
  return firstString(body['detail'], body['title']);
}

function firstValidationMessage(errors: unknown): string | null {
  if (!isRecord(errors)) return null;
  for (const value of Object.values(errors)) {
    if (Array.isArray(value)) {
      const message = firstString(...value);
      if (message) return message;
    }
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
