import { StrictMode } from 'react';
import { DECK_VIEWER_VIEW_TYPE, FLASHCARD_PANEL_VIEW_TYPE } from '@/constants';
import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

export function registerFlashcardPanel(plugin: Plugin) {
  plugin.registerView(
    DECK_VIEWER_VIEW_TYPE,
    (leaf) => {
      return new DeckViewerView(leaf);
    }
  );
}

export class DeckViewerView extends ItemView {
	root: Root | null = null;
  
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return FLASHCARD_PANEL_VIEW_TYPE;
	}

	getDisplayText() {
		return 'Deck viewer';
	}

  getIcon() {
    return 'gallery-vertical-end';
  }

  async onOpen() {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<FlashcardPanel />
			</StrictMode>
		);
	}

	async onClose() {
		this.root?.unmount();
	}
}