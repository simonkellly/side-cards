import { EditorView, WidgetType, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, RangeSetBuilder, Extension, Transaction, EditorState } from "@codemirror/state";

import FlashcardPlugin from "./main"; // Import the main plugin class
import { FLASHCARD_LINK_REGEX } from "./constants";

// --- Widget for Rendering Flashcard Links ---

class FlashcardLinkWidget extends WidgetType {
  constructor(
    readonly id: string,
    readonly plugin: FlashcardPlugin,
    readonly rawText: string // Store the original text (&id)
  ) {
    super();
  }

  // Compare widgets for efficient updates
  eq(other: FlashcardLinkWidget): boolean {
    return other.id === this.id && other.rawText === this.rawText;
    // Note: Comparing plugin instance might be too strict if plugin reloads?
    // If issues arise, might only compare id and rawText.
  }

  // Create the DOM element for the widget
  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("a"); // Use 'a' to match post-processor
    span.textContent = this.rawText; // Display the original &id text
    span.className = "tag cm-link"; // Use 'tag' for styling, 'cm-link' for cursor/interaction hints
    span.setAttribute("data-flashcard-id", this.id);
    span.setAttribute("href", "#"); // Necessary for 'a' tag styling/behavior sometimes
    span.style.cursor = "pointer"; // Explicitly set pointer cursor

    // Prevent default link navigation
    span.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation(); // Prevent CM default click behavior if necessary
      console.log(`Editor widget clicked: &${this.id}`);
      this.plugin.handleFlashcardLinkClick(this.id);
    });

    // Prevent CodeMirror from handling pointer events on the widget text itself,
    // otherwise clicking might place the cursor inside the widget.
    span.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    return span;
  }

  // Allow clicks to be handled by our listener
  ignoreEvent(event: Event): boolean {
    // Handle clicks ourselves. Let other events pass through.
    return event instanceof MouseEvent && event.type === "click";
  }
}

// --- StateField to Manage Decorations ---

function buildDecorations(state: EditorState, plugin: FlashcardPlugin): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = state.doc.toString(); // Get the full document text

  let match;
  FLASHCARD_LINK_REGEX.lastIndex = 0; // Reset regex state

  while ((match = FLASHCARD_LINK_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const id = match[1];
    const rawText = match[0]; // e.g., "&abc123"

    // Add a widget decoration replacing the matched text
    builder.add(
      start,
      end,
      Decoration.widget({
        widget: new FlashcardLinkWidget(id, plugin, rawText),
        side: 0, // Affects cursor position around widget, 0 is often neutral
        // block: false // Ensure it's an inline widget
      })
    );
  }

  return builder.finish();
}

export function createFlashcardLinkExtension(plugin: FlashcardPlugin): Extension {
  // Define the StateField that stores and updates the decorations
  const flashcardLinkField = StateField.define<DecorationSet>({
    // Initialize the state
    create(state): DecorationSet {
      return buildDecorations(state, plugin);
    },
    // Update the state based on document/view changes
    update(decoSet, tr: Transaction): DecorationSet {
      if (!tr.docChanged && !tr.selection) {
        // If only viewport changed, map existing decorations is faster
        // However, sometimes external factors might require rebuilding.
        // If issues arise, always rebuild: return buildDecorations(tr.state, plugin);
        return decoSet.map(tr.changes);
      }
      // If document changed, rebuild the decorations from scratch
      return buildDecorations(tr.state, plugin);
    },
    // Provide the decorations to the EditorView
    provide(field): Extension {
      return EditorView.decorations.from(field);
    }
  });

  // Return the StateField as an Editor Extension
  return flashcardLinkField;

  /*
  // Alternative using ViewPlugin (less performant for full doc scan on update)
  return ViewPlugin.fromClass(class {
     decorations: DecorationSet;

     constructor(view: EditorView) {
         this.decorations = buildDecorations(view.state, plugin);
     }

     update(update: ViewUpdate) {
         if (update.docChanged || update.viewportChanged || update.selectionSet) {
              this.decorations = buildDecorations(update.state, plugin);
         }
     }
  }, {
     decorations: v => v.decorations
  });
  */
}