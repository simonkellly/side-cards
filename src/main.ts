import { MarkdownView, Plugin } from "obsidian";
import { registerFlashcardLinkEditor } from "./note-viewer/editor-extension";
import { registerFlashcardLinkPostprocessor } from "./note-viewer/postprocessor";
import { usePluginStore } from "./lib/plugin-store";
import { registerFlashcardPanel } from "./flashcard-panel/view";

export default class SideCards extends Plugin {
  private setupPluginStore() {
    usePluginStore.setState({ plugin: this });
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf || !leaf.view) return;
        if (leaf.view.getViewType() !== 'markdown') return;
        
        const mdView = leaf.view as MarkdownView;
        const file = mdView.file;
        if (!file) return;
        
        usePluginStore.setState({ currentFile: file });
      })
    );
  }

	onload() {
    this.setupPluginStore();

    registerFlashcardLinkEditor(this);
    registerFlashcardLinkPostprocessor(this);

    registerFlashcardPanel(this);
	}
}
