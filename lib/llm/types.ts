export type LLMImage = { mimeType: string; dataBase64: string };

export interface LLMRequest {
  system?: string;
  prompt: string;
  images?: LLMImage[];
  /** ask the model to return a single JSON object */
  json?: boolean;
  /** hints used by the stub provider (e.g. { skillId, specialist }) */
  meta?: Record<string, unknown>;
}

export interface LLMProvider {
  name: string;
  /** whether this provider can analyze images (needed by the UX skill) */
  vision: boolean;
  complete(req: LLMRequest): Promise<string>;
}
