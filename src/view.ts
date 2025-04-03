// src/view.ts
import { ItemView, WorkspaceLeaf, TFile, Notice, TextAreaComponent, ButtonComponent, Component } from "obsidian"; // Added MarkdownRenderer and Component
import { FLASHCARD_VIEW_TYPE, FLASHCARD_VIEW_ICON } from "./constants";
import FlashcardPlugin from "./main"; // Import the main plugin class type
import { marked } from "marked";
import { FlashcardData } from "./types";

/**
 * Represents the view that displays flashcards associated with the active note.
 */
export class FlashcardView extends ItemView {
  plugin: FlashcardPlugin;
  currentNoteFile: TFile | null = null;
  // Track active editors: key is flashcard ID, value is an object containing the container and the file
  activeEditors: Map<string, { container: HTMLElement, file: TFile, editorComponent: TextAreaComponent | null }> = new Map();
  // Component lifecycle management for Markdown rendering
  private viewComponent: Component;
  private updateTimeout: number | null = null;
  private isUpdating = false;
  // File input element for image uploads
  private fileInput: HTMLInputElement | null = null;
  // Current editor being used for image upload
  private activeImageUploadEditor: { editorComponent: TextAreaComponent, cardId: string } | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: FlashcardPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.containerEl.addClass('flashcard-pane');
    // Create a component for managing child components like MarkdownRenderer
    this.viewComponent = new Component();
    this.viewComponent.load(); // Load the component immediately

    // Create hidden file input for image uploads
    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.style.display = 'none';
    this.fileInput.addEventListener('change', this.handleFileSelection.bind(this));
    document.body.appendChild(this.fileInput);
  }

  getViewType(): string {
    return FLASHCARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Flashcards"; // Updated display text
  }

  getIcon(): string {
    return FLASHCARD_VIEW_ICON;
  }

  async onOpen() {
    // Check for an active note when the view is first opened
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.setActiveNote(activeFile);
    }
  }

  async onClose() {
    // Clear any pending updates
    if (this.updateTimeout !== null) {
      window.clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }
    this.contentEl.empty();
    this.cancelAllEditors(); // Ensure editors are cleaned up
    this.activeEditors.clear();
    // Unload the component to clean up Obsidian resources like MarkdownRenderers
    this.viewComponent.unload();

    // Clean up file input
    if (this.fileInput) {
      this.fileInput.remove();
      this.fileInput = null;
    }
  }

  async setActiveNote(file: TFile | null) {
    if (this.currentNoteFile?.path !== file?.path) {
      this.plugin.flashcardManager.clearEditorState();
    }
    this.currentNoteFile = file;
    await this.scheduleUpdate();
  }

  private async scheduleUpdate() {
    // Clear any pending update
    if (this.updateTimeout !== null) {
      window.clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    // If already updating, schedule another update for after the current one completes
    if (this.isUpdating) {
      this.updateTimeout = window.setTimeout(() => this.scheduleUpdate(), 100);
      return;
    }

    this.isUpdating = true;
    try {
      await this.updateViewDisplay();
    } finally {
      this.isUpdating = false;
      // If there's a pending update, execute it now
      if (this.updateTimeout !== null) {
        this.updateTimeout = null;
        window.setTimeout(() => this.scheduleUpdate(), 0);
      }
    }
  }

  /**
   * Core function to update the content of the view based on the currentNoteFile.
   */
  async updateViewDisplay() {
    // 1. Clear everything first
    this.clearView();

    if (!this.currentNoteFile) {
      this.contentEl.setText("Open a note to see its flashcards.");
      return;
    }

    try {
      // Force a refresh of the note content instead of using cachedRead
      const noteContent = await this.app.vault.read(this.currentNoteFile);
      const flashcardIds = this.plugin.flashcardManager.extractFlashcardIds(noteContent);

      if (flashcardIds.size === 0) {
        this.contentEl.createEl('p', { text: "No flashcards linked in this note." });
        return;
      }

      // 3. Create title container
      const titleContainer = this.contentEl.createDiv({ cls: "flashcard-title-container" });
      titleContainer.style.display = "flex";
      titleContainer.style.justifyContent = "space-between";
      titleContainer.style.alignItems = "center";
      titleContainer.style.marginBottom = "10px";

      const text = titleContainer.createEl("h4", {
        text: `Flashcards for: ${this.currentNoteFile.basename}`
      });
      text.style.margin = "auto 0";
      text.style.paddingBottom = "0";
      text.style.borderBottom = "none";

      const refreshButton = titleContainer.createEl("button", {
        cls: "flashcard-refresh-button",
        attr: {
          'aria-label': 'Refresh flashcards',
          'title': 'Refresh flashcards'
        }
      });
      refreshButton.innerHTML = '↻';
      refreshButton.addEventListener('click', async () => {
        await this.refreshFlashcards();
      });

      // 4. Create flashcard list container
      const flashcardListEl = this.contentEl.createDiv("flashcard-list");
      let foundFlashcards = 0;

      // 5. Render each flashcard
      for (const id of flashcardIds) {
        const flashcardPath = `${this.plugin.settings.flashcardFolderName}/${id}.json`;
        const flashcardFile = this.app.vault.getAbstractFileByPath(flashcardPath);

        if (flashcardFile instanceof TFile) {
          foundFlashcards++;
          const editorState = this.plugin.flashcardManager.getEditorState(id);
          if (editorState) {
            await this.renderFlashcardEdit(flashcardListEl, flashcardFile, id, editorState.content);
          } else {
            await this.renderFlashcardDisplay(flashcardListEl, flashcardFile, id);
          }
        } else {
          console.warn(`Flashcard JSON file not found for ID: ${id} at path: ${flashcardPath}`);
          const cardEl = flashcardListEl.createDiv("flashcard-card missing");
          cardEl.dataset.flashcardId = id;
          cardEl.createEl('strong', { text: `Missing Flashcard: ${id}` });
          cardEl.createEl('p', { text: `Expected at: ${flashcardPath}` });
        }
      }

      if (foundFlashcards === 0 && flashcardIds.size > 0) {
        flashcardListEl.createEl('p', { text: 'Linked flashcard files (.json) could not be found in the flashcards folder.' });
      }
    } catch (error) {
      console.error("Error updating flashcard view:", error);
      new Notice("Failed to update flashcard view.");
      this.contentEl.setText("Error loading flashcards.");
    }
  }

  /**
   * Clears the entire view, including all editors and components
   */
  private clearView() {
    // Clear the container
    this.contentEl.empty();

    // Cancel all editors
    this.cancelAllEditors(undefined, false);

    // Clear the active editors map
    this.activeEditors.clear();

    // Reset the view component
    this.viewComponent.unload();
    this.viewComponent = new Component();
    this.viewComponent.load();
  }

  /**
   * Renders the display state of a single flashcard from its JSON data.
   * @param listContainerEl The parent list element where cards are placed.
   * @param file The TFile object representing the flashcard JSON file.
   * @param id The ID of the flashcard.
   */
  async renderFlashcardDisplay(listContainerEl: HTMLElement, file: TFile, id: string) {
    const editorState = this.plugin.flashcardManager.getEditorState(id);
    if (editorState) return;

    marked.use({
      gfm: true,
      breaks: true,
      tokenizer: {
        lheading(src) {
          // Return false or undefined to indicate this rule didn't match
          return undefined;
        }
      },
      extensions: [{
        name: 'cloze',
        level: 'inline',
        start(src) {
          return src.match(/\{\{c\d+::/)?.index;
        },
        tokenizer(src) {
          const match = /^\{\{c\d+::(.*?)\}\}/.exec(src);
          if (match) {
            return {
              type: 'cloze',
              raw: match[0],
              text: match[1], // Capture content inside cloze deletion
            };
          }
          return undefined;
        },
        renderer(token) {
          return `<i>${token.text}</i>`; // Render as italic text instead of bold
        }
      }]
    });

    // Create or reset card element
    const cardEl = this.createOrResetCardElement(listContainerEl, id);

    try {
      const content = await this.app.vault.cachedRead(file);
      const flashcardData = JSON.parse(content) as FlashcardData;

      if (typeof flashcardData?.content !== 'string') {
        throw new Error(`Missing or invalid 'content' field in JSON for flashcard ${id}`);
      }

      // Position the card as relative for absolute positioning of the delete button
      cardEl.style.position = "relative";

      // Create a container for the delete button in the top-right
      const deleteButtonContainer = cardEl.createDiv('flashcard-delete-button-container');
      deleteButtonContainer.style.position = "absolute";
      deleteButtonContainer.style.top = "5px";
      deleteButtonContainer.style.right = "5px";
      deleteButtonContainer.style.zIndex = "10";

      // Create standard Obsidian button with trash icon
      new ButtonComponent(deleteButtonContainer)
        .setIcon("trash") // Use standard Obsidian trash icon
        .setTooltip("Delete flashcard")
        .setClass("clickable-icon")
        .setClass('view-action')
        .onClick(async (ev) => {
          ev.stopPropagation();
          if (confirm(`Are you sure you want to delete flashcard ${id}? This will remove all references to it in your notes.`)) {
            await this.deleteFlashcard(id, file);
          }
        });

      // Create content container
      const contentContainer = cardEl.createDiv('flashcard-content-display');

      // Render markdown content
      const html = await marked(flashcardData.content);
      contentContainer.innerHTML = html;

      // Process images in the content
      this.processImages(contentContainer, this.currentNoteFile?.path || '');

      // Setup the remaining card event listeners (excluding delete which we moved)
      this.setupCardEventListeners(cardEl, id, file, flashcardData.content);

    } catch (error) {
      console.error(`Error rendering flashcard display ${id}:`, error);
      cardEl.setText(`Error loading flashcard: ${id}`);
      cardEl.addClass('error');
      cardEl.onclick = null;
    }
  }

  /**
   * Creates a new card element or resets an existing one
   */
  private createOrResetCardElement(listContainerEl: HTMLElement, id: string): HTMLElement {
    let cardEl = listContainerEl.querySelector(`.flashcard-card[data-flashcard-id="${id}"]`) as HTMLElement;

    if (!cardEl) {
      cardEl = listContainerEl.createDiv({ cls: "flashcard-card", attr: { 'data-flashcard-id': id } });
    } else {
      cardEl.empty();
      cardEl.removeClass('error', 'missing', 'editing', 'flashcard-background');
      cardEl.addClass('flashcard-card');
    }

    cardEl.addClass('flashcard-background');
    cardEl.onclick = null;

    return cardEl;
  }

  /**
   * Sets up event listeners for a card element
   */
  private setupCardEventListeners(
    cardEl: HTMLElement,
    id: string,
    file: TFile,
    content: string,
    deleteButton?: HTMLElement // Made this parameter optional since we moved delete logic
  ) {
    // Only set up delete button listener if the button is provided
    // (We've moved this to the ButtonComponent onClick handler)
    if (deleteButton) {
      deleteButton.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (confirm(`Are you sure you want to delete flashcard ${id}? This will remove all references to it in your notes.`)) {
          await this.deleteFlashcard(id, file);
        }
      });
    }

    // Card click handler for edit mode
    cardEl.onclick = (ev) => {
      if (ev.target instanceof HTMLElement) {
        if (ev.target.closest('a, button, input, textarea, .internal-link, .task-list-item-checkbox')) {
          return;
        }
      }
      if (cardEl.classList.contains('editing')) {
        return;
      }
      const parent = cardEl.parentElement;
      if (parent) {
        this.renderFlashcardEdit(parent, file, id, content);
      }
    };
  }

  /**
   * Renders the edit state of a single flashcard within its card element.
   * @param listContainerEl The parent list element.
   * @param file The TFile object representing the flashcard JSON file.
   * @param id The ID of the flashcard.
   * @param initialContent Optional initial content for the editor (used when restoring editor state).
   */
  async renderFlashcardEdit(listContainerEl: HTMLElement, file: TFile, id: string, initialContent?: string) {
    // Find or create the card element
    let cardEl = listContainerEl.querySelector(`.flashcard-card[data-flashcard-id="${id}"]`) as HTMLElement;
    const isNewEditorInstance = !this.activeEditors.has(id); // Check if we're creating a new editor vs restoring

    if (!cardEl) {
      cardEl = listContainerEl.createDiv({ cls: "flashcard-card editing", attr: { 'data-flashcard-id': id } });
    } else {
      cardEl.empty(); // Clear display content
      cardEl.addClass('editing'); // Ensure editing class is present
      cardEl.removeClass('error', 'missing');
    }
    // Add background class if not already present
    cardEl.addClass('flashcard-background');

    cardEl.onclick = null; // Disable click-to-edit listener

    // If it's a new editor instance, cancel any *other* active editor
    if (isNewEditorInstance) {
      this.cancelAllEditors(id); // Pass current ID to exclude it
    }


    try {
      let currentContent = '';
      // If restoring editor state, use the provided initial content
      if (initialContent !== undefined) {
        currentContent = initialContent;
      } else {
        // Otherwise, read fresh content from the file
        const jsonContent = await this.app.vault.read(file);
        try {
          const flashcardData: FlashcardData = JSON.parse(jsonContent);
          currentContent = flashcardData.content || ''; // Default to empty string if content is missing
        } catch (parseError) {
          console.error(`Error parsing JSON for flashcard ${id} during edit:`, parseError);
          new Notice(`Error loading data for flashcard ${id}. Cannot edit.`);
          // Revert to display mode showing an error
          this.renderFlashcardDisplay(listContainerEl, file, id);
          return;
        }
      }


      // *** CHANGE: Create a single Markdown Editor using TextAreaComponent ***
      const editorContainer = cardEl.createDiv('flashcard-md-editor-container');

      // Use TextAreaComponent for multi-line Markdown input
      const markdownEditor = new TextAreaComponent(editorContainer)
        .setValue(currentContent)
        .setPlaceholder("Enter flashcard content (Markdown supported)...");

      // Make the textarea at least 5 lines tall
      // check length of content, and set rows accordingly
      markdownEditor.inputEl.rows = Math.max(5, Math.ceil((currentContent.match(/\n/g)?.length || 0) + 1));

      markdownEditor.inputEl.addClass('flashcard-markdown-editor'); // Add class for styling
      // Auto-focus only if it's a brand new editor instance
      if (isNewEditorInstance) {
        markdownEditor.inputEl.focus();
      }

      // Add paste event listener for clipboard images
      markdownEditor.inputEl.addEventListener('paste', async (e: ClipboardEvent) => {
        // Check if clipboard contains image data
        const clipboardItems = e.clipboardData?.items;
        if (!clipboardItems) return;

        // Look for image items in clipboard
        for (let i = 0; i < clipboardItems.length; i++) {
          const item = clipboardItems[i];

          // Check if item is an image
          if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // Prevent default paste behavior

            try {
              new Notice("Processing pasted image...");

              // Get the file from the clipboard item
              const file = item.getAsFile();
              if (!file) continue;

              // Generate a filename based on timestamp
              const fileExt = file.type.split('/')[1] || 'png';
              const fileName = `pasted-image-${Date.now()}.${fileExt}`;

              // Convert to array buffer
              const buffer = await file.arrayBuffer();

              // Upload image using existing method
              const { imagePath } = await this.plugin.flashcardManager.uploadImage(buffer, fileName);

              // Insert markdown at cursor position
              const textarea = markdownEditor.inputEl;
              const cursorPos = textarea.selectionStart;
              const value = markdownEditor.getValue();
              const imageMarkdown = `![${fileName}](${imagePath})`;

              const newValue = value.substring(0, cursorPos) +
                imageMarkdown +
                value.substring(textarea.selectionEnd);

              markdownEditor.setValue(newValue);

              // Place cursor after inserted markdown
              setTimeout(() => {
                textarea.focus();
                const newCursorPos = cursorPos + imageMarkdown.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
              }, 0);

              new Notice("Pasted image uploaded successfully!");
              return; // Process only the first image if multiple exist
            } catch (error) {
              console.error('Error handling pasted image:', error);
              new Notice(`Failed to process pasted image: ${error.message || 'Unknown error'}`);
            }
          }
        }
      });

      // Store editor info *after* successfully creating the component
      this.activeEditors.set(id, { container: cardEl, file: file, editorComponent: markdownEditor });

      // Create a flex container for bottom controls with proper spacing
      const controlsContainer = cardEl.createDiv('flashcard-controls-container');
      controlsContainer.style.display = "flex";
      controlsContainer.style.justifyContent = "space-between";
      controlsContainer.style.alignItems = "center";
      controlsContainer.style.marginTop = "10px";
      controlsContainer.style.flexWrap = "wrap"; // Enable wrapping for small screens
      controlsContainer.style.gap = "10px"; // Add gap between wrapped rows

      // Add format buttons container (now in the flex container)
      const formatButtonsEl = controlsContainer.createDiv('flashcard-format-buttons');
      formatButtonsEl.style.display = "flex";
      formatButtonsEl.style.gap = "5px";
      formatButtonsEl.style.flexWrap = "wrap"; // Allow wrapping if needed

      // Cloze button
      new ButtonComponent(formatButtonsEl)
        .setIcon("brackets")
        .setTooltip("Insert cloze deletion")
        .onClick(() => {
          const textArea = markdownEditor.inputEl;
          const start = textArea.selectionStart;
          const end = textArea.selectionEnd;
          const value = markdownEditor.getValue();

          // Find all existing cloze deletions and their numbers
          const clozeRegex = /\{\{c(\d+)::/g;
          const usedNumbers = new Set<number>();
          let match;

          while ((match = clozeRegex.exec(value)) !== null) {
            usedNumbers.add(parseInt(match[1], 10));
          }

          // Find the next available number
          let nextNumber = 1;
          while (usedNumbers.has(nextNumber)) {
            nextNumber++;
          }

          let newText: string;
          if (start === end) {
            // No selection, just insert empty cloze at cursor
            newText = value.substring(0, start) + `{{c${nextNumber}::}}` + value.substring(end);
            // Place cursor inside the cloze
            setTimeout(() => {
              textArea.focus();
              textArea.setSelectionRange(start + 5 + nextNumber.toString().length, start + 5 + nextNumber.toString().length);
            }, 0);
          } else {
            // Wrap selected text in cloze
            const selectedText = value.substring(start, end);
            newText = value.substring(0, start) + `{{c${nextNumber}::${selectedText}}}` + value.substring(end);
            // Position cursor at the end of the inserted cloze
            setTimeout(() => {
              textArea.focus();
              const newCursorPos = start + selectedText.length + 8 + nextNumber.toString().length;
              textArea.setSelectionRange(newCursorPos, newCursorPos);
            }, 0);
          }

          markdownEditor.setValue(newText);
        });

      // Image upload button
      new ButtonComponent(formatButtonsEl)
        .setIcon("image")
        .setTooltip("Upload image")
        .onClick(() => {
          if (this.fileInput && markdownEditor) {
            // Store current editor for use in the file selection handler
            this.activeImageUploadEditor = {
              editorComponent: markdownEditor,
              cardId: id
            };
            // Trigger file selection dialog
            this.fileInput.click();
          }
        });

      // Action Buttons (right side of flex container)
      const actionsEl = controlsContainer.createDiv('flashcard-edit-actions');
      actionsEl.style.display = "flex";
      actionsEl.style.gap = "8px";
      actionsEl.style.flexWrap = "wrap"; // Allow buttons to wrap
      actionsEl.style.marginLeft = "auto"; // Push to right, but allow wrapping

      // Make Save and Cancel buttons more consistent in size
      const saveButton = new ButtonComponent(actionsEl)
        .setButtonText('Save')
        .setCta();

      saveButton.buttonEl.style.minWidth = "80px"; // Consistent minimum width
      saveButton.onClick(async () => {
        try {
          const updatedMarkdown = markdownEditor.getValue();

          // *** CHANGE: Prepare and save JSON data ***
          const currentJsonContent = await this.app.vault.read(file);
          let currentFlashcardData: Partial<FlashcardData> = {};
          try {
            // Try to parse existing data to preserve other fields (like created date)
            currentFlashcardData = JSON.parse(currentJsonContent);
          } catch (e) {
            console.warn(`Could not parse existing JSON for ${id} on save, starting fresh. Error: ${e}`);
            // If parsing fails, we'll just save the content field
            currentFlashcardData = {}; // Reset to avoid using corrupted data
          }

          const updatedFlashcardData: FlashcardData = {
            ...currentFlashcardData, // Spread existing fields first
            content: updatedMarkdown, // Overwrite content
            id: id,
            // Optionally update a 'modified' timestamp if desired
            // modified: new Date().toISOString(),
          };

          const updatedJsonString = JSON.stringify(updatedFlashcardData, null, 2); // Pretty print

          // Use modify to save the changes
          await this.app.vault.modify(file, updatedJsonString);

          new Notice(`Flashcard ${id} updated.`);

          // --- Cleanup and Re-render Display ---
          this.activeEditors.delete(id); // Stop tracking editor
          cardEl.removeClass('editing'); // Remove editing class (renderFlashcardDisplay will handle the rest)

          // Re-render the display state IN PLACE
          this.renderFlashcardDisplay(listContainerEl, file, id);


        } catch (saveError) {
          console.error(`Error saving flashcard ${id}:`, saveError);
          new Notice(`Failed to save flashcard ${id}. See console for details.`);
          // Optionally leave the editor open on save error? Or revert? Reverting is safer.
          this.cancelEditor(id); // Revert to display on save error
        }
      });

      const cancelButton = new ButtonComponent(actionsEl)
        .setButtonText('Cancel');

      cancelButton.buttonEl.style.minWidth = "80px"; // Consistent minimum width
      cancelButton.onClick(() => {
        // Cancel the editor state and revert to display
        this.cancelEditor(id);
      });

    } catch (error) {
      console.error(`Error rendering flashcard editor ${id}:`, error);
      new Notice(`Error loading editor for ${id}. See console.`);
      // Attempt to revert to display state on error
      this.activeEditors.delete(id); // Ensure it's removed from tracking
      this.renderFlashcardDisplay(listContainerEl, file, id); // Show display (which might show error state again)
    }
  }

  /**
  * Cancels a specific active editor and reverts its card to display mode.
  * @param id The ID of the flashcard editor to cancel.
  * @param rerenderDisplay If true (default), attempt to re-render the card in display mode. Set to false if the card/view is being removed.
  */
  cancelEditor(id: string, rerenderDisplay = true) {
    const editorInfo = this.activeEditors.get(id);
    if (editorInfo) {
      const { container: cardEl, file } = editorInfo;
      this.activeEditors.delete(id); // Stop tracking *before* potentially re-rendering

      if (rerenderDisplay) {
        const listContainerEl = cardEl.parentElement;
        if (listContainerEl) {
          // Re-render the display state for this card
          this.renderFlashcardDisplay(listContainerEl, file, id); // This handles removing 'editing' class etc.
        } else {
          console.warn(`Parent element for card ${id} not found during cancel. View might need refresh.`);
        }
      } else {
        // Just remove the editing class if we are not re-rendering display
        cardEl.removeClass('editing');
        // Optionally clear the content if needed, but usually handled by full view refresh later
        // cardEl.empty();
      }
    }
  }


  /**
  * Cancels all currently active inline editors, except one optionally excluded.
  * @param excludeId Optional ID of a card editor *not* to cancel.
  * @param rerenderDisplay If true (default), attempt to re-render cards in display mode. Set to false if the view is being removed.
  */
  cancelAllEditors(excludeId?: string, rerenderDisplay = true) {
    const editorIds = Array.from(this.activeEditors.keys());
    editorIds.forEach(id => {
      if (id !== excludeId) {
        this.cancelEditor(id, rerenderDisplay);
      }
    });
  }


  /**
  * Scrolls the view to show the specified flashcard card and highlights it briefly.
  * Ensures the card is in display mode before focusing. (NO CHANGE NEEDED)
  * @param flashcardId The ID of the flashcard to jump to.
  */
  focusFlashcard(flashcardId: string) {
    if (this.activeEditors.has(flashcardId)) {
      this.cancelEditor(flashcardId); // Ensure display mode
    }
    this.cancelAllEditors(flashcardId); // Cancel others

    requestAnimationFrame(() => {
      const cardElement = this.contentEl.querySelector(`.flashcard-card[data-flashcard-id="${flashcardId}"]`);
      if (cardElement) {
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardElement.addClass('flashcard-highlight');
        setTimeout(() => {
          cardElement.removeClass('flashcard-highlight');
        }, 1500);
      } else {
        console.warn(`Could not find card element for flashcard ID: ${flashcardId} in the panel.`);
        new Notice(`Flashcard ${flashcardId} not found in the panel.`);
      }
    });
  }

  /**
   * Deletes a flashcard and removes all references to it in notes.
   * @param id The ID of the flashcard to delete.
   * @param file The TFile object representing the flashcard JSON file.
   */
  async deleteFlashcard(id: string, file: TFile): Promise<void> {
    if (!id) {
      console.error('Attempted to delete flashcard with undefined ID');
      new Notice("Cannot delete flashcard: Invalid flashcard ID");
      return;
    }

    try {
      await this.plugin.flashcardManager.deleteFlashcard(id);
      this.plugin.flashcardManager.clearEditorState(id);
      await this.refreshFlashcards();
      new Notice("Flashcard deleted successfully!");
    } catch (error) {
      console.error(`Error deleting flashcard ${id}:`, error);
      new Notice(`Failed to delete flashcard: ${error.message || 'Unknown error'}`);
    }
  }

  async refreshFlashcards(): Promise<void> {
    if (this.currentNoteFile) {
      try {
        const currentFile = this.app.workspace.getActiveFile();
        if (currentFile && currentFile.path === this.currentNoteFile.path) {
          await this.scheduleUpdate();
        }
      } catch (error) {
        console.error('Error refreshing flashcards:', error);
        new Notice('Failed to refresh flashcards');
      }
    } else {
      new Notice("No active note to refresh flashcards.");
    }
  }

  /**
   * Handles file selection from the file input element
   */
  private async handleFileSelection(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (files && files.length > 0 && this.activeImageUploadEditor) {
      const file = files[0];
      const { editorComponent } = this.activeImageUploadEditor;

      try {
        new Notice("Uploading image...");
        // Read file as array buffer
        const buffer = await file.arrayBuffer();

        // Upload image using FlashcardManager
        const { imagePath } = await this.plugin.flashcardManager.uploadImage(buffer, file.name);

        // Insert markdown for image at cursor position
        const textarea = editorComponent.inputEl;
        const cursorPos = textarea.selectionStart;
        const value = editorComponent.getValue();
        const imageMarkdown = `![${file.name}](${imagePath})`;

        const newValue = value.substring(0, cursorPos) + imageMarkdown + value.substring(textarea.selectionEnd);
        editorComponent.setValue(newValue);

        // Place cursor after inserted markdown
        setTimeout(() => {
          textarea.focus();
          const newCursorPos = cursorPos + imageMarkdown.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);

        new Notice("Image uploaded successfully!");
      } catch (error) {
        console.error('Error handling image upload:', error);
        new Notice(`Failed to upload image: ${error.message || 'Unknown error'}`);
      }

      // Reset file input for future uploads
      target.value = '';
      this.activeImageUploadEditor = null;
    }
  }

  /**
   * Process images in the HTML element to ensure they display correctly
   * @param element The HTML element containing images to process
   * @param sourcePath The source path of the note for path resolution
   */
  private processImages(element: HTMLElement, sourcePath: string) {
    const images = Array.from(element.getElementsByTagName("img"));

    if (!this.app?.metadataCache) {
      return;
    }

    for (const img of images) {
      // Skip empty or external URLs
      if (img.src === "" || img.src.includes("https://")) {
        continue;
      }

      // Clean the link path
      let cleanLink = img.src.replace('app://obsidian.md/', '');

      // For iOS
      cleanLink = cleanLink.replace('capacitor://localhost/', '');

      // Try to resolve the image file
      const imageFile = this.app.metadataCache.getFirstLinkpathDest(cleanLink, sourcePath);
      if (!imageFile) {
        console.debug('Image file not found:', cleanLink);
        continue;
      }

      // Get the resource path and update the image src
      const resourcePath = this.app.vault.getResourcePath(imageFile);
      img.src = resourcePath;

      // Apply special handling for mobile platforms
      if ((window as unknown as { Platform?: { isMobile?: boolean } }).Platform?.isMobile) {
        console.debug("Mobile platform detected - adjusting image display");
        img.style.objectFit = "contain";
        img.style.maxWidth = "100%";
        img.height = 200; // Adjust this value as needed
      }
    }
  }
}
