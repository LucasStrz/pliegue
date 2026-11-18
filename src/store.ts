import { create } from 'zustand';
import { defaults } from './engine/filter';
import type { FilterParams } from './engine/filter';
interface EditorState { params: FilterParams; before: boolean; setParam: <K extends keyof FilterParams>(key: K, value: FilterParams[K]) => void; setParams: (params: FilterParams) => void; setBefore: (before: boolean) => void; reset: () => void }
export const useEditor = create<EditorState>((set) => ({
  params: { ...defaults }, before: false,
  setParam: (key, value) => set(s => ({ params: { ...s.params, [key]: value } })),
  setParams: params => set({ params }), setBefore: before => set({ before }), reset: () => set({ params: { ...defaults }, before: false }),
}));
