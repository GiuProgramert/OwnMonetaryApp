export function normalizeTypeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function filterMovementTypes<T extends { name: string }>(
  types: T[],
  query: string
): T[] {
  const normalizedQuery = normalizeTypeName(query);

  if (normalizedQuery === "") {
    return types;
  }

  return types.filter((type) =>
    normalizeTypeName(type.name).includes(normalizedQuery)
  );
}

export function hasExactMatch(
  types: { name: string }[],
  query: string
): boolean {
  const normalizedQuery = normalizeTypeName(query);

  return types.some((type) => normalizeTypeName(type.name) === normalizedQuery);
}
