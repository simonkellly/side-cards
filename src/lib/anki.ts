import * as csvWriter from 'csv-writer';
import { RawFlashcard, useFlashcardStore } from "./flashcard-store";
import { YankiConnect } from 'yanki-connect';
import { usePluginStore } from './plugin-store';
import { BASE_PATH } from '@/constants';
import { TFile } from 'obsidian';
import { cp } from 'fs/promises';

const NOTE_TYPE_MARKER = "#notetype:Obsidian\n";
const OBSIDIAN_PREFIX = 'obsidian_';

interface CardData {
  Text: string;
  Extra: string;
  Topic: string;
  RefID: string;
  Tags: string;
}

function replaceImageText(text: string) {
  return text.replace(/!\[\[(.+?)\]\]/g, (match, p1: string) => {
    const file = p1.split('/').pop();
    return `<img src="${OBSIDIAN_PREFIX}${file}" />`;
  });
}

function processFlashcard(rawFlashcard: RawFlashcard) {
  const result = {
    RefID: rawFlashcard.id,
    Text: rawFlashcard.text,
    Extra: rawFlashcard.extra,
    Topic: rawFlashcard.filePath,
    Tags: '#Obsidian::' + rawFlashcard.filePath.replaceAll(' ', '_').replace('.md', '').replaceAll('/', '::'),  
  } satisfies CardData;

  result.Text = result.Text.replace(/\n/g, '<br />').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  result.Extra = result.Extra.replace(/\n/g, '<br />').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  result.Text = replaceImageText(result.Text);
  result.Extra = replaceImageText(result.Extra);
  return result;
}

function generateCsvContent(flashcards: RawFlashcard[]): string {
  const createCsvWriter = csvWriter.createObjectCsvStringifier;
  const csvStringifier = createCsvWriter({
    header: [
      { id: 'RefID', title: 'RefID' },
      { id: 'Text', title: 'Text' },
      { id: 'Extra', title: 'Extra' },
      { id: 'Topic', title: 'Topic' },
      { id: 'Tags', title: 'Tags' },
    ],
    fieldDelimiter: ';',
  });

  return NOTE_TYPE_MARKER + csvStringifier.stringifyRecords(flashcards.map(card => processFlashcard(card)));
}

export async function exportToAnkiConnect() {
  const plugin = usePluginStore.getState().plugin;
  const client = new YankiConnect({});

  const folder = plugin.app.vault.getFolderByPath(BASE_PATH);
  const allowedExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

  const mediaPath = await client.media.getMediaDirPath();
  const mediaFiles = await client.media.getMediaFilesNames({
    pattern: `${OBSIDIAN_PREFIX}*`,
  });

  console.log('Media files:', mediaFiles);

  const copies = folder?.children.filter(file => file instanceof TFile).map(async file => {
    if (!allowedExtensions.has(file.extension.toLocaleLowerCase())) return;

    console.log('File:', file.name);
    if (mediaFiles.includes(`${OBSIDIAN_PREFIX}${file.name}`)) return;

    return cp(plugin.app.vault.adapter.basePath + "/" + file.path, mediaPath + `/${OBSIDIAN_PREFIX}${file.name}`);
  });

  await Promise.all(copies?.filter((folder) => folder) || []);

  await downloadAnkiCSVLocal();

  const basePath = plugin.app.vault.adapter.basePath + '/' + BASE_PATH + '/anki_cards.csv';

  client.graphical.guiImportFile({ path: basePath });
}

export async function downloadAnkiCSVLocal() {
  const flashcards = useFlashcardStore.getState().flashcards;
  if (!flashcards || flashcards.length === 0) return;

  const csv = generateCsvContent(flashcards);
  const plugin = usePluginStore.getState().plugin;
  const file = plugin.app.vault.getFileByPath(BASE_PATH + '/anki_cards.csv');
  if (file) {
    await plugin.app.vault.modify(file, csv);
    return;
  }
  await plugin.app.vault.create(BASE_PATH + '/anki_cards.csv', csv);
}

export function downloadAnkiCSV() {
  const flashcards = useFlashcardStore.getState().flashcards;
  if (!flashcards || flashcards.length === 0) return;

  const csv = generateCsvContent(flashcards);

  const file = new File([csv], 'anki_cards.csv', { type: 'text/csv' });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anki_cards.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}