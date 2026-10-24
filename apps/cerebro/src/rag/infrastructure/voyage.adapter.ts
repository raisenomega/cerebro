/**
 * ÚNICO archivo que habla con Voyage. Embeddings con `voyage-3-large`,
 * `output_dimension = 1024` FIJO. La API key vive en el Vault (env
 * VOYAGE_API_KEY), NUNCA en código. Usa `fetch` global (Node >= 18).
 */
import type { EmbeddingProvider } from "../domain/embedding.port.js";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const DIMENSION = 1024;

interface VoyageResponse {
  readonly data: ReadonlyArray<{ readonly embedding: number[] }>;
}

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = DIMENSION;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string = requireEnv("VOYAGE_API_KEY"), model: string = process.env.VOYAGE_MODEL ?? "voyage-3-large") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        output_dimension: DIMENSION,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Voyage ${res.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await res.json()) as VoyageResponse;
    return json.data.map((d) => d.embedding);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Falta la variable de entorno requerida: ${name} (va en el Vault, no en el repo).`);
  }
  return value;
}
