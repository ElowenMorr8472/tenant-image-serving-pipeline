import assert from "node:assert/strict";
import test from "node:test";
import { ImageServingWorkflow, TenantUnavailableError } from "../src/image_serving.js";
import { TenantLedger } from "../src/tenant_accounts.js";

test("a suspended tenant cannot create a serving asset", async () => {
  const tenants = new TenantLedger();
  tenants.onboard("acme", "Acme Docs");
  tenants.setStatus("acme", "suspended");
  let calls = 0;
  const images = {
    async uploadAndCompress() {
      calls += 1;
      return { id: "img_ready" };
    },
  };
  const workflow = new ImageServingWorkflow(tenants, images);

  await assert.rejects(
    workflow.prepare("acme", new Uint8Array([1]), "hero.png", "request-1"),
    TenantUnavailableError,
  );
  assert.equal(calls, 0);
});

test("an active tenant receives a ready-to-serve asset", async () => {
  const tenants = new TenantLedger();
  tenants.onboard("acme", "Acme Docs");
  const workflow = new ImageServingWorkflow(tenants, {
    async uploadAndCompress() {
      return { id: "img_ready" };
    },
  });

  const asset = await workflow.prepare(
    "acme",
    new Uint8Array([1]),
    "hero.png",
    "request-1",
  );
  assert.deepEqual(asset, {
    tenantId: "acme",
    state: "ready_to_serve",
    image: { id: "img_ready" },
  });
});
