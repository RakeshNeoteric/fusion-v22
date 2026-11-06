import { HttpContext, HttpContextToken } from '@angular/common/http';

/** When true, errorInterceptor still converts the error to ApiError but shows no notification. */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);

/** Use for calls whose errors the caller presents itself, e.g. `http.get(url, { context: silentErrors() })`. */
export function silentErrors(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
}
