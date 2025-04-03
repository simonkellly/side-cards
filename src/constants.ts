// src/constants.ts

/**
 * Unique identifier for the flashcard view type.
 * Used by Obsidian to manage this specific view.
 */
export const FLASHCARD_VIEW_TYPE = "flashcard-view";

/**
 * Default name for the folder where flashcard markdown files will be stored.
 * Consider making this configurable in plugin settings later.
 */
export const DEFAULT_FLASHCARD_FOLDER = "~card-data";

/**
 * Regular expression to find flashcard links like &nanoid.
 * It captures the ID within the brackets.
 */
export const FLASHCARD_LINK_REGEX = /&([a-zA-Z0-9]{6})/g;

/**
 * CSS class applied to the rendered flashcard links in the editor.
 */
export const FLASHCARD_LINK_CLASS = "flashcard-link-tag";

/**
 * Icon ID for the view panel. Uses a Lucide icon name available in Obsidian.
 * See https://lucide.dev/ for available icons.
 */
export const FLASHCARD_VIEW_ICON = "book-copy"; // Example icon
