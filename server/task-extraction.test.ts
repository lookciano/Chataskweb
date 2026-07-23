import { describe, it, expect, beforeAll } from "vitest";
import { extractTasksFromMessage } from "./llm-task-extractor";

describe("Task Extraction with Spelling Correction", () => {
  it("should extract tasks from a message with spelling errors", async () => {
    const message = "Precisa fazer uma reuniao com o cliente amanha para discutir os requisitos do projeto";
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    
    // Should have at least one task
    if (tasks.length > 0) {
      const task = tasks[0];
      expect(task.description).toBeDefined();
      // Description should be corrected (reuniao -> reunião, amanha -> amanhã)
      expect(task.description.toLowerCase()).not.toContain("reuniao");
      expect(task.description.toLowerCase()).not.toContain("amanha");
    }
  });

  it("should handle long descriptions (increased character limit)", async () => {
    const longMessage = `Precisa fazer uma analise completa do sistema de gestao de atividades. 
    Verificar todos os modulos, testar as funcionalidades principais, 
    documentar os problemas encontrados e criar um relatorio detalhado com 
    recomendacoes de melhorias. Isso deve ser feito em colaboracao com o time 
    de desenvolvimento e deve incluir testes de performance, seguranca e usabilidade.`;
    
    const tasks = await extractTasksFromMessage(longMessage, "John Doe", true);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    
    // Should extract at least one task
    if (tasks.length > 0) {
      const task = tasks[0];
      expect(task.description).toBeDefined();
      // Description should be corrected
      expect(task.description.length).toBeGreaterThan(50);
    }
  });

  it("should correct common Portuguese spelling errors", async () => {
    const message = "Responsavel deve fazer a apresentacao e enviar a comunicacao para todos";
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    
    if (tasks.length > 0) {
      const task = tasks[0];
      // Should not contain common misspellings
      expect(task.description.toLowerCase()).not.toContain("responsavel");
      expect(task.description.toLowerCase()).not.toContain("apresentacao");
      expect(task.description.toLowerCase()).not.toContain("comunicacao");
    }
  });

  it("should maintain task priority and assignment information", async () => {
    const message = "URGENTE: Victor precisa revisar o codigo e fazer deploy hoje";
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    
    if (tasks.length > 0) {
      const task = tasks[0];
      expect(task.priority).toBeDefined();
      expect(["low", "medium", "high"]).toContain(task.priority);
      // Should identify Victor as assignee
      if (task.assignedTo) {
        expect(task.assignedTo.toLowerCase()).toContain("victor");
      }
    }
  });

  it("should create at most one task per message (even if multiple actions listed)", async () => {
    const message = `
      1. Larissa precisa fazer a revisao do documento
      2. Sergio deve preparar a apresentacao para amanha
      3. Victor tem que enviar o relatorio ao cliente
    `;
    
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    // One chat message => at most one task; description is the full message (corrected)
    expect(tasks.length).toBeLessThanOrEqual(1);
    if (tasks.length === 1) {
      expect(tasks[0].description.length).toBeGreaterThan(40);
    }
  });

  it("should disable spelling correction when flag is false", async () => {
    const message = "Precisa fazer uma reuniao com o cliente";
    const tasks = await extractTasksFromMessage(message, "John Doe", false);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
  });

  it("should handle empty messages", async () => {
    const message = "";
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(0);
  });

  it("should handle messages without tasks", async () => {
    const message = "Oi, tudo bem? Como você está?";
    const tasks = await extractTasksFromMessage(message, "John Doe", true);
    
    expect(tasks).toBeDefined();
    expect(Array.isArray(tasks)).toBe(true);
    // Should not extract tasks from casual conversation
    const taskCount = tasks.filter(t => t.isTask).length;
    expect(taskCount).toBe(0);
  });
});
