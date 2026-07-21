import { ENV } from "./env";

// Types
export type Role = "system" | "user" | "assistant" | "tool" | "function";
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};
export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};
export type ToolChoice = "none" | "auto" | "required" | { type: "function"; function: { name: string } };
export type ResponseFormat = {
  type: "json_schema" | "json_object" | "text";
  json_schema?: { name: string; schema: Record<string, unknown>; strict?: boolean };
};

export type InvokeParams = {
  messages: Message[];
  model?: string;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  outputSchema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  thinking?: boolean;
  reasoning?: boolean;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
};

export type InvokeResult = {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    };
    finish_reason: string;
  }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

const DEFAULT_MODEL = ENV.openrouterModel || "deepseek/deepseek-chat";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function assertApiKey() {
  if (!ENV.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured. Set it in environment variables.");
  }
}

function normalizeMessage(msg: Message): Message {
  return msg;
}

function normalizeToolChoice(choice: ToolChoice | undefined, tools?: Tool[]) {
  if (!choice) return undefined;
  if (typeof choice === "string") return choice;
  return choice;
}

function normalizeResponseFormat(params: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}) {
  const { responseFormat, response_format, outputSchema, output_schema } = params;
  const rf = responseFormat || response_format;
  if (rf) return rf;
  const schema = outputSchema || output_schema;
  if (schema) {
    return {
      type: "json_schema" as const,
      json_schema: { name: "response", schema, strict: true },
    };
  }
  return undefined;
}

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const fetchWithBackoff = async (
  url: string,
  init: FetchInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err as Error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError || new Error("Fetch failed after retries");
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    maxTokens,
    max_tokens,
    temperature,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
    model: model || DEFAULT_MODEL,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (typeof temperature === "number") {
    payload.temperature = temperature;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetchWithBackoff(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openrouterApiKey}`,
      "HTTP-Referer": ENV.appUrl || "https://chataskweb.onrender.com",
      "X-Title": "Chataskweb",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

export async function listLLMModels() {
  assertApiKey();
  const response = await fetchWithBackoff("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: { authorization: `Bearer ${ENV.openrouterApiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.status}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function invokeLLMStream(params: InvokeParams): Promise<ReadableStream<Uint8Array>> {
  assertApiKey();
  const {
    messages,
    model,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    temperature,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
    model: model || DEFAULT_MODEL,
    stream: true,
  };

  if (t  if (t  if (t  if (t  if (t  if (t  if (tols = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(toolChoice || tool_choice, tools);
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (typeof temperature === "number") {
    payload.temperature = temperature;
  }

  const response = await fetchWithBackoff(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openrouterApiKey}`,
      "HTTP-Referer": ENV.appUrl || "https://chataskweb.onrender.com",
      "X-Title": "Chataskweb",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM stream failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return response.body as ReadableStream<Uint8Array>;
}
