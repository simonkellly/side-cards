import { RawFlashcard, useFlashcardStore } from '@/lib/flashcard-store';
import { BracketsIcon, ImageIcon, RotateCwIcon } from 'lucide-react';
import { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

export default function FlashcardEditor({ card, setIsEditing }: { 
  card: RawFlashcard;
  setIsEditing: (isEditing: boolean) => void;
}) {
  const [textValue, setTextValue] = useState(card.text);
  const [extraValue, setExtraValue] = useState(card.extra || "");

  const resetForm = () => {
    setTextValue(card.text);
    setExtraValue(card.extra);
  };

  const save = () => {
    useFlashcardStore.getState().updateFlashcard({
      id: card.id,
      text: textValue,
      extra: extraValue,
    });
    setIsEditing(false);
  }

  return (
    <div className="flashcard flashcard-editor">
      <div className="flashcard-header">
        <div className="left" />
        <div className="title">Card: {card.id}</div>
        <div className="right">
          <button aria-label="Reset card" className="clickable-icon right" onClick={resetForm}>
            <RotateCwIcon className="svg-icon" />
          </button>
        </div>
      </div>
      <div className="flashcard-content">
        <div className="flashcard-editor-field">
          <label htmlFor="flashcard-text">Flashcard Text:</label>
          <TextareaAutosize
            id="flashcard-text"
            value={textValue}
            onChange={(e) => {
                setTextValue(e.target.value);
              }
            }
            minRows={4}
            className="flashcard-editor-textarea"
          />
        </div>
        <div className="flashcard-editor-field">
          <label htmlFor="flashcard-extra">Additional Info:</label>
          <TextareaAutosize
            id="flashcard-extra"
            value={extraValue}
            onChange={(e) => {
                setExtraValue(e.target.value);
              }
            }
            minRows={4}
            className="flashcard-editor-textarea"
          />
        </div>
      </div>
      <div className="flashcard-editor-buttons">
        <div className="flashcard-editor-buttons-group">
          <button aria-label="Add cloze">
            <BracketsIcon className="svg-icon" />
          </button>
          <button aria-label="Add image">
            <ImageIcon className="svg-icon" />
          </button>
        </div>
        <div className="flashcard-editor-buttons-group">
          <button aria-label="Cancel" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button aria-label="Save" className='mod-cta' onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};