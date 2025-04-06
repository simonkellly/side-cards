import { getSortedFlashcards, SortedFlashcard, useFlashcardStore } from "@/lib/flashcard-store";
import { useState, useEffect } from "react";
import { Flashcard } from "./Flashcard";
import FlashcardEditor from "./FlashcardEditor";
import "./flashcard.css";
import { usePluginStore } from "@/lib/plugin-store";

export const FlashcardUnit = ({ card, toggleExpand, expanded }: {
  card: SortedFlashcard,
  toggleExpand: () => void,
  expanded: boolean,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  if (isEditing) return <FlashcardEditor card={card} setIsEditing={setIsEditing} />;
  return (
    <Flashcard
      card={card}
      expanded={expanded}
      toggleExpand={toggleExpand}
      setEditing={() => setIsEditing(true)}
    />
  );
}

export default function FlashcardPanel() {
  const rawFlashcards = useFlashcardStore((state) => state.flashcards); 
  const currentFile = usePluginStore((state) => state.currentFile);

  const [flashcards, setFlashcards] = useState<SortedFlashcard[]>([]);
  const [expandedCard, setExpandedCard] = useState<string>('');

  useEffect(() => {
    const loadFlashcards = async () => {
      const cards = await getSortedFlashcards(rawFlashcards, currentFile);
      setFlashcards(cards);
    };
    loadFlashcards();
  }, [rawFlashcards, currentFile]);

  const toggleExpand = (cardId: string) => {
    setExpandedCard((prev) => (prev === cardId ? '' : cardId));
  };

  return (
    <div className="flashcard-panel">
      {flashcards.map((card) => {
        return (
          <FlashcardUnit
            key={card.id}
            card={card}
            toggleExpand={() => toggleExpand(card.id)}
            expanded={expandedCard === card.id}
          />
        );
      })}
    </div>
  );
}
