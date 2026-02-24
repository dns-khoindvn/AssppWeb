export async function autoRelogin(
  account: any,
  loginFn: Function,
  saveFn: Function,
  action: () => Promise<any>
) {
  try {
    return await action();
  } catch (e: any) {
    if (
      e?.code === "passwordExpired" ||
      e?.message?.includes("expired")
    ) {
      console.log("🔁 Session expired → relogin...");

      const session = await loginFn(
        account.email,
        account.password,
        account.deviceId // giữ nguyên ID
      );

      account.session = session;
      await saveFn(account);

      return await action();
    }

    throw e;
  }
}
