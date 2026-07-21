import { describe, it, expect } from 'vitest';

// Função para normalizar strings para comparação
function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

// Função para encontrar o melhor match de participante
function findBestParticipantMatch(mentionedName: string, participants: string[]): string | undefined {
  if (!mentionedName || participants.length === 0) return undefined;
  
  const normalized = normalizeForComparison(mentionedName);
  
  // Exact match (case-insensitive)
  for (const participant of participants) {
    if (normalizeForComparison(participant) === normalized) {
      return participant;
    }
  }
  
  // First name match (e.g., "Victor" matches "victor.soares")
  const firstWord = normalized.split(/[\s._-]/)[0];
  if (firstWord.length > 2) {
    for (const participant of participants) {
      const participantNormalized = normalizeForComparison(participant);
      if (participantNormalized.startsWith(firstWord) || participantNormalized.includes(firstWord)) {
        return participant;
      }
    }
  }
  
  // Partial match (substring)
  for (const participant of participants) {
    const participantNormalized = normalizeForComparison(participant);
    if (participantNormalized.includes(normalized) || normalized.includes(participantNormalized)) {
      return participant;
    }
  }
  
  return undefined;
}

describe('Participant Name Mapping', () => {
  const participants = [
    'larissa',
    'Luan Pereira',
    'Luciano Magalhaes',
    'Robert Junior',
    'sergio.amorim',
    'victor.soares',
  ];

  it('should match exact names (case-insensitive)', () => {
    expect(findBestParticipantMatch('larissa', participants)).toBe('larissa');
    expect(findBestParticipantMatch('LARISSA', participants)).toBe('larissa');
    expect(findBestParticipantMatch('Larissa', participants)).toBe('larissa');
  });

  it('should match first names to full names', () => {
    expect(findBestParticipantMatch('Victor', participants)).toBe('victor.soares');
    expect(findBestParticipantMatch('victor', participants)).toBe('victor.soares');
    expect(findBestParticipantMatch('Sergio', participants)).toBe('sergio.amorim');
    expect(findBestParticipantMatch('Luan', participants)).toBe('Luan Pereira');
  });

  it('should match names with accents', () => {
    expect(findBestParticipantMatch('Luciano Magalhães', participants)).toBe('Luciano Magalhaes');
    expect(findBestParticipantMatch('Sérgio', participants)).toBe('sergio.amorim');
  });

  it('should match partial names', () => {
    expect(findBestParticipantMatch('Robert', participants)).toBe('Robert Junior');
    expect(findBestParticipantMatch('Junior', participants)).toBe('Robert Junior');
    expect(findBestParticipantMatch('Pereira', participants)).toBe('Luan Pereira');
  });

  it('should return undefined for non-matching names', () => {
    expect(findBestParticipantMatch('John', participants)).toBeUndefined();
    expect(findBestParticipantMatch('xyz', participants)).toBeUndefined();
  });

  it('should handle empty inputs', () => {
    expect(findBestParticipantMatch('', participants)).toBeUndefined();
    expect(findBestParticipantMatch('Victor', [])).toBeUndefined();
  });

  it('should prioritize exact matches over partial matches', () => {
    const testParticipants = ['robert', 'robert junior'];
    expect(findBestParticipantMatch('robert', testParticipants)).toBe('robert');
  });

  it('should handle names with dots and dashes', () => {
    expect(findBestParticipantMatch('sergio amorim', participants)).toBe('sergio.amorim');
    expect(findBestParticipantMatch('sergio_amorim', participants)).toBe('sergio.amorim');
  });
});
