import { ImageServingWorkflow } from "./image_serving.js";
import { infraiImagesFromEnvironment } from "./infrai_images.js";
import { TenantLedger } from "./tenant_accounts.js";

const imagePath = process.argv[2];
if (!imagePath) throw new Error("Pass an image path as the first argument");

const { readFile } = await import("node:fs/promises");
const tenants = new TenantLedger();
tenants.onboard("acme", "Acme Docs");
const workflow = new ImageServingWorkflow(tenants, infraiImagesFromEnvironment());
const asset = await workflow.prepare(
  "acme",
  await readFile(imagePath),
  imagePath.split("/").at(-1) ?? "tenant-image",
  "onboarding-hero-v1",
);
console.log(JSON.stringify(asset, null, 2));
