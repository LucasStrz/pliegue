import type { FilterParams } from '../engine/filter';
export interface SavedProject { name: string; image: string; params: FilterParams; uiVersion?: 2 }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const r = indexedDB.open('pliegue', 1); r.onupgradeneeded = () => r.result.createObjectStore('projects'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function saveProject(project: SavedProject): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => { const t = db.transaction('projects', 'readwrite'); t.objectStore('projects').put(project, 'latest'); t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); }); } finally { db.close(); }
}
export async function restoreProject(): Promise<SavedProject | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const r = db.transaction('projects').objectStore('projects').get('latest'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
