import { StrictMode } from 'react';
import { FLASHCARD_PANEL_VIEW_TYPE } from '@/constants';
import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import FlashcardPanel from './FlashcardPanel';

export function registerFlashcardPanel(plugin: Plugin) {
  plugin.registerView(
    FLASHCARD_PANEL_VIEW_TYPE,
    (leaf) => {
      return new FlashcardPanelView(leaf);
    }
  );

  const openManager = async () => {
    const { workspace } = plugin.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(FLASHCARD_PANEL_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
    }

    await leaf.setViewState({
      type: FLASHCARD_PANEL_VIEW_TYPE,
      active: true,
    });
  }

  plugin.addCommand({
    id: 'open-flashcard-panel',
    name: 'Open flashcard panel',
    callback: openManager,
  });
}

export class FlashcardPanelView extends ItemView {
	root: Root | null = null;
  
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return FLASHCARD_PANEL_VIEW_TYPE;
	}

	getDisplayText() {
		return 'Flashcard panel';
	}

  getIcon() {
    return 'zap';
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