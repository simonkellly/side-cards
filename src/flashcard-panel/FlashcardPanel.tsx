import { RawFlashcard, useFlashcardStore } from "@/lib/flashcard-store";
import { useState } from "react";
import { Flashcard } from "./Flashcard";
import FlashcardEditor from "./FlashcardEditor";
import "./flashcard.css";
import { usePluginStore } from "@/lib/plugin-store";

const FlashcardUnit = ({ card, toggleExpand, expanded }: {
  card: RawFlashcard,
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
  const file = usePluginStore((state) => state.currentFile);
  const flashcards = useFlashcardStore((state) => state.flashcards);
  const [expandedCard, setExpandedCard] = useState<string>('');

  const toggleExpand = (cardId: string) => {
    setExpandedCard((prev) => (prev === cardId ? '' : cardId));
  };

  const filteredFlashcards = file ? flashcards.filter((card) => card.filePath === file.path) : [];

  return (
    <div className="flashcard-panel">
      {filteredFlashcards.map((card) => {
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
