/**
 * A case tab with a form. The page asks it to save before another tab opens and before the
 * case is left (v21 saved on tab change). Provide it as `{ provide: CaseTabForm, useExisting }`.
 */
export abstract class CaseTabForm {
  /** Anything to save? */
  abstract hasChanges(): boolean;
  /** Saves; false when the form has errors (now shown) or the save failed. */
  abstract save(): Promise<boolean>;
}
