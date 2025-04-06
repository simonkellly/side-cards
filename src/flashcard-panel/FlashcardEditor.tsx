import { uploadAttachment } from '@/lib/attachments';
import { RawFlashcard, useFlashcardStore } from '@/lib/flashcard-store';
import { BracketsIcon, ImageIcon, RotateCwIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

export default function FlashcardEditor({ card, setIsEditing }: { 
  card: RawFlashcard;
  setIsEditing: (isEditing: boolean) => void;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const insertTextAtCursor = (
    textarea: HTMLTextAreaElement, 
    insertedText: string, 
    setValueFn: (value: string) => void
  ) => {
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const currentText = textarea.value;
    
    const newText = currentText.substring(0, start) + insertedText + currentText.substring(end);
    setValueFn(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertedText.length, start + insertedText.length);
    }, 0);
    
    return newText;
  };

  const cloze = () => {
    const ta = textAreaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === null || end === null) return;
    
    const selectedText = ta.value.substring(start, end);
    const availibleClozeId = ta.value.match(/{{c\d+::/g);
    const clozeId = availibleClozeId ? Math.max(...availibleClozeId.map((c) => {
      const match = c.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    })) + 1 : 1;

    const clozeText = `{{c${clozeId}::${selectedText}}}`;
    insertTextAtCursor(ta, clozeText, setTextValue);
    
    setTimeout(() => {
      ta.setSelectionRange(start + 6, start + clozeText.length - 2);
    }, 0);
  };

  const handleImageInsertion = async (file: File, targetTextarea: HTMLTextAreaElement) => {
    if (!file) return;
    
    const filePath = await uploadAttachment(file);
    const imageMarkdown = `![[${filePath}]]`;
    
    const setValueFn = targetTextarea.id === 'flashcard-text' ? setTextValue : setExtraValue;
    insertTextAtCursor(targetTextarea, imageMarkdown, setValueFn);
  };

  const imageUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !textAreaRef.current) return;
    
    await handleImageInsertion(file, textAreaRef.current);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    
    const items = e.clipboardData.items;
    let imageFile: File | null = null;
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        imageFile = items[i].getAsFile();
        break;
      }
    }
    
    if (imageFile) {
      await handleImageInsertion(imageFile, textarea);
    }
  };

  const createTextareaProps = (
    id: string, 
    value: string, 
    setValue: (value: string) => void,
    ref?: React.RefObject<HTMLTextAreaElement | null>
  ) => ({
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setValue(e.target.value),
    onPaste: handlePaste,
    minRows: 4,
    className: "flashcard-editor-textarea",
    ref,
  });

  return (
    <div className="flashcard flashcard-editor" id={card.id}>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*" 
        onChange={handleFileChange} 
      />
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
            placeholder='Question? Answer!'
            {...createTextareaProps('flashcard-text', textValue, setTextValue, textAreaRef)}
          />
        </div>
        <div className="flashcard-editor-field">
          <label htmlFor="flashcard-extra">Additional Info:</label>
          <TextareaAutosize
            placeholder='Extra info'
            {...createTextareaProps('flashcard-extra', extraValue, setExtraValue)}
          />
        </div>
      </div>
      <div className="flashcard-editor-buttons">
        <div className="flashcard-editor-buttons-group">
          <button aria-label="Add cloze" onClick={cloze}>
            <BracketsIcon className="svg-icon" />
          </button>
          <button aria-label="Add image" onClick={imageUpload}>
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
}