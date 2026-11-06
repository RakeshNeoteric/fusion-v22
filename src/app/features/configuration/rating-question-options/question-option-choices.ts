/**
 * v21 rule: a question type's answers are written in its name, e.g. "Yes/No",
 * "Pass | Fail" or "Excellent, Good; Fair". Splits on / | , ; and drops repeats (any case).
 */
export function optionsFromTypeName(typeName: string | null | undefined): string[] {
  const seen = new Set<string>();
  return (typeName ?? '')
    .split(/[/|,;]+/)
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
