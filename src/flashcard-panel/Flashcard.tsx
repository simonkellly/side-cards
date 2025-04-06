import { processFlashcard, SortedFlashcard, useFlashcardStore } from "@/lib/flashcard-store";
import { PencilIcon, TrashIcon } from "lucide-react";

export const Flashcard = ({ card, toggleExpand, expanded, setEditing }: {
  card: SortedFlashcard,
  toggleExpand: () => void,
  expanded: boolean,
  setEditing: () => void,
}) => {
  const deleteCard = useFlashcardStore((state) => state.deleteFlashcard);

  const procesedCard = processFlashcard(card);
  const expandedClass = expanded ? "expanded" : "";

  return (
    <div className="flashcard">
      <div className="flashcard-header">
        <div className="left">
          <button aria-label="Delete card" className="clickable-icon left" onClick={() => deleteCard(card.id)}>
            <TrashIcon className="svg-icon" />
          </button>
        </div>
        <div className="title">
          <span className="sorted-hidden">●</span>
            Card: {card.id}
          <span className={card.isSorted ? "sorted" : "not-sorted"}>●</span>
        </div>
        <div className="right">
          <button aria-label="Edit card" className="clickable-icon right" onClick={() => setEditing()}>
            <PencilIcon className="svg-icon" />
          </button>
        </div>
      </div>
      <div className="flashcard-content" onClick={() => card.extra && toggleExpand()}>
        <div className="flashcard-text">
          <p dangerouslySetInnerHTML={{ __html: procesedCard.htmlText }} />
        </div>
        {procesedCard.htmlExtra && (<hr />)}
        <div className={"flashcard-extra " + expandedClass}>
          <p dangerouslySetInnerHTML={{ __html: procesedCard.htmlExtra }} />
        </div>
      </div>
    </div>
  );
};