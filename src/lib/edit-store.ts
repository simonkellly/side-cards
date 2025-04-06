import { create } from 'zustand'

type EditStoreState = {
  focusedId: string | null;
  editingIds: string[];
}

export const useEditStore = create<EditStoreState>()(() => ({
  focusedId: null,
  editingIds: [],
}));
