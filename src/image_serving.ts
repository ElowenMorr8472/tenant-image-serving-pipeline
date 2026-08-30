import type { CompressedImage } from "./infrai_images.js";
import type { TenantLedger } from "./tenant_accounts.js";

export type ImageCompressor = {
  uploadAndCompress(bytes: Uint8Array, filename: string, operationId: string): Promise<CompressedImage>;
};

export type ServingAsset = {
  tenantId: string;
  state: "ready_to_serve";
  image: CompressedImage;
};

export class TenantUnavailableError extends Error {}

export class ImageServingWorkflow {
  private readonly tenants: TenantLedger;
  private readonly images: ImageCompressor;

  constructor(
    tenants: TenantLedger,
    images: ImageCompressor,
  ) {
    this.tenants = tenants;
    this.images = images;
  }

  async prepare(
    tenantId: string,
    bytes: Uint8Array,
    filename: string,
    requestId: string,
  ): Promise<ServingAsset> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new TenantUnavailableError("Tenant is not active");
    }
    const image = await this.images.uploadAndCompress(
      bytes,
      filename,
      `tenant-image:${tenantId}:${requestId}`,
    );
    return { tenantId, state: "ready_to_serve", image };
  }
}
