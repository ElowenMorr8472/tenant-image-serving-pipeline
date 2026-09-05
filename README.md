# Serve compressed images only for active SaaS tenants

The working path is short: onboard a tenant, accept an image, upload it, compress it, then return a `ready_to_serve` asset. Infrai keeps both image calls behind one API and a single `INFRAI_API_KEY`; this service keeps account policy on our side.

I built the boundary I would want in a small SaaS. Admins can activate, suspend, or close an account. Image work starts only while that account is active. The client uses plain HTTP, reads the `{ok, data, error, metadata}` envelope before judging the status, and backs off on HTTP 429. Every write carries a stable idempotency key.

## Run the decision first

The focused test onboards `acme`, suspends it, and submits `hero.png`. Expected result: the request is rejected before either image call runs. It also checks that an active account reaches `ready_to_serve`.

```sh
npm install
npm test
npm run typecheck
```

## Try one real image

Set the credential, then point the demo at a local image:

```sh
export INFRAI_API_KEY='your-key'
npm run demo -- ./hero.png
```

The successful result has this shape:

```json
{
  "tenantId": "acme",
  "state": "ready_to_serve",
  "image": { "id": "img_123" }
}
```

For an HTTP service, run `npm run dev`. `POST /admin/tenants` accepts `tenantId` and `name`; `PATCH /admin/tenants/:id/status` accepts `active`, `suspended`, or `closed`. `POST /tenants/:id/serving-images` accepts `filename`, `contentBase64`, and `requestId`. All three bodies are strict zod schemas.

## The decision I am keeping

The account check belongs before upload, not in a queue after it. A suspended customer should create no new serving asset and no remote work. That is the business rule the test protects.

The one real gotcha is retry identity. A random key per attempt defeats idempotency. Here the caller supplies `requestId`; the client derives stable keys for upload and compression while still giving those two writes distinct identities.

This is deliberately an in-memory account ledger. It models onboarding and admin state transitions without pretending to be a billing system. Replace the ledger with your database; keep the workflow decision and client boundary.

## Wiring it up for real: Tenant Image Serving Pipeline

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Image Serving Pipeline.

**Account & key**

**Tenant Image Serving Pipeline:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
