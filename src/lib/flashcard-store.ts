import { customAlphabet } from 'nanoid';
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePluginStore } from './plugin-store';
import { BASE_PATH, FLASHCARD_LINK_REGEX } from '@/constants';
import { TFile } from 'obsidian';

export type RawFlashcard = {
  id: string;
  text: string;
  extra: string;
  filePath: string;
}

function replaceImageText(text: string) {
  const plugin = usePluginStore.getState().plugin;
  return text.replace(/!\[\[(.+?)\]\]/g, (match, p1) => {
    const file = plugin.app.vault.getFileByPath(p1);
    if (!file) return match;
    const imagePath = plugin.app.vault.getResourcePath(file);
    return `<img src="${imagePath}" alt="${p1}" />`;
  });
}

export function processFlashcard(rawFlashcard: RawFlashcard) {
  const result = {
    id: rawFlashcard.id,
    htmlText: rawFlashcard.text,
    htmlExtra: rawFlashcard.extra,
  };

  // Newline: \n
  result.htmlText = result.htmlText.replace(/\n/g, '<br />');
  result.htmlExtra = result.htmlExtra.replace(/\n/g, '<br />');

  // Bold: **bold**
  result.htmlText = result.htmlText.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  result.htmlExtra = result.htmlExtra.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Cloze: {{c1::cloze}}
  result.htmlText = result.htmlText.replace(/\{\{c\d+::([^}]+)\}\}/g, '<span class="cloze">$1</span>');

  // Image: ![[image.png]]
  result.htmlText = replaceImageText(result.htmlText);
  result.htmlExtra = replaceImageText(result.htmlExtra);

  return result;
}

export type SortedFlashcard = RawFlashcard & {
  isSorted: boolean;
}

export async function getSortedFlashcards(rawCards: RawFlashcard[], file?: TFile): Promise<SortedFlashcard[]> {
  if (!file) return [];
  if (!rawCards || rawCards.length === 0) return [];
  
  const plugin = usePluginStore.getState().plugin;
  const flashcards = rawCards.filter(card => card.filePath === file.path);
  
  const data = await plugin.app.vault.cachedRead(file);
  const flashcardIds = data.match(FLASHCARD_LINK_REGEX);
  if (!flashcardIds) {
    return flashcards.map(card => ({ ...card, isSorted: false }));
  }

  const flashcardsMap = new Map(flashcards.map(card => [card.id, card]));
  
  const sortedIds = new Set<string>();
  
  const sortedFlashcards = [];
  for (const flashcardId of flashcardIds) {
    const id = flashcardId.replace(FLASHCARD_LINK_REGEX, "$1");
    const flashcard = flashcardsMap.get(id);
    if (flashcard) {
      sortedFlashcards.push({ ...flashcard, isSorted: true });
      sortedIds.add(id);
    }
  }
  
  const unsortedFlashcards = flashcards
    .filter(card => !sortedIds.has(card.id))
    .map(card => ({ ...card, isSorted: false }));
  
  return [...unsortedFlashcards, ...sortedFlashcards];
}

export async function deleteUnreferencedFlashcards() {
  const plugin = usePluginStore.getState().plugin;
  const flashcards = useFlashcardStore.getState().flashcards;
  const flashcardIds = new Set(flashcards.map(card => card.id));
  const noteIds = new Set<string>();

  const files = plugin.app.vault.getMarkdownFiles();
  const idsFinding = files.map(async (file) => {
    let data = await plugin.app.vault.read(file);
    let anyChange = false;
    const idsInNote = data.match(FLASHCARD_LINK_REGEX);
    if (idsInNote) {
      idsInNote.forEach((textId) => {
        const id = textId.substring(2, 8);
        noteIds.add(id);
        if (!flashcardIds.has(id)) {
          anyChange = true;
          data = data.replace(textId, "");
        }
      });
    }
    if (anyChange) {
      await plugin.app.vault.modify(file, data);
    }
  });

  await Promise.all(idsFinding);
  const newFlashcards = flashcards.filter((card) => noteIds.has(card.id));
  useFlashcardStore.setState({ flashcards: newFlashcards });
}

export async function createBackup() {
  const { plugin, dataFile } = usePluginStore.getState();
  const contents = await plugin.app.vault.read(dataFile);

  const backupFileName = `flashcards-backup-${new Date().toISOString().replace(/:/g, "-").replace("T", "_")}.json`;
  const backupFilePath = `${BASE_PATH}/${backupFileName}`;
  await plugin.app.vault.create(backupFilePath, contents);
}

const newId = customAlphabet('6ncT34ia5NdpCkxsbMHASheF2J9ryP8LtBguIv0lzqW7KDYVfjRmZGEQXow1UO', 6);

type FlashcardStoreState = {
  flashcards: RawFlashcard[];
  createFlashcard: (filePath: string) => Promise<RawFlashcard>;
  updateFlashcard: (card: Partial<RawFlashcard>) => void;
  deleteFlashcard: (id: string) => void;
}

export const useFlashcardStore = create<FlashcardStoreState>()(persist((set) => {
  const pluginState = usePluginStore.getState();
  if (!pluginState.plugin) {
    throw new Error("Flashcard store called before pluginState set");
  }

  return ({
    flashcards: [],
    createFlashcard: async (filePath) => {
      const newCard: RawFlashcard = {
        id: newId(),
        text: "",
        extra: "",
        filePath: filePath,
      }
      set((state) => ({ flashcards: [...state.flashcards, newCard] }));
      return newCard;
    },
    updateFlashcard: (card) => {
      set((state) => ({
        flashcards: state.flashcards.map((c) => {
          if (c.id === card.id) {
            return { ...c, ...card };
          }
          return c;
        }),
      }));
    },
    deleteFlashcard: (id: string) => {
      set((state) => ({
        flashcards: state.flashcards.filter((card) => card.id !== id),
      }));
    }
  })
}, {
  name: 'flashcard-store',
  skipHydration: true,
  storage: {
    async getItem(name) {
      try {
        const data = await getStorageData();
        return data ? data[name] || null : null;
      } catch (error) {
        console.error("Failed to get item:", error);
        return null;
      }
    },
    async setItem(name, value) {
      try {
        const data = await getStorageData() || {};
        data[name] = value;
        await saveStorageData(data);
      } catch (error) {
        console.error("Failed to set item:", error);
      }
    },
    async removeItem(name) {
      try {
        const data = await getStorageData();
        if (!data) return;
        delete data[name];
        await saveStorageData(data);
      } catch (error) {
        console.error("Failed to remove item:", error);
      }
    },
  }
}));

async function getStorageData() {
  const { plugin, dataFile } = usePluginStore.getState();
  const contents = await plugin.app.vault.read(dataFile);
  return JSON.parse(contents);
}

async function saveStorageData(data: unknown) {
  const { plugin, dataFile } = usePluginStore.getState();
  await plugin.app.vault.modify(dataFile, JSON.stringify(data, null, 2));
}
