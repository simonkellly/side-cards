import { createBackup, deleteUnreferencedFlashcards, RawFlashcard, useFlashcardStore } from "@/lib/flashcard-store";
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  HeaderContext,
} from "@tanstack/react-table";
import "./deck-viewer.css";
import { DownloadIcon, HammerIcon, ArrowUp, ArrowDown, ArchiveIcon, StarIcon } from "lucide-react";
import { Menu } from "obsidian";
import { downloadAnkiCSV, exportToAnkiConnect } from "@/lib/anki";

function SortingIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (!isSorted) return null;
  return isSorted === "asc" ? (
    <ArrowUp className="sort-icon" size={16} />
  ) : (
    <ArrowDown className="sort-icon" size={16} />
  );
}

function openContextMenu(
  ev: React.MouseEvent,
  card: RawFlashcard
) {
  console.log(card);

  ev.preventDefault();
  ev.stopPropagation();

  const menu = new Menu()
  menu.addItem((item) =>
    item
      .setTitle('Copy')
      .setIcon('documents')
      .onClick(() => {
        new Notice('Copied');
      })
  );

  menu.addItem((item) =>
    item
      .setTitle('Paste')
      .setIcon('paste')
      .onClick(() => {
        new Notice('Pasted');
      })
  );

  menu.showAtPosition({
    x: ev.clientX,
    y: ev.clientY,
  });
}

function createSortableHeader(
  label: string,
  column: HeaderContext<RawFlashcard, unknown>["column"]
) {
  return (
    <div
      className="header-with-sort"
      onClick={() => column.toggleSorting()}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <SortingIcon isSorted={column.getIsSorted()} />
    </div>
  );
}

export default function DeckViewer() {
  const flashcards = useFlashcardStore((state) => state.flashcards);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnHelper = createColumnHelper<RawFlashcard>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("text", {
        header: ({ column }) => createSortableHeader("Question", column),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("extra", {
        header: ({ column }) => createSortableHeader("Extra", column),
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("filePath", {
        header: ({ column }) => createSortableHeader("Note", column),
        cell: (info) => info.getValue(),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: flashcards,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="deck-viewer">
      <div className="header-buttons">
        <div className="button-group">
          <button
            aria-label="Clear cards without references"
            onClick={() => confirm("Are you sure you want to clear unreferenced cards?") && deleteUnreferencedFlashcards()}
          >
            <HammerIcon className="svg-icon" />
          </button>
          <button
            aria-label="Create backup"
            onClick={async () => {
              await createBackup();
              new Notice("Backup created");
            }}
          >
            <ArchiveIcon className="svg-icon" />
          </button>
        </div>
        <div className="button-group">
          <button
            aria-label="Export via AnkiConnect"
            className=""
            onClick={() => exportToAnkiConnect()}
          >
            <StarIcon className="svg-icon" />
          </button>
          <button
            aria-label="Export cards"
            className="mod-cta"
            onClick={() => downloadAnkiCSV()}
          >
            <DownloadIcon className="svg-icon" />
          </button>
        </div>
      </div>
      <div className="search-container">
        <input
          type="text"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search all flashcards..."
          className="search-input"
          aria-label="Search flashcards"
        />
      </div>

      <div className="table-container">
        <table className="deck-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="table-header-row">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="table-header-cell">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map((cell) => {
                  const onContext = (ev: React.MouseEvent) => {
                    openContextMenu(ev, cell.row.original);
                  }
                  return (
                    <td key={cell.id} className="table-cell" onContextMenu={onContext}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}