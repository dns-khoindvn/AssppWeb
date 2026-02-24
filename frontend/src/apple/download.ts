import type { Account, Software, DownloadOutput, Sinf } from "../types";
import { isPasswordExpiredError, reloginAccount } from "./autoRelogin";
import { appleRequest } from "./request";
import { buildPlist, parsePlist } from "./plist";
import { extractAndMergeCookies } from "./cookies";
import { storeAPIHost } from "./config";
import i18n from "../i18n";

export async function getDownloadInfo(
  account: Account,
  app: Software,
  externalVersionId?: string,
): Promise<{
  output: DownloadOutput;
  updatedCookies: typeof account.cookies;
  updatedAccount?: Account;
}> {
  const runOnce = async (acc: Account) => {
    const deviceId = acc.deviceIdentifier;

    let requestHost = storeAPIHost(acc.pod);
    let requestPath = `/WebObjects/MZFinance.woa/wa/volumeStoreDownloadProduct?guid=${deviceId}`;
    let cookies = [...acc.cookies];
    let redirectAttempt = 0;

    while (redirectAttempt <= 3) {
      const payload: Record<string, any> = {
        creditDisplay: "",
        guid: deviceId,
        salableAdamId: app.id,
      };

      if (externalVersionId) {
        payload.externalVersionId = externalVersionId;
      }

      const plistBody = buildPlist(payload);

      const headers: Record<string, string> = {
        "Content-Type": "application/x-apple-plist",
        "iCloud-DSID": acc.directoryServicesIdentifier,
        "X-Dsid": acc.directoryServicesIdentifier,
      };

      const response = await appleRequest({
        method: "POST",
        host: requestHost,
        path: requestPath,
        headers,
        body: plistBody,
        cookies,
      });

      cookies = extractAndMergeCookies(response.rawHeaders, cookies);

      if (response.status === 302) {
        const location = response.headers["location"];
        if (!location) {
          throw new DownloadError(i18n.t("errors.download.redirectLocation"));
        }
        const url = new URL(location);
        requestHost = url.hostname;
        requestPath = url.pathname + url.search;
        redirectAttempt++;
        continue;
      }

      const dict = parsePlist(response.body) as Record<string, any>;

      if (dict.failureType) {
        const failureType = String(dict.failureType);
        const customerMessage = dict.customerMessage as string | undefined;
        switch (failureType) {
          case "2034":
          case "2042":
            throw new DownloadError(
              i18n.t("errors.download.passwordExpired"),
              failureType,
            );
          case "9610":
            throw new DownloadError(
              i18n.t("errors.download.licenseRequired"),
              "9610",
            );
          default: {
            if (customerMessage === "Your password has changed.") {
              throw new DownloadError(
                i18n.t("errors.download.passwordExpired"),
                failureType,
              );
            }
            throw new DownloadError(
              customerMessage ??
                i18n.t("errors.download.downloadFailed", { failureType }),
              failureType,
            );
          }
        }
      }

      const songList = dict.songList as Record<string, any>[] | undefined;
      if (!songList || songList.length === 0) {
        throw new DownloadError(i18n.t("errors.download.noItems"));
      }

      const item = songList[0];
      const url = item.URL as string;
      if (!url) {
        throw new DownloadError(i18n.t("errors.download.missingUrl"));
      }

      const metadata = item.metadata as Record<string, any>;
      if (!metadata) {
        throw new DownloadError(i18n.t("errors.download.missingMetadata"));
      }

      const version = metadata.bundleShortVersionString as string;
      const bundleVersion = metadata.bundleVersion as string;
      if (!version || !bundleVersion) {
        throw new DownloadError(i18n.t("errors.download.missingVersion"));
      }

      const sinfs: Sinf[] = [];
      const sinfData = item.sinfs as Record<string, any>[] | undefined;
      if (sinfData) {
        for (const sinfItem of sinfData) {
          const id = sinfItem.id as number;
          const sinf = sinfItem.sinf;
          if (id !== undefined && sinf) {
            let sinfBase64: string;
            if (sinf instanceof Uint8Array || sinf instanceof ArrayBuffer) {
              const bytes =
                sinf instanceof ArrayBuffer ? new Uint8Array(sinf) : sinf;
              sinfBase64 = base64FromBytes(bytes);
            } else if (typeof sinf === "string") {
              sinfBase64 = sinf;
            } else {
              throw new DownloadError(i18n.t("errors.download.invalidSinf"));
            }
            sinfs.push({ id, sinf: sinfBase64 });
          }
        }
      }

      if (sinfs.length === 0) {
        throw new DownloadError(i18n.t("errors.download.noSinf"));
      }

      // Build iTunesMetadata plist
      const metadataDict: Record<string, any> = { ...metadata };
      metadataDict["apple-id"] = acc.email;
      metadataDict["userName"] = acc.email;
      delete metadataDict.passwordToken;
      delete metadataDict["passwordToken"];
      const iTunesMetadata = base64FromString(buildPlist(metadataDict));

      return {
        output: {
          downloadURL: url,
          sinfs,
          bundleShortVersionString: version,
          bundleVersion,
          iTunesMetadata,
        },
        updatedCookies: cookies,
      };
    }

    throw new DownloadError(i18n.t("errors.download.tooManyRedirects"));
  };

  // ✅ chạy lần 1
  try {
    return await runOnce(account);
  } catch (e) {
    // ✅ nếu token/cookie hết hạn → relogin → chạy lại lần 2
    if (!isPasswordExpiredError(e)) throw e;

    const refreshed = await reloginAccount(account);
    const result = await runOnce(refreshed);

    return { ...result, updatedAccount: refreshed };
  }
}
