import { EditorView, WidgetType, Decoration, DecorationSet, MatchDecorator, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";
import { FLASHCARD_LINK_REGEX } from "@/constants";
import { TFile } from "obsidian";
import SideCards from "@/main";
import "./flashcard-link.css";
import { useFlashcardStore } from "@/lib/flashcard-store";

const createFlashcard = async (file: TFile, plugin: SideCards) => {
  const flashcardId = Math.random().toString(36).substring(2, 8);
  const flashcardContent = `# Flashcard ${flashcardId}\n\n- Question: \n- Answer: `;
  const flashcardFile = file.name + flashcardContent + plugin.manifest;
  return { id: flashcardId, file: flashcardFile };
}

export function registerFlashcardLinkEditor(plugin: SideCards) {
  plugin.addCommand({
    id: 'create-flashcard',
    name: 'Create New Flashcard',
    async editorCallback(editor, ctx) {
      if (!ctx.file) {
        new Notice("No file found");
        return;
      }

      useFlashcardStore.getState().createFlashcard(ctx.file.path);

      const card = await createFlashcard(ctx.file, plugin);
      editor.replaceRange(
        `%!${card.id}`,
        editor.getCursor("from"),
        editor.getCursor("to"),
      );

      editor.setCursor(editor.getCursor("from").line, editor.getCursor("from").ch + card.id.length + 2);
    },
  });

  return plugin.registerEditorExtension(createFlashcardLinkExtension());
}

class FlashcardLinkWidget extends WidgetType {
  constructor(
    readonly id: string,
  ) {
    super();
  }

  eq(other: FlashcardLinkWidget): boolean {
    return other.id === this.id;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = "⚡️ " + this.id;
    span.className = "flashcard-link";

    span.addEventListener("click", () => {
      new Notice("Clicked on a flashcard link! (" + this.id + ")");
    });

    return span;
  }
}

export function createFlashcardLinkExtension(): Extension {
  const placeholderMatcher = new MatchDecorator({
    regexp: FLASHCARD_LINK_REGEX,
    decoration: (match) => {
      return Decoration.replace({
        widget: new FlashcardLinkWidget(match[1])
      })
    }
  });

  const flashcardLinkField = ViewPlugin.fromClass(class {
    placeholders: DecorationSet
    constructor(view: EditorView) {
      this.placeholders = placeholderMatcher.createDeco(view)
    }

    update(update: ViewUpdate) {
      let isSource = false;
      const container = update.view?.dom.parentElement;
      if (container) {
        isSource = !container.hasClass("is-live-preview");
      }

      if (isSource) {
        this.placeholders = new RangeSetBuilder<Decoration>().finish();
      } else {
        this.placeholders = placeholderMatcher.updateDeco(update, this.placeholders)
      }
    }
    
  }, {
    decorations: instance => instance.placeholders,
    provide: plugin => EditorView.atomicRanges.of(view => {
      return view.plugin(plugin)?.placeholders || Decoration.none
    })
  })  
  return [flashcardLinkField];
}