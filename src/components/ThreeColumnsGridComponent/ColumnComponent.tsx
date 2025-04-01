import * as React from 'react';
import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Button, Modal, Textarea, TextInput } from '@mantine/core';

import { INote, NoteCategory } from './ThreeColumnsGridComponent';

import styles from './ColumnComponent.module.scss';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { IconCancel, IconCheck, IconPencil, IconThumbDown, IconThumbUp, IconTrash } from '@tabler/icons-react';
import { addItemToLocalStorage, getArrayFromLocalStorage, removeItemFromLocalStorage } from '../../utils/LocalStorage';

interface IColumnComponentProps {
  header: string;
  messages: INote[];
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
  const [noteToBeEdited, setNoteToBeEdited] = useState<INote>(undefined);
  const [noteToBeDeleted, setNoteToBeDeleted] = useState<INote>(undefined);
  const [newNote, setNewNote] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const handleThumbsUp = (note: INote) => {
    const isNoteAlreadyLiked = getArrayFromLocalStorage('liked').includes(note.id);
    const isNoteAlreadyDisliked = getArrayFromLocalStorage('disliked').includes(note.id);
    if (!isNoteAlreadyLiked && !isNoteAlreadyDisliked) {
      handleEdit(note.id, { likes: note.likes + 1 });
      addItemToLocalStorage(note.id, 'liked');
    } else if (isNoteAlreadyLiked) {
      handleEdit(note.id, { likes: note.likes - 1 });
      removeItemFromLocalStorage(note.id, 'liked');
    }
    return null;
  };

  const handleThumbsDown = (note: INote) => {
    const isNoteAlreadyLiked = getArrayFromLocalStorage('liked').includes(note.id);
    const isNoteAlreadyDisliked = getArrayFromLocalStorage('disliked').includes(note.id);
    if (!isNoteAlreadyDisliked && !isNoteAlreadyLiked) {
      handleEdit(note.id, { dislikes: note.dislikes + 1 });
      addItemToLocalStorage(note.id, 'disliked');
    } else if (isNoteAlreadyDisliked) {
      handleEdit(note.id, { dislikes: note.dislikes - 1 });
      removeItemFromLocalStorage(note.id, 'disliked');
    }
    return null;
  };

  const handleEditMode = (note: INote) => {
    setNoteToBeEdited(note);
    setInEditMode(true);
  };

  const renderDeleteModal = () => {
    return (
      <Modal
        title='Delete Note'
        withOverlay
        opened={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <div className={styles.deleteModalBody}>
          Are you sure you want to delete this note?
          <Button
            color='red'
            onClick={() => {
              handleDelete(noteToBeDeleted.id);
              setIsDeleteModalOpen(false);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    )
  };

  const renderNoteText = (note: INote) => {
    if (inEditMode && note.id === noteToBeEdited.id) {
      return (
        <>
        <Textarea
          autosize
          value={newNote}
          onChange={(event) => setNewNote(event.target.value)}
          maxLength={512}
        />
          <div className={styles.editNoteActionsContainer}>
            <IconCheck
              className={styles.icon}
              size={18}
              onClick={() => {
                handleEdit(note.id, {text: newNote})
                setInEditMode(false);
              }}
            />
            <IconCancel
              className={styles.icon}
              size={18}
              onClick={() => setInEditMode(false)}
            />
          </div>
        </>
      );
    }
    return note.text;
  };

  const renderNoteCard = (note: INote) => {
    return (
      <div>
        {renderNoteText(note)}
        <div className={classNames(styles.cardFooter, {[styles.apCardFooter]: note.category === NoteCategory.ActionItem})}>
          {note.category !== NoteCategory.ActionItem &&
            (
              <div className={styles.likesContainer}>
                <div>
                  <IconThumbUp
                    className={classNames(styles.icon, { [styles.activeLikeIcon]: getArrayFromLocalStorage('liked').includes(note.id) })}
                    size={18}
                    onClick={() => handleThumbsUp(note)}
                  />
                  <div>{note.likes}</div>
                </div>
                <div>
                  <IconThumbDown
                    className={classNames(styles.icon, { [styles.activeDislikeIcon]: getArrayFromLocalStorage('disliked').includes(note.id) })}
                    size={18}
                    onClick={() => handleThumbsDown(note)}
                  />
                  <div>{note.dislikes}</div>
                </div>
              </div>
            )
          }
          {!inEditMode && (
            <div className={styles.editDeleteContainer}>
              <IconPencil className={styles.icon} size={18} onClick={() => handleEditMode(note)}/>
              <IconTrash className={styles.icon} size={18} onClick={() => {
                setNoteToBeDeleted(note);
                setIsDeleteModalOpen(true);
              }}/>
            </div>
          )}
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
        {renderDeleteModal()}
        <div>{messagesList}</div>
      </div>
    </div>
  );
};

export default ColumnComponent;
