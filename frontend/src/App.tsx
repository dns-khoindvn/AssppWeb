import { Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "./store/settings";
import { useAccounts } from "./hooks/useAccounts";
import { authenticate, AuthenticationError } from "./apple/authenticate";
import { generateDeviceId } from "./apple/config";

import Sidebar from "./components/Layout/Sidebar";
import MobileNav from "./components/Layout/MobileNav";
import MobileHeader from "./components/Layout/MobileHeader";

const HomePage = lazy(() => import("./components/Welcome/HomePage"));
const AccountList = lazy(() => import("./components/Account/AccountList"));
const AddAccountForm = lazy(
  () => import("./components/Account/AddAccountForm"),
);
const AccountDetail = lazy(() => import("./components/Account/AccountDetail"));
const SearchPage = lazy(() => import("./components/Search/SearchPage"));
const ProductDetail = lazy(() => import("./components/Search/ProductDetail"));
const VersionHistory = lazy(() => import("./components/Search/VersionHistory"));
const DownloadList = lazy(() => import("./components/Download/DownloadList"));
const AddDownload = lazy(() => import("./components/Download/AddDownload"));
const PackageDetail = lazy(() => import("./components/Download/PackageDetail"));
const SettingsPage = lazy(() => import("./components/Settings/SettingsPage"));

function Loading() {
  const { t } = useTranslation();
  return (
    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
      {t("loading")}
    </div>
  );
}

export default function App() {
  const theme = useSettingsStore((s) => s.theme);
  const { accounts, loading: accountsLoading, addAccount } = useAccounts();
  const [bootError, setBootError] = useState<string | null>(null);
  const attempted = useRef(false);

  // Optional: bootstrap a default account from environment variables.
  // Set these in frontend/.env (Vite):
  //   VITE_DEFAULT_APPLE_EMAIL=you@example.com
  //   VITE_DEFAULT_APPLE_PASSWORD=your_password
  //   VITE_DEFAULT_DEVICE_ID=XXXXXXXXXXXX (optional)
  useEffect(() => {
    if (attempted.current) return;
    if (accountsLoading) return;

    const email = import.meta.env.VITE_DEFAULT_APPLE_EMAIL as
      | string
      | undefined;
    const password = import.meta.env.VITE_DEFAULT_APPLE_PASSWORD as
      | string
      | undefined;
    const deviceId =
      (import.meta.env.VITE_DEFAULT_DEVICE_ID as string | undefined) ||
      generateDeviceId();

    // Only auto-add when there are no saved accounts.
    if (!email || !password || accounts.length > 0) {
      attempted.current = true;
      return;
    }

    attempted.current = true;
    (async () => {
      try {
        setBootError(null);
        const account = await authenticate(email, password, undefined, undefined, deviceId);
        await addAccount(account);
      } catch (err) {
        // If Apple requires 2FA code, user must add the account manually.
        if (err instanceof AuthenticationError && err.codeRequired) {
          setBootError(
            "Tài khoản mặc định cần mã 2FA. Vui lòng vào /accounts/add để đăng nhập và nhập mã."
          );
        } else {
          setBootError(
            "Không thể đăng nhập tài khoản mặc định. Kiểm tra VITE_DEFAULT_APPLE_EMAIL/PASSWORD trong frontend/.env."
          );
        }
      }
    })();
  }, [accountsLoading, accounts.length, addAccount]);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const isDark =
        theme === "dark" || (theme === "system" && mediaQuery.matches);
      if (isDark) {
        root.classList.add("dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.style.colorScheme = "light";
      }
    }

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 safe-top">
        <MobileHeader />
        <Suspense fallback={<Loading />}>
          {bootError && (
            <div className="px-4 pt-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg p-3 text-sm">
                {bootError}
              </div>
            </div>
          )}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/accounts" element={<AccountList />} />
            <Route path="/accounts/add" element={<AddAccountForm />} />
            <Route path="/accounts/:email" element={<AccountDetail />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/search/:appId" element={<ProductDetail />} />
            <Route
              path="/search/:appId/versions"
              element={<VersionHistory />}
            />
            <Route path="/downloads" element={<DownloadList />} />
            <Route path="/downloads/add" element={<AddDownload />} />
            <Route path="/downloads/:id" element={<PackageDetail />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </main>
      <MobileNav />
    </div>
  );
}
