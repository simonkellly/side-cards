import * as csvWriter from 'csv-writer';
import { marked } from 'marked';
import { FlashcardData } from './types';

// Define the structure for card data
interface CardData {
  Text: string;
  Back: string;
  Extra: string;
  Topic: string;
  RefID: string;
  Tags: string;
}

/**
 * Converts markdown text to HTML, preserving Anki cloze deletion syntax
 * @param markdown Markdown text that may contain Anki cloze deletions
 * @returns HTML with preserved cloze deletion syntax
 */
async function markdownToHtml(markdown: string): Promise<string> {
  if (!markdown) return '';

  return await marked.parse(markdown);
}

/**
 * Exports flashcards to Anki-compatible CSV format
 * @param cards Array of flashcard objects
 * @param outputPath Optional path to save the CSV file
 * @returns CSV string data
 */
export async function exportToAnki(cards: FlashcardData[]): Promise<string> {
  marked.use({
    gfm: true,
    breaks: true,
    tokenizer: {
      lheading(src) {
        // Return false or undefined to indicate this rule didn't match
        return undefined;
      }
    },
    extensions: null,
  });

  const cardData: CardData[] = await Promise.all(cards.map(async card => {
    // Check if the card has cloze deletions (assuming they're marked with {{c1::text}} format)
    const hasCloze = card.content.includes('{{c') && card.content.includes('}}');

    // Split content by dividers (assuming dividers are represented by "---" or similar)
    const splits = card.content.split(/-{3,}/);
    const text = await markdownToHtml(splits[0].trim());
    const back = hasCloze ? "" : (await markdownToHtml(splits[1].trim()));
    const extra = hasCloze ? await markdownToHtml(splits.slice(1).join('---')) : await markdownToHtml(splits.slice(2).join('---'));

    // Create the card data object with all required fields
    return {
      RefID: card.id,
      Text: text,
      Back: back,
      Extra: extra,
      Topic: card.relatedNotePath?.replace('.md', "") || '',
      Tags: card.relatedNotePath?.replace(".md", "").split(" ").join("_").split('/').join('::') || '',
    } as CardData;
  }));

  console.table(cardData);

  // Generate CSV using csv-writer
  const createCsvWriter = csvWriter.createObjectCsvStringifier;
  const csvStringifier = createCsvWriter({
    header: [
      { id: 'RefID', title: 'RefID' },
      { id: 'Text', title: 'Text' },
      { id: 'Back', title: 'Back' },
      { id: 'Extra', title: 'Extra' },
      { id: 'Topic', title: 'Topic' },
      { id: 'Tags', title: 'Tags' },
    ],
    fieldDelimiter: ';',
  });

  const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(cardData);

  // Create a file from the CSV data
  const file = new File([csv], 'anki_cards.csv', { type: 'text/csv' });

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'anki_cards.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return csv;
}
