import type { Account, Software } from "../types";
import { appleRequest } from "./request";
import { buildPlist, parsePlist } from "./plist";
import { extractAndMergeCookies } from "./cookies";
import { purchaseAPIHost } from "./config";
import i18n from "../i18n";
import { isPasswordExpiredError, reloginAccount } from "./autoRelogin";

export class PurchaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PurchaseError";
  }
}

export async function purchaseApp(
  account: Account,
  app: Software,
): Promise<{ updatedCookies: typeof account.cookies; updatedAccount?: Account }> {
  // Không hỗ trợ app trả phí (giữ nguyên logic cũ)
  if ((app.price ?? 0) > 0) {
    throw new PurchaseError(i18n.t("errors.purchase.paidNotSupported"));
  }

  const runOnce = async (acc: Account) => {
    try {
      return await purchaseWithParams(acc, app, "STDQ");
    } catch (e) {
      // fallback như bản gốc: nếu STDQ fail code 2059 -> thử GAME
      if (e instanceof PurchaseError && e.code === "2059") {
        return await purchaseWithParams(acc, app, "GAME");
      }
      throw e;
    }
  };

  try {
    return await runOnce(account);
  } catch (e) {
    if (!isPasswordExpiredError(e)) throw e;

    // 🔁 token/cookie hết hạn -> relogin -> retry 1 lần
    const refreshed = await reloginAccount(account);
    const result = await runOnce(refreshed);
    return { ...result, updatedAccount: refreshed };
  }
}

async function purchaseWithParams(
  account: Account,
  app: Software,
  pricingParameter: "STDQ" | "GAME",
): Promise<{ updatedCookies: typeof account.cookies }> {
  const host = purchaseAPIHost(account.pod);

  // Apple purchase endpoint (giữ nguyên pattern của project)
  const path = "/WebObjects/MZFinance.woa/wa/buyProduct";

  const payload: Record<string, any> = {
    appExtVrsId: app.versionId,
    buyWithoutAuthorization: "true",
    guid: account.deviceIdentifier,
    hasAskedToFulfillPreorder: "true",
    needDiv: "0",
    origPage: "SoftwarePage",
    price: "0",
    pricingParameter,
    productType: "C",
    salableAdamId: app.id,
  };

  const body = buildPlist(payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/x-apple-plist",
    "iCloud-DSID": account.directoryServicesIdentifier,
    "X-Dsid": account.directoryServicesIdentifier,
  };

  const response = await appleRequest({
    method: "POST",
    host,
    path,
    headers,
    body,
    cookies: account.cookies,
  });

  const updatedCookies = extractAndMergeCookies(response.rawHeaders, account.cookies);

  const dict = parsePlist(response.body) as Record<string, any>;

  // Apple lỗi trả về dạng failureType / customerMessage
  if (dict.failureType) {
    const failureType = String(dict.failureType);
    const customerMessage = dict.customerMessage as string | undefined;

    switch (failureType) {
      case "2034":
      case "2042":
        throw new PurchaseError(i18n.t("errors.purchase.passwordExpired"), failureType);

      case "2059":
        // để purchaseApp bắt và thử GAME
        throw new PurchaseError(i18n.t("errors.purchase.failed", { failureType }), failureType);

      case "9610":
        throw new PurchaseError(i18n.t("errors.purchase.subscriptionRequired"), failureType);

      default:
        throw new PurchaseError(
          customerMessage ?? i18n.t("errors.purchase.failedGeneral"),
          failureType,
        );
    }
  }

  return { updatedCookies };
}
