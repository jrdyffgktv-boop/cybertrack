// 本地持久化：IndexedDB 为主，localStorage 做镜像与降级。
// 只存一份 PersistedState，读出来整体替换，避免增量合并出 bug。

const DB_NAME = 'cybertrack'
const STORE = 'kv'
const KEY = 'state'
const LS_KEY = 'cybertrack:state:v1'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function lsGet(): string | null {
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

function lsSet(text: string): void {
  try {
    localStorage.setItem(LS_KEY, text)
  } catch {
    // 隐私模式或超额：忽略，IndexedDB 仍是主存储
  }
}

export async function loadPersisted<T>(): Promise<T | undefined> {
  const db = await openDb()
  if (db) {
    const fromIdb = await new Promise<string | undefined>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(KEY)
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : undefined)
        req.onerror = () => resolve(undefined)
      } catch {
        resolve(undefined)
      }
    })
    if (fromIdb) {
      try {
        return JSON.parse(fromIdb) as T
      } catch {
        return undefined
      }
    }
  }
  const raw = lsGet()
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export async function savePersisted<T>(value: T): Promise<void> {
  const text = JSON.stringify(value)
  lsSet(text)
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(text, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearPersisted(): Promise<void> {
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    // ignore
  }
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
