import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";
import { logOutAction } from "@/app/actions/auth";

const storeName = "state";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("clocked-in", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open lookup storage."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not read lookup storage."));
  });
}

const lookupStorage = {
  async getItem(key: string) {
    const db = await database();
    const value = await requestResult(db.transaction(storeName, "readonly").objectStore(storeName).get(key));
    return typeof value === "string" ? value : null;
  },
  async setItem(key: string, value: string) {
    const db = await database();
    await requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).put(value, key));
  },
  async removeItem(key: string) {
    const db = await database();
    await requestResult(db.transaction(storeName, "readwrite").objectStore(storeName).delete(key));
  },
};

export const lookupPersister = createAsyncStoragePersister({
  storage: typeof indexedDB === "undefined" ? undefined : lookupStorage,
  key: "clocked-in.lookups",
});

export function persistedLookupQuery(query: Query) {
  return query.state.status === "success" && query.queryKey[2] === "lookups";
}

export async function signOut() {
  await lookupPersister.removeClient().catch(() => undefined);
  await logOutAction();
}
