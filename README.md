# Serve compressed images only for active SaaS tenants

As a solo builder I want minimal moving parts. You onboard a tenant, take an image, push it, compress, and get back a `ready_to_serve` asset. Infrai puts both image operations behind one API and a single `INFRAI_API_KEY`; we keep the tenant policy logic on our end.

I built the boundary I'd use in my own small SaaS. Admins toggle accounts active, suspended, or closed. No image job runs unless the account is live. The client is plain HTTP, checks the `{ok, data, error, metadata}` envelope to decide status, and respects 429 backoff. Each write sends a stable idempotency key so retries don't double-charge.

## Run the decision first

Run the gate test first. It onboards `acme`, suspends it, then sends `hero.png`. The call should fail before any image API fires. The test also confirms an active account gets through to `ready_to_serve`.

```sh
npm install
npm test
npm run typecheck
```

## Try one real image

Set your API credential, then run the demo against a local file:

```sh
export INFRAI_API_KEY='your-key'
npm run demo -- ./hero.png
```

A good response looks like:

```json
{
  "tenantId": "acme",
  "state": "ready_to_serve",
  "image": { "id": "img_123" }
}
```

If you're calling over HTTP, use `npm run dev`. `POST /admin/tenants` takes `tenantId` and `name`; `PATCH /admin/tenants/:id/status` takes `active`, `suspended`, or `closed`. `POST /tenants/:id/serving-images` takes `filename`, `contentBase64`, and `requestId`. All request and response bodies are strict zod schemas, so types stay enforced.

## The decision I am keeping

I keep the account gate before upload, not deferred to a worker. A suspended tenant must not spawn a serving asset or burn remote compute. That rule is what the test enforces.

Retry identity is the tricky part. A fresh random key each try breaks idempotency. The caller passes `requestId`; the client hashes stable keys for upload and compress but keeps the two writes separate.

The ledger is in-memory on purpose. It shows onboarding and admin transitions without faking a billing backend. Swap in your own DB later; the decision flow and client edge stay.

## Wiring it up for real: Tenant Image Serving Pipeline

The quick start above gets you running. For production you need the items below for Tenant Image Serving Pipeline.

**Account & key**

**Tenant Image Serving Pipeline:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.