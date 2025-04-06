import { MarkdownView, Plugin } from "obsidian";
import { registerFlashcardLinkEditor } from "./note-viewer/editor-extension";
import { registerFlashcardLinkPostprocessor } from "./note-viewer/postprocessor";
import { usePluginStore } from "./lib/plugin-store";
import { registerFlashcardPanel } from "./flashcard-panel/view";
import { registerDeckViewer } from "./deck-viewer/view";
import { BASE_PATH, DATA_FILE } from "./constants";
import { useFlashcardStore } from "./lib/flashcard-store";
import "./styles.css";

export const getFlashcardDataFile = async (plugin: SideCards) => {
  await plugin.app.vault.load();
  
  let folder = plugin.app.vault.getAbstractFileByPath(BASE_PATH);
  if (!folder) folder = await plugin.app.vault.createFolder(BASE_PATH);

  const file = plugin.app.vault.getFileByPath(`${BASE_PATH}/${DATA_FILE}`);
  if (file) return file;

  return await plugin.app.vault.create(
    `${BASE_PATH}/${DATA_FILE}`,
    JSON.stringify({ flashcards: [] }, null, 2),
  );
}

export default class SideCards extends Plugin {
  private async setupPluginStore() {
    const dataFile = await getFlashcardDataFile(this);
    usePluginStore.setState({ plugin: this, dataFile });

    this.registerEvent(
      this.app.workspace.on('layout-ready', () => {
      const curr = usePluginStore.getState().currentFile;
      if (curr) return;

      this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
        if (leaf.view instanceof MarkdownView) {
          const file = leaf.view.file;
          if (file) {
            usePluginStore.setState({ currentFile: file });
          }
        }
      })
    }));

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf || !leaf.view) return;
        if (!(leaf.view instanceof MarkdownView)) return;
        
        const mdView = leaf.view;
        const file = mdView.file;
        if (!file) return;
        
        usePluginStore.setState({ currentFile: file });
      })
    );
  }

  async onload() {
    await this.setupPluginStore();
    await useFlashcardStore.persist.rehydrate();

    registerFlashcardLinkEditor(this);
    registerFlashcardLinkPostprocessor(this);

    registerFlashcardPanel(this);
    registerDeckViewer(this);
  }
}
