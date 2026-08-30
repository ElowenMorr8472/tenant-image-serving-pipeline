export type AccountStatus = "active" | "suspended" | "closed";

export type TenantAccount = {
  id: string;
  name: string;
  status: AccountStatus;
};

export class TenantLedger {
  private readonly accounts = new Map<string, TenantAccount>();

  onboard(id: string, name: string): TenantAccount {
    if (this.accounts.has(id)) throw new Error("Tenant already exists");
    const account: TenantAccount = { id, name, status: "active" };
    this.accounts.set(id, account);
    return account;
  }

  setStatus(id: string, status: AccountStatus): TenantAccount | undefined {
    const current = this.accounts.get(id);
    if (!current) return undefined;
    const updated = { ...current, status };
    this.accounts.set(id, updated);
    return updated;
  }

  get(id: string): TenantAccount | undefined {
    return this.accounts.get(id);
  }
}
