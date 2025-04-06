import { StrictMode } from 'react';
import { DECK_VIEWER_VIEW_TYPE } from '@/constants';
import { ItemView, Plugin, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import DeckViewer from './DeckViewer';
import "./deck-viewer.css";

export function registerDeckViewer(plugin: Plugin) {
  plugin.registerView(
    DECK_VIEWER_VIEW_TYPE,
    (leaf) => {
      return new DeckViewerView(leaf);
    }
  );

  const openDeckViewer = async () => {
    let leaf = plugin.app.workspace.getLeavesOfType(DECK_VIEWER_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = plugin.app.workspace.getLeaf(true);
      await leaf.setViewState({
        type: DECK_VIEWER_VIEW_TYPE,
        active: true,
      });
    }
    plugin.app.workspace.revealLeaf(leaf);
  }

  plugin.addCommand({
    id: 'open-deck-viewer',
    name: 'Open Deck Viewer',
    callback: openDeckViewer,
  })

  plugin.addRibbonIcon('gallery-vertical-end', 'Deck Viewer', openDeckViewer);
}

export class DeckViewerView extends ItemView {
	root: Root | null = null;
  
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return DECK_VIEWER_VIEW_TYPE;
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
				<DeckViewer />
			</StrictMode>
		);
	}

	async onClose() {
		this.root?.unmount();
	}
}