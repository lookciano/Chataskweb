import { invokeLLM } from "./_core/llm";

/**
 * Normalize a string for comparison by removing accents, converting to lowercase, and trimming
 */
export function normalizeForComparison(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Check if two names are equivalent (ignoring case and accents)
 */
export function areNamesEquivalent(name1: string, name2: string): boolean {
  return normalizeForComparison(name1) === normalizeForComparison(name2);
}

/**
 * Find exact match in participants list (case and accent insensitive)
 */
function findExactMatch(mentionedName: string, participants: string[]): string | undefined {
  const normalized = normalizeForComparison(mentionedName);
  return participants.find(p => normalizeForComparison(p) === normalized);
}

/**
 * Find first name match (e.g., "Fabian" matches "Fabian Robert")
 */
function findFirstNameMatch(mentionedName: string, participants: string[]): string | undefined {
  const normalized = normalizeForComparison(mentionedName);
  const firstWord = normalized.split(/[\s._-]/)[0];
  
  if (firstWord.length < 2) return undefined;
  
  // Look for participants that start with the first word
  for (const participant of participants) {
    const participantNormalized = normalizeForComparison(participant);
    const participantFirstWord = participantNormalized.split(/[\s._-]/)[0];
    
    if (participantFirstWord === firstWord) {
      return participant;
    }
  }
  
  return undefined;
}

/**
 * Find partial match (substring match)
 */
function findPartialMatch(mentionedName: string, participants: string[]): string | undefined {
  const normalized = normalizeForComparison(mentionedName);
  
  for (const participant of participants) {
    const participantNormalized = normalizeForComparison(participant);
    if (participantNormalized.includes(normalized) || normalized.includes(participantNormalized)) {
      return participant;
    }
  }
  
  return undefined;
}

/**
 * Use LLM to intelligently match a mentioned name to a participant
 * This handles cases like:
 * - "Fab" -> "Fabian Robert"
 * - "Sergio" -> "Sérgio Amorim"
 * - "Larissa" -> "Larissa Cortez"
 */
async function findLLMMatch(mentionedName: string, participants: string[]): Promise<string | undefined> {
  if (!mentionedName || participants.length === 0) return undefined;
  
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a name matching expert. Given a mentioned name and a list of participant names, find the best match.

Return ONLY the exact participant name from the list that matches the mentioned name, or return "NO_MATCH" if there's no good match.

Consider:
- First name matches (e.g., "Fab" matches "Fabian Robert")
- Partial name matches (e.g., "Sergio" matches "Sérgio Amorim")
- Nickname matches (e.g., "Fab" for "Fabian")
- Case and accent variations (e.g., "sergio" matches "Sérgio")

Return ONLY the participant name or "NO_MATCH", nothing else.`,
        },
        {
          role: "user",
          content: `Mentioned name: "${mentionedName}"
          
Participant list:
${participants.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Which participant does the mentioned name refer to? Return ONLY the exact participant name or "NO_MATCH".`,
        },
      ],
    });

    const content = response.choices[0]?.message.content;
    if (typeof content !== 'string') return undefined;
    
    const result = content.trim();
    
    // Check if the result is one of the participants
    if (result === "NO_MATCH") return undefined;
    
    // Return the result only if it's in the participants list
    const match = participants.find(p => normalizeForComparison(p) === normalizeForComparison(result));
    return match;
  } catch (error) {
    console.error("Error in LLM name matching:", error);
    return undefined;
  }
}

/**
 * Find the best match for a mentioned name in the participants list
 * Uses a multi-strategy approach:
 * 1. Exact match (case/accent insensitive)
 * 2. First name match
 * 3. Partial match
 * 4. LLM-based intelligent matching
 */
export async function findBestParticipantMatch(
  mentionedName: string,
  participants: string[]
): Promise<string | undefined> {
  if (!mentionedName || participants.length === 0) {
    console.log("[NAME_MATCHER] No mentioned name or participants", { mentionedName, participantsCount: participants.length });
    return undefined;
  }
  
  console.log("[NAME_MATCHER] Starting match for:", { mentionedName, participants });
  
  // Strategy 1: Exact match
  const exactMatch = findExactMatch(mentionedName, participants);
  if (exactMatch) {
    console.log("[NAME_MATCHER] Found exact match:", { mentionedName, exactMatch });
    return exactMatch;
  }
  
  // Strategy 2: First name match
  const firstNameMatch = findFirstNameMatch(mentionedName, participants);
  if (firstNameMatch) {
    console.log("[NAME_MATCHER] Found first name match:", { mentionedName, firstNameMatch });
    return firstNameMatch;
  }
  
  // Strategy 3: Partial match
  const partialMatch = findPartialMatch(mentionedName, participants);
  if (partialMatch) {
    console.log("[NAME_MATCHER] Found partial match:", { mentionedName, partialMatch });
    return partialMatch;
  }
  
  // Strategy 4: LLM-based matching (most intelligent but slower)
  console.log("[NAME_MATCHER] Trying LLM match for:", mentionedName);
  const llmMatch = await findLLMMatch(mentionedName, participants);
  if (llmMatch) {
    console.log("[NAME_MATCHER] Found LLM match:", { mentionedName, llmMatch });
    return llmMatch;
  }
  
  console.log("[NAME_MATCHER] No match found for:", { mentionedName, participants });
  return undefined;
}

/**
 * Validate and normalize a task's assigned person
 * Ensures the name exactly matches a participant in the room
 * If no match is found, returns undefined
 */
export async function validateAndNormalizeAssignedPerson(
  assignedName: string | undefined,
  roomParticipants: string[]
): Promise<string | undefined> {
  if (!assignedName || roomParticipants.length === 0) return undefined;
  
  // Try to find a match
  const match = await findBestParticipantMatch(assignedName, roomParticipants);
  
  if (match) {
    return match; // Return the exact name from the participants list
  }
  
  // No match found
  console.warn(`No participant found matching "${assignedName}". Available: ${roomParticipants.join(', ')}`);
  return undefined;
}

/**
 * Get all unique participant names from a list
 */
export function getUniqueParticipantNames(participants: any[]): string[] {
  const names = participants
    .map(p => p.displayName || p.name)
    .filter(Boolean);
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.sort();
}
