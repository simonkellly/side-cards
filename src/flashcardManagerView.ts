import { ItemView, WorkspaceLeaf, TFile, Notice, ButtonComponent, setIcon } from 'obsidian';
import { FlashcardManager } from './flashcardManager';
import FlashcardPlugin from './main';
import { exportToAnki } from './ankiExporter';

export const FLASHCARD_MANAGER_VIEW_TYPE = 'flashcard-manager-view';

export class FlashcardManagerView extends ItemView {
  private flashcardManager: FlashcardManager;
  private sortOrder: 'date' | 'alphabetical' = 'date';
  public containerEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: FlashcardPlugin) {
    super(leaf);
    this.flashcardManager = plugin.flashcardManager;
  }

  getViewType(): string {
    return FLASHCARD_MANAGER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Flashcard Manager';
  }

  getIcon(): string {
    return 'cards';
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass('flashcard-manager-view');

    const header = this.containerEl.createDiv('flashcard-manager-header');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '8px';
    header.style.borderBottom = '1px solid var(--background-modifier-border)';

    // Left section - Sort controls
    const leftSection = header.createDiv('header-section left-section');
    leftSection.style.display = 'flex';
    leftSection.style.gap = '8px';
    const sortControls = leftSection.createDiv('sort-controls');
    sortControls.style.display = 'flex';
    sortControls.style.gap = '4px';

    // Sort by Date button
    const dateButton = new ButtonComponent(sortControls)
      .setButtonText('Sort by Date')
      .setClass('sort-button')
      .onClick(() => {
        this.sortOrder = 'date';
        this.refreshView();
      });
    setIcon(dateButton.buttonEl, 'calendar');

    // Sort Alphabetically button
    const alphaButton = new ButtonComponent(sortControls)
      .setButtonText('Sort Alphabetically')
      .setClass('sort-button')
      .onClick(() => {
        this.sortOrder = 'alphabetical';
        this.refreshView();
      });
    setIcon(alphaButton.buttonEl, 'sort-asc');

    // Center section - Export and Refresh
    const centerSection = header.createDiv('header-section center-section');
    centerSection.style.display = 'flex';
    centerSection.style.justifyContent = 'center';
    centerSection.style.flex = '1';

    // Create a button container with flex layout
    const buttonContainer = centerSection.createDiv('btn-container');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'center';

    // Export button
    const exportButton = new ButtonComponent(buttonContainer)
      .setButtonText('Export Flashcards')
      .setClass('export-button')
      .onClick(async () => {
        try {
          const flashcards = await this.flashcardManager.getAllFlashcards();
          await exportToAnki(flashcards);
          new Notice('Flashcards exported to Anki successfully!');
        } catch (error) {
          new Notice(`Export failed: ${error.message}`);
        }
      });
    exportButton.buttonEl.title = 'Export all flashcards to Anki';
    setIcon(exportButton.buttonEl, 'download');

    // Refresh button
    const refreshButton = new ButtonComponent(buttonContainer)
      .setButtonText('Refresh')
      .setClass('refresh-button')
      .onClick(async () => {
        await this.refreshView();
        new Notice('Flashcard view refreshed');
      });
    refreshButton.buttonEl.title = 'Refresh the flashcard view';
    setIcon(refreshButton.buttonEl, 'refresh-cw');

    // Right section - Delete Unreferenced
    const rightSection = header.createDiv('header-section right-section');
    rightSection.style.display = 'flex';
    rightSection.style.justifyContent = 'flex-end';

    // Delete Unreferenced button
    const deleteButton = new ButtonComponent(rightSection)
      .setButtonText('Delete Unreferenced')
      .setClass('delete-unreferenced-button')
      .onClick(async () => {
        const count = await this.flashcardManager.deleteUnreferencedFlashcards();
        new Notice(`Deleted ${count} unreferenced flashcards`);
        await this.refreshView();
      });
    deleteButton.buttonEl.title = 'Delete flashcards that are no longer referenced in any notes';
    setIcon(deleteButton.buttonEl, 'trash');

    this.containerEl.createDiv('flashcard-manager-content');
    await this.refreshView();
  }

  async refreshView(): Promise<void> {
    const content = this.containerEl.querySelector('.flashcard-manager-content');
    if (!content) return;

    content.empty();

    const flashcards = await this.flashcardManager.getAllFlashcards();

    const sortedFlashcards = [...flashcards].sort((a, b) => {
      if (this.sortOrder === 'date') {
        return (Number(b.created) - Number(a.created));
      } else {
        return a.content.localeCompare(b.content);
      }
    });

    const list = content.createEl('ul', 'flashcard-list');

    for (const flashcard of sortedFlashcards) {
      const item = list.createEl('li', 'flashcard-item');

      // Card wrapper for better styling
      const cardWrapper = item.createDiv('flashcard-card-wrapper');

      // Content section
      const contentDiv = cardWrapper.createDiv('flashcard-content');
      contentDiv.createEl('div', { text: flashcard.content, cls: 'flashcard-text' });

      // Metadata footer
      const metadata = cardWrapper.createDiv('flashcard-metadata');

      // Create a left section for date and source
      const metadataInfo = metadata.createDiv('flashcard-metadata-info');

      // Date with icon
      const dateDiv = metadataInfo.createDiv('flashcard-date');
      setIcon(dateDiv.createSpan('flashcard-icon'), 'calendar');
      dateDiv.createSpan({ text: new Date(flashcard.created ?? '').toLocaleDateString(), cls: 'flashcard-date-text' });

      // Source file link
      const sourceFile = this.app.vault.getAbstractFileByPath(flashcard.relatedNotePath ?? '');
      if (sourceFile instanceof TFile) {
        const sourceLink = metadataInfo.createEl('a', { cls: 'flashcard-source' });
        setIcon(sourceLink.createSpan('flashcard-icon'), 'file');
        sourceLink.createSpan({ text: sourceFile.basename, cls: 'flashcard-source-text' });
        sourceLink.addEventListener('click', () => {
          this.app.workspace.getLeaf().openFile(sourceFile);
        });
      }

      // Create a right section for actions/buttons
      const metadataActions = metadata.createDiv('flashcard-metadata-actions');

      // Add delete button
      const deleteButton = new ButtonComponent(metadataActions)
        .setClass('button-delete')
        .onClick(async () => {
          await this.flashcardManager.deleteFlashcard(flashcard.id);
          await this.refreshView();
        });
      deleteButton.buttonEl.title = 'Delete this flashcard';
      setIcon(deleteButton.buttonEl, 'trash');
    }
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }
}