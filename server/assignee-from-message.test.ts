import { describe, it, expect } from "vitest";
import {
  cleanTaskDescription,
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

  it("matches explicit 'atribuir a Victor ...'", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "Atribuir a Victor a revisão do projeto de aterramento",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Victor Soares");
    expect(hit?.source).toBe("assign_phrase");
  });

  it("matches 'fica com Larissa ...'", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "Fica com Larissa atualizar o cronograma de TAFs",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Larissa Cortez");
    expect(hit?.source).toBe("assign_phrase");
  });

  it("matches 'passar para Luan ...'", async () => {
    const hit = await detectAssigneeFromMessageLocal(
      "Passar para Luan o acompanhamento da elevação 3",
      ROSTER
    );
    expect(hit?.matchedParticipant).toBe("Luan Silva");
  });

  it("matches first name Fabian", async () => {
    expect(findBestParticipantMatchLocalOnly("Fabian", ROSTER)).toBe("Fabian Robert");
  });

  it("local pattern wins over wrong LLM/sender", async () => {
    const resolved = await resolveTaskAssignee({
      messageContent: "Victor, faça a revisão do projeto de aterramento",
      llmAssignedTo: "Teste",
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
    expect(resolved.assignedTo).toBe("Luan Silva");
  });
});

describe("cleanTaskDescription (no assignee name in description)", () => {
  it("strips 'Victor, ' lead-in", () => {
    const d = cleanTaskDescription(
      "Victor, elaborar os desenhos de drenagem da SE",
      "Victor Soares",
      ROSTER
    );
    expect(d.toLowerCase()).not.toContain("victor");
    expect(d.toLowerCase()).toContain("elaborar");
  });

  it("strips '@Larissa favor '", () => {
    const d = cleanTaskDescription(
      "@Larissa favor revisar o memorial de cálculo",
      "Larissa Cortez",
      ROSTER
    );
    expect(d.toLowerCase()).not.toContain("larissa");
    expect(d.toLowerCase()).toContain("revisar");
  });

  it("strips 'Atribuir a Victor '", () => {
    const d = cleanTaskDescription(
      "Atribuir a Victor a revisão do projeto de aterramento",
      "Victor Soares",
      ROSTER
    );
    expect(d.toLowerCase()).not.toContain("victor");
    expect(d.toLowerCase()).toContain("revisão");
  });

  it("strips 'Fica com Fabian '", () => {
    const d = cleanTaskDescription(
      "Fica com Fabian atualizar a planilha de pendências",
      "Fabian Robert",
      ROSTER
    );
    expect(d.toLowerCase()).not.toContain("fabian");
    expect(d.toLowerCase()).toContain("atualizar");
  });

  it("keeps work text when no name prefix", () => {
    const d = cleanTaskDescription(
      "Atualizar a planilha de pendências ainda hoje",
      "Luciano",
      ROSTER
    );
    expect(d.toLowerCase()).toContain("atualizar a planilha");
  });
});
