/** One choice in a dropdown or a grid's list column: what is stored, and what the user reads. */
export interface SelectOption<T = string | number | null> {
  readonly value: T;
  readonly label: string;
  /**
   * False for choices that may still appear on old records but can no longer be picked,
   * e.g. an inactive or deleted branch (v21). Default true.
   */
  readonly selectable?: boolean;
}

/** Plain texts as choices, each shown as itself (provinces, note types, …). */
export function textOptions<T extends string>(texts: readonly T[]): SelectOption<T>[] {
  return texts.map((text) => ({ value: text, label: text }));
}

/** Records as choices: `optionsOf(users, (user) => user.id, (user) => user.label)`. */
export function optionsOf<R, T>(
  records: readonly R[],
  value: (record: R) => T,
  label: (record: R) => string,
): SelectOption<T>[] {
  return records.map((record) => ({ value: value(record), label: label(record) }));
}
