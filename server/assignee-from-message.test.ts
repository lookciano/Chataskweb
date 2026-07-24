import { describe, it, expect } from "vitest";
import {
  detectAssigneeFromMessageLocal,
  findBestParticipantMatchLocalOnly,
  resolveTaskAssignee,
} from "./assignee-from-message";

const ROSTER = [
  "Luciano",
  "Larissa Cortez",
  "Victor Soares",
  "Sérgio Amorim",
  "Fabian Robert",
  "Luan Silva",
  "Teste",
];

describe("local assignee detection (no LLM)", () => {
  it("matches 'Victor, ...' at start to Victor Soares", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "Victor, elaborar os desenhos de drenagem da SE",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Victor Soares");
    expect(hit?.source).toBe("name_comma");
  });

  it("matches '@Larissa ...' to Larissa Cortez", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "@Larissa favor revisar o memorial de cálculo",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Larissa Cortez");
    expect(hit?.source).toBe("at_mention");
  });

  it("matches 'Sérgio precisa ...' despite accent differences", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "Sergio precisa enviar o cronograma ao ONS",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Sérgio Amorim");
  });

  it("matches first name Fabian", async () => {
    expect(findBestParticipantMatchLocalOnly("Fabian", ROSTER)).toBe("Fabian Robert");
  });

  it("local pattern wins over wrong LLM/sender", async () => {
    const resolved = await resolveTaskAssignee({
      messageContent: "Victor, faça a revisão do projeto de aterramento",
      llmAssignedTo: "Teste", // model wrongly used sender-like name
      senderName: "Teste",
      roomParticipants: ROSTER,
    });
    expect(resolved.assignedTo).toBe("Victor Soares");
    expect(resolved.source.startsWith("local:")).toBe(true);
  });

  it("falls back to sender when no name is mentioned", async () => {
    const resolved = await resolveTaskAssignee({
      messageContent: "Preciso atualizar a planilha de pendências ainda hoje",
      llmAssignedTo: undefined,
      senderName: "Luciano",
      roomParticipants: ROSTER,
    });
    expect(resolved.assignedTo).toBe("Luciano");
    expect(resolved.source).toBe("sender_fallback");
  });

  it("maps LLM name when local pattern missing", async () => {
    const resolved = await resolveTaskAssignee({
      messageContent: "Quem puder tratar: revisar as TAF da elevação 3",
      llmAssignedTo: "Luan",
      senderName: "Luciano",
      roomParticipants: ROSTER,
    });
    // May be llm_local_mapped if partial map works
    expect(resolved.assignedTo).toBe("Luan Silva");
  });
});
