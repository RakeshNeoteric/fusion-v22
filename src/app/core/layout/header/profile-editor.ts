import { InjectionToken } from '@angular/core';

/** Opens the signed-in user's own profile (v21: the header's user popup). */
export interface ProfileEditor {
  open(): Promise<void>;
}

/**
 * Provided by the app (`app.config.ts`): the profile form is a feature, which the header in
 * `core` may not import, and it is loaded only when first opened. Without it the header
 * offers no "My Profile".
 */
export const PROFILE_EDITOR = new InjectionToken<ProfileEditor>('PROFILE_EDITOR');
