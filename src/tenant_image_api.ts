import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { ImageServingWorkflow, TenantUnavailableError } from "./image_serving.js";
import { InfraiError, infraiImagesFromEnvironment } from "./infrai_images.js";
import { TenantLedger } from "./tenant_accounts.js";

const onboardBody = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(1),
}).strict();
const statusBody = z.object({
  status: z.enum(["active", "suspended", "closed"]),
}).strict();
const imageBody = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  requestId: z.string().min(1),
}).strict();

const tenants = new TenantLedger();
const workflow = new ImageServingWorkflow(tenants, infraiImagesFromEnvironment());

function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "POST" && url.pathname === "/admin/tenants") {
      const body = onboardBody.parse(await readJson(request));
      return send(response, 201, tenants.onboard(body.tenantId, body.name));
    }

    const statusMatch = url.pathname.match(/^\/admin\/tenants\/([^/]+)\/status$/);
    if (request.method === "PATCH" && statusMatch) {
      const body = statusBody.parse(await readJson(request));
      const tenant = tenants.setStatus(statusMatch[1], body.status);
      return tenant
        ? send(response, 200, tenant)
        : send(response, 404, { error: "Tenant not found" });
    }

    const imageMatch = url.pathname.match(/^\/tenants\/([^/]+)\/serving-images$/);
    if (request.method === "POST" && imageMatch) {
      const body = imageBody.parse(await readJson(request));
      const asset = await workflow.prepare(
        imageMatch[1],
        Buffer.from(body.contentBase64, "base64"),
        body.filename,
        body.requestId,
      );
      return send(response, 201, asset);
    }
    return send(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) return send(response, 400, { error: error.flatten() });
    if (error instanceof TenantUnavailableError) return send(response, 409, { error: error.message });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return send(response, status, { error: error.detail });
    }
    return send(response, 500, { error: error instanceof Error ? error.message : "Request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Tenant image API listening on http://localhost:${port}`));
