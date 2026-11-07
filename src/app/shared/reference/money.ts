/** Money and distances to the cent, as the database keeps them (v21 showed raw floats). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `1234.5` → `1,234.50` (v21 grid format). */
export function money(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
