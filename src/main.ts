// src/main.ts
import { Editor, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, MarkdownPostProcessorContext, TFolder } from 'obsidian';
import { FlashcardView } from './view'; // Import the custom view
import { FLASHCARD_VIEW_TYPE, DEFAULT_FLASHCARD_FOLDER, FLASHCARD_LINK_REGEX, FLASHCARD_VIEW_ICON } from './constants';
import { createFlashcardLinkExtension } from './editorExtension'; // *** IMPORT THE EXTENSION ***
import { FlashcardManager } from './flashcardManager';
import { FlashcardManagerView, FLASHCARD_MANAGER_VIEW_TYPE } from './flashcardManagerView';

// --- Interfaces ---
interface FlashcardPluginSettings {
  flashcardFolderName: string;
}

const DEFAULT_SETTINGS: FlashcardPluginSettings = {
  flashcardFolderName: DEFAULT_FLASHCARD_FOLDER,
}

// --- Main Plugin Class ---
export default class FlashcardPlugin extends Plugin {
  settings: FlashcardPluginSettings;
  flashcardView: FlashcardView | null = null; // Keep a reference if needed
  flashcardManager: FlashcardManager;

  async onload() {
    await this.loadSettings();
    this.flashcardManager = new FlashcardManager(this);

    this.registerView(
      FLASHCARD_VIEW_TYPE,
      (leaf) => {
        this.flashcardView = new FlashcardView(leaf, this);
        return this.flashcardView;
      }
    );

    this.registerView(
      FLASHCARD_MANAGER_VIEW_TYPE,
      (leaf) => new FlashcardManagerView(leaf, this)
    );

    this.addCommand({
      id: 'open-flashcard-manager',
      name: 'Open Flashcard Manager',
      callback: () => {
        this.activateFlashcardManagerView();
      }
    });

    this.addRibbonIcon('cards', 'Open Flashcard Manager', () => {
      this.activateFlashcardManagerView();
    });

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          const file = leaf.view.file;
          this.updateFlashcardViews(file);
        }
      })
    );

    this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      );

      const textNodes: Node[] = [];
      let node: Node | null;
      while ((node = walker.nextNode()) !== null) {
        if (node.textContent?.includes('&')) {
          textNodes.push(node);
        }
      }

      for (const node of textNodes) {
        const text = node.textContent;
        if (!text) continue;

        const temp = document.createElement('span');
        let lastIndex = 0;
        let match;

        const regex = new RegExp(FLASHCARD_LINK_REGEX);
        while ((match = regex.exec(text)) !== null) {
          const id = match[1];
          const start = match.index;
          const end = start + match[0].length;

          if (start > lastIndex) {
            temp.appendChild(document.createTextNode(text.substring(lastIndex, start)));
          }

          const link = document.createElement('a');
          link.textContent = '⚡';
          link.className = 'tag';
          link.setAttribute('data-flashcard-id', id);
          link.setAttribute('href', '#');

          link.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            this.handleFlashcardLinkClick(id);
          });

          temp.appendChild(link);
          lastIndex = end;
        }

        if (lastIndex < text.length) {
          temp.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        node.parentNode?.replaceChild(temp, node);
      }
    });

    this.registerEditorExtension(createFlashcardLinkExtension(this));

    this.addRibbonIcon(FLASHCARD_VIEW_ICON, 'Toggle Flashcard Panel', async () => {
      await this.activateFlashcardManagerView();
    });

    this.addCommand({
      id: 'toggle-flashcard-panel',
      name: 'Toggle Flashcard Panel',
      callback: async () => {
        await this.toggleFlashcardView();
      },
    });

    this.addCommand({
      id: 'create-flashcard',
      name: 'Create New Flashcard',
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        if (!view.file) {
          new Notice("Cannot create flashcard: No active note file.");
          return;
        }
        await this.createFlashcard(editor, view.file);
      },
    });

    await this.flashcardManager.ensureFlashcardFolderExists();

    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.updateFlashcardViews(activeFile);
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(FLASHCARD_VIEW_TYPE);
  }

  async ensureFlashcardFolderExists() {
    const folderPath = this.settings.flashcardFolderName;
    try {
      const folderExists = await this.app.vault.adapter.exists(folderPath);
      if (!folderExists) {
        await this.app.vault.createFolder(folderPath);
      }
    } catch (error) {
      try {
        const item = this.app.vault.getAbstractFileByPath(folderPath);
        if (item && !(item instanceof TFolder)) {
          new Notice(`Error: Path ${folderPath} exists but is not a folder. Please resolve this.`);
        } else if (!item) {
          new Notice(`Error creating flashcard folder: ${folderPath}. Check permissions or path.`);
        }
      } catch (e) {
        new Notice(`Error accessing path ${folderPath}.`);
      }
    }
  }

  async createFlashcard(editor: Editor, currentNoteFile: TFile): Promise<void> {
    try {
      const content = editor.getSelection() || editor.getLine(editor.getCursor().line);
      const flashcardContent = content.trim() || "Question\n---\nAnswer";

      const id = await this.flashcardManager.createFlashcard(flashcardContent, currentNoteFile.path);
      const flashcardLink = ` &${id}`;

      const cursor = editor.getCursor();
      editor.wordAt(cursor);
      editor.replaceRange(flashcardLink, cursor, { line: cursor.line, ch: cursor.ch  });

      new Notice("Flashcard created successfully!");
      await this.activateFlashcardView();
    } catch (error) {
      new Notice("Failed to create flashcard. See console for details.");
      console.error("Error creating flashcard:", error);
    }
  }

  async handleFlashcardLinkClick(flashcardId: string): Promise<void> {
    try {
      await this.activateFlashcardView();
      const flashcardView = this.getFlashcardViewInstance();
      if (flashcardView) {
        flashcardView.focusFlashcard(flashcardId);
      }
    } catch (error) {
      console.error('Error handling flashcard link click:', error);
      new Notice("Failed to open flashcard");
    }
  }

  async activateFlashcardView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(FLASHCARD_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        leaf = workspace.getLeaf(true);
        console.warn("No right leaf found, creating flashcard view in new leaf.");
      }
      if (!leaf) {
        console.error("Could not get or create leaf for flashcard view.");
        new Notice("Failed to open flashcard panel.");
        return;
      }

      await leaf.setViewState({
        type: FLASHCARD_VIEW_TYPE,
        active: true,
      });
    }
  }

  async toggleFlashcardView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(FLASHCARD_VIEW_TYPE);

    if (leaves.length > 0) {
      leaves.forEach(leaf => leaf.detach());
      this.flashcardView = null;
    } else {
      await this.activateFlashcardView();
    }
  }

  getFlashcardViewInstance(): FlashcardView | null {
    const leaves = this.app.workspace.getLeavesOfType(FLASHCARD_VIEW_TYPE);
    if (leaves.length > 0) {
      const view = leaves[0].view;
      if (view instanceof FlashcardView) {
        this.flashcardView = view;
        return view;
      }
    }
    this.flashcardView = null;
    return null;
  }

  updateFlashcardViews(file: TFile | null) {
    this.refreshFlashcardViews(file);
  }

  async refreshFlashcardViews(file: TFile | null): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(FLASHCARD_VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view instanceof FlashcardView) {
        await leaf.view.setActiveNote(file);
      }
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateFlashcardManagerView() {
    const { workspace } = this.app;
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({
      type: FLASHCARD_MANAGER_VIEW_TYPE,
      active: true,
    });
  }
}