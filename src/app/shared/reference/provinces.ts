import { type SelectOption, textOptions } from '@shared/forms/select-field/select-option';

/** South African provinces offered for a branch; stored as the name. Same list as v21. */
export const PROVINCES: readonly string[] = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

/** {@link PROVINCES} as dropdown choices. */
export const PROVINCE_OPTIONS: readonly SelectOption<string>[] = textOptions(PROVINCES);
