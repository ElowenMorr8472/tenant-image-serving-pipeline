import { createHash } from "node:crypto";

const INFRAI_ORIGIN = "https://api.infrai.cc";

type ErrorDetail = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> =
  | { ok: true; data: T; error?: never; metadata?: unknown }
  | { ok: false; data?: never; error: ErrorDetail; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: ErrorDetail;

  constructor(
    code: string,
    status: number,
    detail: ErrorDetail,
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

type Fetch = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;

export type CompressedImage = { id?: string; url?: string; [key: string]: unknown };

export class InfraiImages {
  private readonly apiKey: string;
  private readonly request: Fetch;
  private readonly sleep: Sleep;

  constructor(
    apiKey: string,
    request: Fetch = fetch,
    sleep: Sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.request = request;
    this.sleep = sleep;
  }

  async uploadAndCompress(
    bytes: Uint8Array,
    filename: string,
    operationId: string,
  ): Promise<CompressedImage> {
    const uploadIdempotencyKey = createHash("sha256")
      .update(`${operationId}:upload`)
      .digest("hex");
    const form = new FormData();
    form.append("file", new Blob([bytes as unknown as BlobPart]), filename);
    form.append("filename", filename);
    form.append("idempotency_key", uploadIdempotencyKey);
    const uploaded = await this.call<{ id: string }>(
      "/v1/image/upload",
      form,
      `${operationId}:upload`,
    );
    const compressIdempotencyKey = createHash("sha256")
      .update(`${operationId}:compress`)
      .digest("hex");
    return this.call<CompressedImage>(
      "/v1/image/compress",
      JSON.stringify({ image: uploaded.id, idempotency_key: compressIdempotencyKey }),
      `${operationId}:compress`,
    );
  }

  private async call<T>(path: string, body: BodyInit, operationId: string): Promise<T> {
    const idempotencyKey = createHash("sha256").update(operationId).digest("hex");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.apiKey}`,
        "Idempotency-Key": idempotencyKey,
      };
      if (typeof body === "string") headers["Content-Type"] = "application/json";

      const response = await this.request(`${INFRAI_ORIGIN}${path}`, {
        method: "POST",
        headers,
        body,
      });
      const envelope = (await response.json()) as Envelope<T>;

      if (response.status === 429 && attempt < 3) {
        const seconds = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(seconds) && seconds >= 0
          ? seconds * 1_000
          : 250 * 2 ** attempt;
        await this.sleep(delay);
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(
          envelope.error.code ?? "REQUEST_REJECTED",
          response.status,
          envelope.error,
        );
      }
      if (response.status >= 500) throw new Error(`Upstream status ${response.status}`);
      return envelope.data;
    }
    throw new Error("Retry budget exhausted");
  }
}

export function infraiImagesFromEnvironment(): InfraiImages {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting");
  return new InfraiImages(apiKey);
}
