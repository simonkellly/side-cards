import { TFile, Notice, TFolder } from 'obsidian';
import FlashcardPlugin from './main';
import { FLASHCARD_LINK_REGEX } from './constants';
import { customAlphabet } from 'nanoid';
import { FlashcardData } from './types';

export class FlashcardManager {
  private plugin: FlashcardPlugin;
  private activeEditors: Map<string, { file: TFile, content: string }> = new Map();

  constructor(plugin: FlashcardPlugin) {
    this.plugin = plugin;
  }

  async ensureFlashcardFolderExists(): Promise<void> {
    const folderPath = this.plugin.settings.flashcardFolderName;
    try {
      const folderExists = await this.plugin.app.vault.adapter.exists(folderPath);
      if (!folderExists) {
        await this.plugin.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      console.error('Error ensuring flashcard folder exists:', error);
      new Notice('Failed to create flashcard folder');
    }
  }

  async createFlashcard(content: string, relatedNotePath?: string): Promise<string> {
    const id = this.generateUniqueId();
    const flashcardData: FlashcardData = {
      id,
      content,
      created: new Date().toISOString(),
      relatedNotePath
    };

    const flashcardPath = `${this.plugin.settings.flashcardFolderName}/${id}.json`;
    try {
      await this.plugin.app.vault.create(flashcardPath, JSON.stringify(flashcardData, null, 2));
      return id;
    } catch (error) {
      console.error('Error creating flashcard:', error);
      throw new Error('Failed to create flashcard');
    }
  }

  async updateFlashcard(id: string, content: string): Promise<void> {
    const flashcardPath = `${this.plugin.settings.flashcardFolderName}/${id}.json`;
    const file = this.plugin.app.vault.getAbstractFileByPath(flashcardPath);

    if (!(file instanceof TFile)) {
      throw new Error(`Flashcard ${id} not found`);
    }

    try {
      const currentData = JSON.parse(await this.plugin.app.vault.cachedRead(file));
      const updatedData: FlashcardData = {
        ...currentData,
        content
      };
      await this.plugin.app.vault.modify(file, JSON.stringify(updatedData, null, 2));
    } catch (error) {
      console.error('Error updating flashcard:', error);
      throw new Error('Failed to update flashcard');
    }
  }

  async deleteFlashcard(id: string): Promise<void> {
    const flashcardPath = `${this.plugin.settings.flashcardFolderName}/${id}.json`;
    const file = this.plugin.app.vault.getAbstractFileByPath(flashcardPath);

    if (!(file instanceof TFile)) {
      throw new Error(`Flashcard ${id} not found`);
    }

    try {
      // First remove references to this flashcard in all notes
      await this.removeFlashcardReferencesFromNotes(id);

      // Then delete the flashcard file
      await this.plugin.app.vault.delete(file);
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      throw new Error('Failed to delete flashcard');
    }
  }

  private async removeFlashcardReferencesFromNotes(flashcardId: string): Promise<void> {
    const markdownFiles = this.plugin.app.vault.getMarkdownFiles();

    for (const file of markdownFiles) {
      const content = await this.plugin.app.vault.read(file);

      // Skip files that don't contain the ID (for optimization)
      if (!content.includes(flashcardId)) continue;

      // Find all flashcard references in the file
      const regex = new RegExp(FLASHCARD_LINK_REGEX, 'g');
      let match;
      let updatedContent = content;
      let modified = false;

      // We'll collect matches first to avoid modification during iteration
      const matches = [];
      while ((match = regex.exec(content)) !== null) {
        if (match[1] === flashcardId) {
          matches.push({
            fullMatch: match[0],
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }

      // Remove matches in reverse order to maintain correct indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const { start, end } = matches[i];
        updatedContent = updatedContent.substring(0, start) + updatedContent.substring(end);
        modified = true;
      }

      // Only update if we made changes
      if (modified) {
        await this.plugin.app.vault.modify(file, updatedContent);
      }
    }
  }

  async getFlashcard(id: string): Promise<FlashcardData | null> {
    const flashcardPath = `${this.plugin.settings.flashcardFolderName}/${id}.json`;
    const file = this.plugin.app.vault.getAbstractFileByPath(flashcardPath);

    if (!(file instanceof TFile)) {
      return null;
    }

    try {
      const content = await this.plugin.app.vault.cachedRead(file);
      return JSON.parse(content) as FlashcardData;
    } catch (error) {
      console.error('Error reading flashcard:', error);
      return null;
    }
  }

  extractFlashcardIds(content: string): Set<string> {
    const ids = new Set<string>();
    let match;
    const regex = new RegExp(FLASHCARD_LINK_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        ids.add(match[1]);
      }
    }
    return ids;
  }

  private generateUniqueId(): string {
    return customAlphabet('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 6)();
  }

  setEditorState(id: string, file: TFile, content: string): void {
    this.activeEditors.set(id, { file, content });
  }

  getEditorState(id: string): { file: TFile, content: string } | undefined {
    return this.activeEditors.get(id);
  }

  clearEditorState(id?: string): void {
    if (id) {
      this.activeEditors.delete(id);
    } else {
      this.activeEditors.clear();
    }
  }

  async getAllFlashcards(): Promise<FlashcardData[]> {
    const folder = this.plugin.app.vault.getAbstractFileByPath(this.plugin.settings.flashcardFolderName);
    if (!(folder instanceof TFolder)) return [];

    const files = folder.children.filter((file): file is TFile => file instanceof TFile);
    const flashcards: FlashcardData[] = [];

    for (const file of files) {
      const content = await this.plugin.app.vault.read(file);
      const flashcard = JSON.parse(content) as FlashcardData;
      flashcards.push(flashcard);
    }

    return flashcards;
  }

  async findUnreferencedFlashcards(): Promise<FlashcardData[]> {
    const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
    const referencedIds = new Set<string>();

    for (const file of markdownFiles) {
      const content = await this.plugin.app.vault.cachedRead(file);
      const ids = this.extractFlashcardIds(content);
      ids.forEach(id => referencedIds.add(id));
    }

    const allFlashcards = await this.getAllFlashcards();
    return allFlashcards.filter(flashcard => !referencedIds.has(flashcard.id));
  }

  async deleteUnreferencedFlashcards(): Promise<number> {
    const unreferenced = await this.findUnreferencedFlashcards();
    let deletedCount = 0;

    for (const flashcard of unreferenced) {
      try {
        await this.deleteFlashcard(flashcard.id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting unreferenced flashcard ${flashcard.id}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Uploads an image to the flashcards/images folder and returns the path for markdown linking
   */
  async uploadImage(file: ArrayBuffer, filename: string): Promise<{ imagePath: string, imageFilename: string }> {
    // Create images subfolder if it doesn't exist
    const imagesFolder = `${this.plugin.settings.flashcardFolderName}/images`;
    try {
      const folderExists = await this.plugin.app.vault.adapter.exists(imagesFolder);
      if (!folderExists) {
        await this.plugin.app.vault.createFolder(imagesFolder);
      }
    } catch (error) {
      console.error('Error ensuring images folder exists:', error);
      throw new Error('Failed to create images folder');
    }

    // Generate unique ID for the image
    const imageId = this.generateUniqueId();

    // Get file extension from original filename
    const extension = filename.split('.').pop()?.toLowerCase() || 'png';

    // Create path for the image
    const imagePath = `${imagesFolder}/${imageId}.${extension}`;

    try {
      // Create the file in the vault
      await this.plugin.app.vault.createBinary(imagePath, file);

      // Return the path (for markdown linking)
      return {
        imagePath: imagePath,
        imageFilename: `${imageId}.${extension}`
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  }
}