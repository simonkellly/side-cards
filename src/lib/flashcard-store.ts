import { customAlphabet } from 'nanoid';
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { usePluginStore } from './plugin-store';

export type RawFlashcard = {
  id: string;
  text: string;
  extra: string;
  filePath: string;
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

  return result;
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
        text: "Question here?\n{{c1::Answer}}",
        extra: "Extra info here",
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
  // TODO: Persist to disk
  name: 'flashcard-store',
}));
