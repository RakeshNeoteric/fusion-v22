/**
 * Whole years from birth to death (`yyyy-MM-dd`), one less when the birthday had not come round
 * yet that year (v21); null when a date is missing or death is before birth.
 */
export function ageAtDeath(birth: string, death: string): number | null {
  const born = parts(birth);
  const died = parts(death);
  if (!born || !died || death < birth) return null;
  const [bornYear, bornMonth, bornDay] = born;
  const [diedYear, diedMonth, diedDay] = died;
  const beforeBirthday = diedMonth < bornMonth || (diedMonth === bornMonth && diedDay < bornDay);
  return diedYear - bornYear - (beforeBirthday ? 1 : 0);
}

function parts(date: string): readonly [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
