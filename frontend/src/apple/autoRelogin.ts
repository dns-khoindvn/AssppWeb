import type { Account } from "../types";
import { authenticate } from "./authenticate";

/** Re-login lại để lấy passwordToken/cookies mới (GIỮ deviceIdentifier cũ) */
export async function reloginAccount(account: Account): Promise<Account> {
  return authenticate(
    account.email,
    account.password,
    undefined,
    account.cookies,
    account.deviceIdentifier,
  );
}

export function isPasswordExpiredError(e: any): boolean {
  // DownloadError / PurchaseError đều có .code
  const code = String(e?.code ?? "");
  if (code === "2034" || code === "2042") return true;
  // fallback an toàn
  const msg = String(e?.message ?? "").toLowerCase();
  return msg.includes("expired");
}
