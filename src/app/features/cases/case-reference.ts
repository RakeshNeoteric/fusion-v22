import type { Choice } from '@shared/forms/choice-toggle';

/** v21 relationship choices (to the caller, or to the policy holder), label → stored value. */
export const RELATIONSHIPS: readonly Choice<string>[] = [
  { label: 'Aunt', value: 'AUNT' },
  { label: 'Brother', value: 'BROTHER' },
  { label: 'Brother In-Law', value: 'BROTHER IN-LAW' },
  { label: 'Child', value: 'CHILD' },
  { label: 'Cousin', value: 'COUSIN' },
  { label: 'Daughter', value: 'DAUGHTER' },
  { label: 'Domestic', value: 'DOMESTIC' },
  { label: 'Father', value: 'FATHER' },
  { label: 'Father In-Law', value: 'FATHER IN-LAW' },
  { label: 'Grand-Parent', value: 'GRAND-PARENT' },
  { label: 'GrandChild', value: 'GRANDCHILD' },
  { label: 'Life Assured', value: 'LIFE ASSURED' },
  { label: 'Mother', value: 'MOTHER' },
  { label: 'Mother In-Law', value: 'MOTHER IN-LAW' },
  { label: 'Nephew', value: 'NEPHEW' },
  { label: 'Niece', value: 'NIECE' },
  { label: 'Other', value: 'OTHER' },
  { label: 'Relation', value: 'RELATION' },
  { label: 'Self', value: 'SELF' },
];

/** v21 preferred languages, in its order. */
export const LANGUAGES: readonly string[] = [
  'Zulu',
  'Xhosa',
  'Afrikaans',
  'English',
  'Northern Sotho',
  'Tswana',
  'Southern Sotho',
  'Tsonga',
  'Swati',
  'Venda',
  'Ndebele',
];

/** A case caller may be saved with at most this many (v21). */
export const MAX_CALLERS = 2;
