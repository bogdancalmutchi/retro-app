import * as React from 'react';
import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Button, Textarea } from '@mantine/core';

import { IMessageType, NoteCategory } from './ThreeColumnsGridComponent';

import styles from './ColumnComponent.module.scss';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { IconCheck, IconPencil, IconThumbUp, IconTrash } from '@tabler/icons-react';

interface IColumnComponentProps {
  header: string;
  messages: IMessageType[];
  onSubmit: (message: string) => void;
}

const ColumnComponent = (props: IColumnComponentProps) => {
  const {
    header,
    messages,
    onSubmit
  } = props;

  const [note, setNote] = useState('');
  const [inEditMode, setInEditMode] = useState(false);
  const [noteToBeEdited, setNoteToBeEdited] = useState<IMessageType>(undefined);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (inEditMode && noteToBeEdited) {
      setNewNote(noteToBeEdited.text);
    }
  }, [inEditMode, noteToBeEdited]);

  const handleSubmit = () => {
    if (note.trim()) {
      onSubmit(note);
      setNote('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'retro-items', id)); // Delete by Firestore document ID
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleEdit = async (id: string, newData: object) => {
    try {
      const itemRef = doc(db, 'retro-items', id); // Get reference to document
      await updateDoc(itemRef, newData); // Update Firestore document
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const handleEditMode = (note: IMessageType) => {
    setNoteToBeEdited(note);
    setInEditMode(true);
  }

  const renderNoteText = (note: IMessageType) => {
    if (inEditMode && note.id === noteToBeEdited.id) {
      return (
        <>
        <Textarea
          autosize
          value={newNote}
          onChange={(event) => setNewNote(event.target.value)}
          maxLength={512}
        />
          <IconCheck
            className={styles.icon}
            size={16}
            onClick={() => {
              handleEdit(note.id, {text: newNote})
              setInEditMode(false);
            }}
          />
        </>

      );
    }
    return note.text;
  };

  const renderNoteCard = (note: IMessageType) => {
    return (
      <div>
        {renderNoteText(note)}
        <div className={styles.cardFooter}>
          <div className={styles.likesContainer}>
            <IconThumbUp className={styles.icon} size={16} onClick={() => handleEdit(note.id, { likes: note.likes + 1 })} />
            {note.likes > 0 && <span>{note.likes}</span>}
          </div>
          <div>
            <IconPencil className={styles.icon} size={16} onClick={() => handleEditMode(note)} />
            <IconTrash className={styles.icon} size={16} onClick={() => handleDelete(note.id)} />
          </div>
        </div>
      </div>
    )
  };

  const messagesList = messages.map((note, i) => {
    return (
      <div key={i} className={classNames(styles.itemContainer, {
        [styles.goodItemContainer]: note.category === NoteCategory.Good,
        [styles.badItemContainer]: note.category === NoteCategory.Bad,
        [styles.actionItemContainer]: note.category === NoteCategory.ActionItem
      })}>
        {renderNoteCard(note)}
      </div>
    )
  });

  const renderInputContainer = () => {
    return (
      <div className={styles.inputContainer}>
        <Textarea
          autosize
          placeholder='Write a note...'
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={512}
        />
        <Button className={styles.addNoteButton} onClick={handleSubmit} disabled={!note.trim()}>
          Add
        </Button>
      </div>
    )
  };

  return (
    <div className={styles.columnContainer}>
      <div className={styles.header}>{header}</div>
      <div className={styles.contentWithInput}>
        {renderInputContainer()}
        <div>{messagesList}</div>
      </div>
    </div>
  );
};

export default ColumnComponent;
