/** "1 week", "2 weeks": count plus the noun in the form that agrees with it. */
export function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
