import { normalizeForComparison, findBestParticipantMatch } from "./participant-name-matcher";

/**
 * Local (no-LLM) extraction of who a chat message assigns a task to.
 * Prefer these patterns over trusting the model to invent the sender:
 *   "Victor, elaborar..."
 *   "@Larissa favor revisar"
 *   "Sérgio precisa enviar..."
 *   "Sergio deve atualizar..."
 *   "para Fabian: ..."
 *   "Atribuir a Victor a revisão do memorial"
 *   "Fica com Larissa atualizar o cronograma"
 */

const LEADING_TASK_VERBS =
  /^(?:precisa|precisas|precisamos|deve|devem|tem\s+que|têm\s+que|favor|por\s+favor|pf|pfv|elabore|elaborar|envie|enviar|faca|faça|fazer|atualize|atualizar|revise|revisar|prepare|preparar|verifique|verificar|crie|criar|mande|mandar|cuide|cuidar|resolva|resolver|acompanhe|acompanhar|agenda|agendar|conclua|concluir|finalize|finalizar|tratar|cuidado|cuida)\b/i;

/** Words that should never be treated as a person name lead-in */
const STOP_LEAD_WORDS = new Set(
  [
    "a",
    "o",
    "os",
    "as",
    "um",
    "uma",
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "por",
    "para",
    "com",
    "sem",
    "se",
    "que",
    "e",
    "ou",
    "mas",
    "ja",
    "já",
    "ok",
    "ola",
    "olá",
    "bom",
    "boa",
    "oi",
    "hoje",
    "amanha",
    "amanhã",
    "urgente",
    "precisamos",
    "preciso",
    "tarefa",
    "atividades",
    "alguem",
    "alguém",
    "time",
    "equipe",
    "pessoal",
    "galera",
    "voce",
    "você",
    "vc",
    "vcs",
    "nos",
    "nós",
    "atribuir",
    "atribuido",
    "atribuído",
    "responsavel",
    "responsável",
  ].map((w) => normalizeForComparison(w))
);

// Latin letters incl. common PT accents (avoid \\p{L} for older TS targets)
const NAME_TOKEN = "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'’\\-]*";
const NAME_1_TO_3 = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){0,2}`;

export type LocalAssigneeHit = {
  mentioned: string;
  matchedParticipant?: string;
  source:
    | "at_mention"
    | "name_comma"
    | "name_colon"
    | "name_verb"
    | "para_name"
    | "assign_phrase"
    | "inline_name";
};

function candidateLooksLikeName(raw: string): boolean {
  const s = (raw || "").trim();
  if (s.length < 2 || s.length > 40) return false;
  if (/\d/.test(s)) return false;
  if (STOP_LEAD_WORDS.has(normalizeForComparison(s))) return false;
  const first = s[0];
  if (!/[A-Za-zÀ-ÿ]/.test(first)) return false;
  return true;
}

function extractMentionCandidates(
  message: string
): Array<{ mentioned: string; source: LocalAssigneeHit["source"] }> {
  const text = (message || "").trim();
  if (!text) return [];
  const out: Array<{ mentioned: string; source: LocalAssigneeHit["source"] }> = [];

  // 1) @Name or @First Last (start or mid-message)
  const atStartRe = new RegExp(`^@(${NAME_1_TO_3})\\b`, "i");
  const atStart = text.match(atStartRe);
  if (atStart?.[1] && candidateLooksLikeName(atStart[1])) {
    out.push({ mentioned: atStart[1].trim(), source: "at_mention" });
  }
  const atAnyRe = new RegExp(`(?:^|[\\s(,;.!?])@(${NAME_1_TO_3})\\b`, "i");
  const atAny = text.match(atAnyRe);
  if (atAny?.[1] && candidateLooksLikeName(atAny[1])) {
    out.push({ mentioned: atAny[1].trim(), source: "at_mention" });
  }

  // 2) Name, rest   /  Name: rest
  const leadNameRe = new RegExp(`^(${NAME_1_TO_3})\\s*([,:])\\s+\\S`, "i");
  const lead = text.match(leadNameRe);
  if (lead?.[1] && candidateLooksLikeName(lead[1])) {
    out.push({
      mentioned: lead[1].trim(),
      source: lead[2] === ":" ? "name_colon" : "name_comma",
    });
  }

  // 3) Name precisa|deve|tem que|...
  const verbRe = new RegExp(
    `^(${NAME_1_TO_3})\\s+(precisa|precisas|deve|devem|tem\\s+que|têm\\s+que|favor|por\\s+favor)\\b`,
    "i"
  );
  const verb = text.match(verbRe);
  if (verb?.[1] && candidateLooksLikeName(verb[1])) {
    out.push({ mentioned: verb[1].trim(), source: "name_verb" });
  }

  // 4) Explicit assignment phrases (PT) — high priority for natural speech
  // "atribuir a Victor", "atribuído ao Sérgio", "responsável: Larissa"
  // "fica com Fabian", "passar para Luan", "pedido para Victor"
  // "Victor fica responsável", "deixar com Victor"
  const assignPhrases: Array<{ re: RegExp; group: number }> = [
    {
      re: new RegExp(
        `\\b(?:atribuir|atribua|atribui|atribuindo|atribuido|atribuído|atribuida|atribuída)\\s+(?:a|ao|à|para|pro|pra)\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\b(?:responsavel|responsável)\\s*(?::|é|eh|e)?\\s*(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\b(?:fica|ficar|fique|deixar|deixa|deixe)\\s+com\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\b(?:passar|passe|passar\\s+a|encaminhar|encaminhe|pedir|peço|peco|pedido)\\s+(?:a|ao|à|para|pro|pra)\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\b(?:tarefa|atividade)\\s+(?:para|pro|pra)\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\b(?:delegar|delegue)\\s+(?:a|ao|à|para|pro|pra)\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `^(${NAME_1_TO_3})\\s+(?:fica|ficará|ficara|eh|é)\\s+(?:o\\s+|a\\s+)?(?:responsavel|responsável)\\b`,
        "i"
      ),
      group: 1,
    },
    {
      re: new RegExp(
        `\\bcom\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\s+(?:fica|ficando|cuidando|tratando)\\b`,
        "i"
      ),
      group: 1,
    },
  ];
  for (const { re, group } of assignPhrases) {
    const m = text.match(re);
    const name = m?.[group];
    if (name && candidateLooksLikeName(name)) {
      out.push({ mentioned: name.trim(), source: "assign_phrase" });
    }
  }

  // 5) para Name ...  /  para o Name (assignment-ish when not a stop word)
  const paraRe = new RegExp(`\\bpara\\s+(?:o\\s+|a\\s+)?(${NAME_1_TO_3})\\b`, "i");
  const para = text.match(paraRe);
  if (para?.[1] && candidateLooksLikeName(para[1]) && !LEADING_TASK_VERBS.test(para[1])) {
    out.push({ mentioned: para[1].trim(), source: "para_name" });
  }

  // 6) First token + verb pattern after it
  const firstRe = new RegExp(`^(${NAME_TOKEN})\\b`, "i");
  const firstToken = text.match(firstRe);
  if (firstToken?.[1] && candidateLooksLikeName(firstToken[1])) {
    const rest = text.slice(firstToken[0].length).trim();
    if (LEADING_TASK_VERBS.test(rest)) {
      out.push({ mentioned: firstToken[1].trim(), source: "name_verb" });
    }
  }

  // Deduplicate by normalized mention, keep first (higher priority order above)
  const seen = new Set<string>();
  const unique: typeof out = [];
  for (const c of out) {
    const k = normalizeForComparison(c.mentioned);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }
  return unique;
}

/** Local strategies only — no LLM (prefix assignee gate). */
export function findBestParticipantMatchLocalOnly(
  mentionedName: string,
  participants: string[]
): string | undefined {
  if (!mentionedName || !participants.length) return undefined;
  const normalized = normalizeForComparison(mentionedName);

  const exact = participants.find((p) => normalizeForComparison(p) === normalized);
  if (exact) return exact;

  const firstWord = normalized.split(/[\s._-]+/)[0];
  if (firstWord && firstWord.length >= 2) {
    for (const p of participants) {
      const pn = normalizeForComparison(p);
      const pf = pn.split(/[\s._-]+/)[0];
      if (pf === firstWord || pf.startsWith(firstWord) || firstWord.startsWith(pf)) {
        if (firstWord.length >= 3 || pf === firstWord) return p;
      }
    }
  }

  if (normalized.length >= 3) {
    for (const p of participants) {
      const pn = normalizeForComparison(p);
      if (pn.includes(normalized) || normalized.includes(pn)) return p;
    }
  }

  return undefined;
}

/**
 * Pure local scan: best participant match from message text without LLM.
 */
export async function detectAssigneeFromMessageLocal(
  message: string,
  roomParticipants: string[]
): Promise<LocalAssigneeHit | null> {
  const candidates = extractMentionCandidates(message);
  if (!candidates.length) return null;

  for (const c of candidates) {
    if (!roomParticipants.length) {
      return { mentioned: c.mentioned, source: c.source };
    }
    const match = findBestParticipantMatchLocalOnly(c.mentioned, roomParticipants);
    if (match) {
      return { mentioned: c.mentioned, matchedParticipant: match, source: c.source };
    }
  }

  return { mentioned: candidates[0].mentioned, source: candidates[0].source };
}

/**
 * Build the task description = requested work only (no assignee name boilerplate).
 * Keeps the action text; strips "Victor,", "@Larissa", "atribuir a Sérgio", etc.
 */
export function cleanTaskDescription(
  rawDescription: string,
  assigneeName?: string | null,
  roomParticipants: string[] = []
): string {
  let text = (rawDescription || "").trim();
  if (!text) return text;

  const namesToStrip = new Set<string>();
  if (assigneeName) {
    namesToStrip.add(assigneeName);
    // first name only also
    const first = assigneeName.split(/[\s._-]+/)[0];
    if (first) namesToStrip.add(first);
  }
  for (const p of roomParticipants) {
    if (!p) continue;
    namesToStrip.add(p);
    const first = p.split(/[\s._-]+/)[0];
    if (first && first.length >= 3) namesToStrip.add(first);
  }

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameAlts = Array.from(namesToStrip)
    .filter((n) => n && n.length >= 2)
    .map((n) => escapeRe(n))
    .sort((a, b) => b.length - a.length);

  if (nameAlts.length) {
    const nameGroup = `(?:${nameAlts.join("|")})`;

    // Leading address forms: "@Victor ", "Victor, ", "Victor: ", "Victor "
    text = text.replace(new RegExp(`^@?${nameGroup}\\s*[,:]\\s*`, "i"), "");
    text = text.replace(new RegExp(`^@${nameGroup}\\s+`, "i"), "");

    // "Victor precisa/deve/tem que/favor ..."
    text = text.replace(
      new RegExp(
        `^${nameGroup}\\s+(?:precisa(?:s|mos)?|deve(?:m)?|tem\\s+que|têm\\s+que|favor|por\\s+favor)\\s+`,
        "i"
      ),
      ""
    );

    // "Victor fica responsável por ..."
    text = text.replace(
      new RegExp(
        `^${nameGroup}\\s+(?:fica|ficará|ficara|é|eh)\\s+(?:o\\s+|a\\s+)?(?:responsavel|responsável)(?:\\s+por)?\\s*`,
        "i"
      ),
      ""
    );
  }

  // Strip generic assignment phrasing that points to a person (keep the task part)
  // "Atribuir a Victor a revisão..." → "a revisão..."
  text = text.replace(
    new RegExp(
      `^(?:por\\s+favor[,,]?\\s*)?(?:atribuir|atribua|atribui|atribuindo|atribuido|atribuído|atribuida|atribuída)\\s+(?:a|ao|à|para|pro|pra)\\s+(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`,
      "i"
    ),
    ""
  );
  text = text.replace(
    new RegExp(
      `^(?:responsavel|responsável)\\s*(?::|é|eh|e)?\\s*(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`,
      "i"
    ),
    ""
  );
  text = text.replace(
    new RegExp(
      `^(?:fica|ficar|fique|deixar|deixa|deixe)\\s+com\\s+(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`,
      "i"
    ),
    ""
  );
  text = text.replace(
    new RegExp(
      `^(?:passar|passe|encaminhar|encaminhe|pedir|peço|peco|pedido|delegar|delegue)\\s+(?:a|ao|à|para|pro|pra)\\s+(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`,
      "i"
    ),
    ""
  );
  text = text.replace(
    new RegExp(
      `^(?:tarefa|atividade)\\s+(?:para|pro|pra)\\s+(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`,
      "i"
    ),
    ""
  );

  // "para Victor, ..." or leading "para Victor "
  if (nameAlts.length) {
    const nameGroup = `(?:${nameAlts.join("|")})`;
    text = text.replace(new RegExp(`^para\\s+(?:o\\s+|a\\s+)?${nameGroup}\\s*[,:]?\\s*`, "i"), "");
    // trailing ", para Victor" / " - Victor"
    text = text.replace(new RegExp(`\\s*[,\\-]\\s*(?:para\\s+)?${nameGroup}\\s*$`, "i"), "");
    text = text.replace(new RegExp(`\\s+\\(${nameGroup}\\)\\s*$`, "i"), "");
  } else {
    text = text.replace(new RegExp(`^para\\s+(?:o\\s+|a\\s+)?${NAME_1_TO_3}\\s*[,:]?\\s*`, "i"), "");
  }

  // Collapse leftover connective "por favor" only when hanging alone after strip
  text = text.replace(/^(?:por\s+favor|favor|pf|pfv)\s*[,:]?\s*/i, "");
  text = text.replace(/\s+/g, " ").trim();

  // Capitalize first letter for polish
  if (text.length) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Safety: never return empty after strip — fall back to original corrected text
  if (!text || text.length < 2) {
    return (rawDescription || "").trim();
  }
  return text;
}

/**
 * Resolve assignee for a task: local message patterns win over LLM/sender.
 */
export async function resolveTaskAssignee(params: {
  messageContent: string;
  llmAssignedTo?: string | null;
  senderName: string;
  roomParticipants: string[];
}): Promise<{ assignedTo: string; source: string }> {
  const { messageContent, llmAssignedTo, senderName, roomParticipants } = params;

  const local = await detectAssigneeFromMessageLocal(messageContent, roomParticipants);
  if (local?.matchedParticipant) {
    return { assignedTo: local.matchedParticipant, source: `local:${local.source}` };
  }

  if (llmAssignedTo && llmAssignedTo.trim()) {
    const llmNormAdjusted = llmAssignedTo.trim();
    const bad = [
      "null",
      "undefined",
      "ninguem",
      "ninguém",
      "nao identificado",
      "não identificado",
      "n/a",
      "-",
      "nobody",
      "none",
    ];
    if (!bad.includes(normalizeForComparison(llmNormAdjusted))) {
      const localMap = findBestParticipantMatchLocalOnly(llmNormAdjusted, roomParticipants);
      if (localMap) {
        return { assignedTo: localMap, source: "llm_local_mapped" };
      }
      const match = await findBestParticipantMatch(llmNormAdjusted, roomParticipants);
      if (match) {
        return { assignedTo: match, source: "llm_mapped" };
      }
    }
  }

  return {
    assignedTo: senderName,
    source: local?.mentioned ? "sender_fallback_unmatched_mention" : "sender_fallback",
  };
}
