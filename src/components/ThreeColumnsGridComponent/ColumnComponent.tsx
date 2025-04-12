import * as React from 'react';
import { useEffect, useState } from 'react';
import classNames from 'classnames';
import { Button, Modal, Textarea, Tooltip } from '@mantine/core';
import { IconCheck, IconLock, IconPencil, IconThumbDown, IconThumbUp, IconTrash, IconX } from '@tabler/icons-react';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

import { INote, NoteCategory } from './ThreeColumnsGridComponent';
import { useSprint } from '../../contexts/SprintContext';
import { db } from '../../firebase';
import { addItemToLocalStorage, getArrayFromLocalStorage, removeItemFromLocalStorage } from '../../utils/LocalStorage';
import { useUser } from '../../contexts/UserContext';
import NoteReporterComponent from '../shared/NoteReporterComponent/NoteReporterComponent';
import DisabledTooltipWrapper from '../shared/DisabledTooltipWrapper/DisabledTooltipWrapper';

import styles from './ColumnComponent.module.scss';

interface IColumnComponentProps {
  header: string;
  messages: INote[];
  onSubmit: (message: string) => void;
  onNoActionsAllowed: (allowed: boolean) => void;
  noActionsAllowed: boolean;
}

const ColumnComponent = (props: IColumnComponentProps) => {
  const {
    header,
    messages,
    onSubmit,
    onNoActionsAllowed,
    noActionsAllowed
  } = props;

  const { sprintId, isOpen: isSprintOpen } = useSprint();
  const { userId } = useUser();

  const [note, setNote] = useState('');
  const [inEditMode, setInEditMode] = useState(false);
  const [noteToBeEdited, setNoteToBeEdited] = useState<INote>(undefined);
  const [noteToBeDeleted, setNoteToBeDeleted] = useState<INote>(undefined);
  const [newNote, setNewNote] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [noteItems, setNoteItems] = useState<INote[]>(messages);

  useEffect(() => {
    if (inEditMode && noteToBeEdited) {
      setNewNote(noteToBeEdited.text);
    }
  }, [inEditMode, noteToBeEdited]);

  const isOwner = (note: INote) => {
    return userId && userId === note.createdBy;
  };

  useEffect(() => {
    setNoteItems(messages);
  }, [messages]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !isSprintOpen) return;

    const reordered = Array.from(noteItems);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setNoteItems(reordered);

    try {
      const updates = reordered
        .map((note, index) => ({ note, index }))
        .filter(({ note, index }) => note.order !== index); // Only update changed

      const updatePromises = updates.map(({ note, index }) => {
        const noteRef = doc(db, 'sprints', sprintId, 'items', note.id);
        return updateDoc(noteRef, { order: index });
      });

      await Promise.all(updatePromises);
    } catch (err) {
      console.error('Failed to update reordered notes:', err);
    }
  };

  const handleSubmit = () => {
    if (note.trim()) {
      onSubmit(note);
      setNote('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sprints', sprintId, 'items', id)); // Delete by Firestore document ID
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleEdit = async (id: string, newData: object) => {
    try {
      const itemRef = doc(db, 'sprints', sprintId, 'items', id); // Get reference to document
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
    onNoActionsAllowed(true);
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
        <Textarea
          error={!newNote.trim().length && 'Note cannot be empty.'}
          autosize
          value={newNote}
          onChange={(event) => setNewNote(event.target.value)}
          maxLength={512}
        />
      );
    }
    return (
      <div className={styles.wysiwigNoteText}>
        {note.text}
      </div>
    );
  };

  const renderNoteCard = (note: INote) => {
    return (
      <div>
        <div className={styles.noteHeader}>
          <NoteReporterComponent userId={note.createdBy} />
          {!note.published && (
            <Tooltip color='blue' label='Only visible to you'>
              <IconLock color='white' size={18}/>
            </Tooltip>
          )}
        </div>
        <div className={styles.noteContent}>
          {renderNoteText(note)}
        </div>
        <div
          className={classNames(
            {
              [styles.cardFooter]: note.category !== NoteCategory.ActionItem,
              [styles.apCardFooter]: (
                !inEditMode && (note.category === NoteCategory.ActionItem || !note.published)
              ) || (inEditMode && !note.published)
            }
          )}
        >
          {(note.category !== NoteCategory.ActionItem && note.published) &&
            (
              <DisabledTooltipWrapper disabled={isSprintOpen}>
                <div className={styles.likesContainer}>
                  <div>
                    <IconThumbUp
                      className={classNames(styles.thumbsIcon, { [styles.activeLikeIcon]: getArrayFromLocalStorage('liked').includes(note.id) })}
                      size={18}
                      onClick={() => (!isOwner(note) && isSprintOpen) && handleThumbsUp(note)}
                    />
                    <div>{note.likes}</div>
                  </div>
                  <div>
                    <IconThumbDown
                      className={classNames(styles.thumbsIcon, { [styles.activeDislikeIcon]: getArrayFromLocalStorage('disliked').includes(note.id) })}
                      size={18}
                      onClick={() => (!isOwner(note) && isSprintOpen) && handleThumbsDown(note)}
                    />
                    <div>{note.dislikes}</div>
                  </div>
                </div>
              </DisabledTooltipWrapper>
            )
          }
          <div className={classNames(styles.editDeleteContainer, { [styles.apEditDeleteContainer]: inEditMode && note.category === NoteCategory.ActionItem })}>
            {(!inEditMode && isSprintOpen && isOwner(note) && !noActionsAllowed) && (
              <>
                <IconPencil className={styles.icon} size={18} onClick={() => handleEditMode(note)}/>
                <IconTrash className={styles.icon} size={18} onClick={() => {
                  setNoteToBeDeleted(note);
                  setIsDeleteModalOpen(true);
                }}/>
              </>
            )}
            {(inEditMode && note.id === noteToBeEdited.id) && (
              <>
                <IconCheck
                  className={classNames(styles.icon, { [styles.disabledIcon]: (note.text === newNote || !newNote.trim().length) })}
                  size={18}
                  onClick={() => {
                    if (note.text !== newNote && newNote.trim().length) {
                      handleEdit(note.id, {text: newNote.trim()})
                    }
                    setInEditMode(false);
                    onNoActionsAllowed(false)
                  }}
                />
                <IconX
                  className={styles.icon}
                  size={18}
                  onClick={() => {
                    setInEditMode(false);
                    onNoActionsAllowed(false);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    )
  };

  const renderInputContainer = () => {
    return (
      <DisabledTooltipWrapper disabled={isSprintOpen}>
        <div className={styles.inputContainer}>
          <Textarea
            autosize
            placeholder='Write a note...'
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={512}
            disabled={!isSprintOpen}
          />
          <Button className={styles.addNoteButton} onClick={handleSubmit} disabled={!note.trim()}>
            Add
          </Button>
        </div>
      </DisabledTooltipWrapper>
    )
  };

  const renderColumnHeader = (columnHeader: string) => {
    switch (columnHeader) {
      case 'The Good':
        return <div className={classNames(styles.header, styles.goodItemColumnHeader)}>{columnHeader}</div>
      case 'The Bad':
        return <div className={classNames(styles.header, styles.badItemColumnHeader)}>{columnHeader}</div>
      case 'Action Items':
        return <div className={classNames(styles.header, styles.actionItemColumnHeader)}>{columnHeader}</div>
    }
  };

  return (
    <div className={styles.columnContainer}>
      {renderColumnHeader(header)}
      <div className={styles.contentWithInput}>
        {renderInputContainer()}
        {renderDeleteModal()}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`droppable-${header}`}>
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {noteItems.map((note, index) => (
                  <Draggable draggableId={note.id} index={index} key={note.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={classNames(styles.itemContainer, {
                          [styles.goodItemContainer]: note.category === NoteCategory.Good,
                          [styles.badItemContainer]: note.category === NoteCategory.Bad,
                          [styles.actionItemContainer]: note.category === NoteCategory.ActionItem,
                          [styles.dragging]: snapshot.isDragging
                        })}
                      >
                        {renderNoteCard(note)}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
};

export default ColumnComponent;
