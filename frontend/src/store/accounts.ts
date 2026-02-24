import { create } from "zustand";
import { openDB, type IDBPDatabase } from "idb";
import type { Account } from "../types";
import { apiGet } from "../api/client";

const DB_NAME = "asspp-accounts";
const STORE_NAME = "accounts";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "email" });
        }
      },
    });
  }
  return dbPromise;
}

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  removeAccount: (email: string) => Promise<void>;
  updateAccount: (account: Account) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set, get) => ({
  accounts: [],
  loading: true,

  loadAccounts: async () => {
  set({ loading: true });
  const db = await getDB();
  let accounts = await db.getAll(STORE_NAME);

  // Try to seed a default server-side account (optional)
  try {
    const resp: any = await apiGet("/api/default-account/credentials");
    if (resp?.ok && resp?.account?.email && resp?.account?.password) {
      const email = String(resp.account.email);
      const password = String(resp.account.password);
      if (!accounts.find((a) => a.email === email)) {
        const seeded: Account = {
          email,
          password,
          cookies: [],
          storeFront: "",
          deviceId: "",
        };
        await db.put(STORE_NAME, seeded);
        accounts = [...accounts, seeded];
      }
    }
  } catch {
    // If ADMIN_PASSWORD is set and not provided, this will 401. Ignore.
  }

  set({ accounts, loading: false });
},

  addAccount: async (account: Account) => {
    const db = await getDB();
    await db.put(STORE_NAME, account);
    set({
      accounts: [
        ...get().accounts.filter((a) => a.email !== account.email),
        account,
      ],
    });
  },

  removeAccount: async (email: string) => {
    const db = await getDB();
    await db.delete(STORE_NAME, email);
    set({ accounts: get().accounts.filter((a) => a.email !== email) });
  },

  updateAccount: async (account: Account) => {
    const db = await getDB();
    await db.put(STORE_NAME, account);
    set({
      accounts: get().accounts.map((a) =>
        a.email === account.email ? account : a,
      ),
    });
  },
}));

// Auto-load accounts on import
useAccountsStore.getState().loadAccounts();
