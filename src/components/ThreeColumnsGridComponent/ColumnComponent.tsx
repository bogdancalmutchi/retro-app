import * as React from 'react';
import { useState } from 'react';
import classNames from 'classnames';
import { Button, Textarea } from '@mantine/core';

import { IMessageType, NoteCategory } from './ThreeColumnsGridComponent';

import styles from './ColumnComponent.module.scss';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { IconPencil, IconTrash } from '@tabler/icons-react';

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

  const renderNoteCard = (note: IMessageType) => {
    return (
      <div>
        {note.text}
        <div className={styles.cardFooter}>
          <IconPencil size={16} onClick={() => handleDelete(note.id)} />
          <IconTrash size={16} onClick={() => handleDelete(note.id)} />
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
