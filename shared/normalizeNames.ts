/**
 * Normalize names by removing accents, converting to lowercase
 * This ensures "João", "joao", "JOÃO" are treated as the same person
 */

export function normalizeName(name: string): string {
  if (!name) return "";
  
  // Remove accents and diacritics
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .trim();
  
  return normalized;
}

/**
 * Find a person by normalized name in a list using multiple strategies:
 * 1. Exact match (case-insensitive, accent-insensitive)
 * 2. First name match (e.g., "Victor" matches "Victor Soares")
 * 3. Partial match (e.g., "Vic" matches "Victor Soares")
 */
export function findByNormalizedName<T extends { name?: string; displayName?: string; assignedToName?: string }>(
  list: T[],
  searchName: string
): T | undefined {
  const normalized = normalizeName(searchName);
  
  if (!normalized) return undefined;

  // Strategy 1: Exact match
  let match = list.find((item) => {
    const itemName = item.name || item.displayName || item.assignedToName || "";
    return normalizeName(itemName) === normalized;
  });
  
  if (match) return match;

  // Strategy 2: First name match (e.g., "Victor" matches "Victor Soares")
  const searchWords = normalized.split(/[\s._-]+/).filter(w => w.length > 0);
  const firstSearchWord = searchWords[0];
  
  if (firstSearchWord && firstSearchWord.length >= 2) {
    match = list.find((item) => {
      const itemName = item.name || item.displayName || item.assignedToName || "";
      const itemNormalized = normalizeName(itemName);
      const itemWords = itemNormalized.split(/[\s._-]+/).filter(w => w.length > 0);
      
      // Check if any word in the item name matches the first search word
      return itemWords.some(word => word === firstSearchWord || word.startsWith(firstSearchWord));
    });
    
    if (match) return match;
  }

  // Strategy 3: Partial match (substring)
  if (normalized.length >= 3) {
    match = list.find((item) => {
      const itemName = item.name || item.displayName || item.assignedToName || "";
      const itemNormalized = normalizeName(itemName);
      return itemNormalized.includes(normalized) || normalized.includes(itemNormalized);
    });
    
    if (match) return match;
  }

  return undefined;
}

/**
 * Get the original name from a list by normalized name
 */
export function getOriginalName<T extends { name?: string; displayName?: string; assignedToName?: string }>(
  list: T[],
  searchName: string
): string | undefined {
  const item = findByNormalizedName(list, searchName);
  if (!item) return undefined;
  
  return item.name || item.displayName || item.assignedToName;
}
