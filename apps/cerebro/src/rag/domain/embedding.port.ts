/**
 * Puerto del proveedor de embeddings. La aplicación depende de esta interfaz;
 * el único adaptador que toca Voyage es `voyage.adapter.ts`. En tests se usa un
 * embedder determinístico. El embedding vive SIEMPRE en CEREBRO, nunca en las
 * plataformas (HUB manda texto, CEREBRO embebe).
 */
export interface EmbeddingProvider {
  /** Dimensión fija del espacio (Voyage voyage-3-large = 1024). */
  readonly dimension: number;
  /** Embebe N textos -> N vectores. Puede lanzar; los handlers lo capturan. */
  embed(texts: readonly string[]): Promise<number[][]>;
}
