import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  writeBatch
} from 'firebase/firestore';

import { db } from '../firebase';
import ThreeColumnsGridComponent, { INote, NoteCategory } from './ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { useSprint } from '../contexts/SprintContext';
import SprintHeaderComponent from './SprintHeaderComponent/SprintHeaderComponent';
import { useUser } from '../contexts/UserContext';
import GradientBorderButtonComponent from './shared/GradientBorderButtonComponent/GradientBorderButtonComponent';
import { ISprint } from './CardComponent/CardComponent';

const SprintBoardComponent = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const { userId } = useUser();
  const navigate = useNavigate();
  const { setIsOpen, setSprintId, sprintId: contextSprintId } = useSprint(); // Access sprintId and setSprintId from context
  const [currentSprint, setCurrentSprint] = useState<Partial<ISprint>>();
  const [sprintTitle, setSprintTitle] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [ownPrivateNotes, setOwnPrivateNotes] = useState<any[]>([]);
  const [noActionsAllowed, setNoActionsAllowed] = React.useState(false);

  useEffect(() => {
    if (!sprintId) return;

    // Set the sprintId in context when the component mounts
    setSprintId(sprintId);

    const sprintDocRef = doc(db, 'sprints', sprintId);
    const itemsRef = collection(sprintDocRef, 'items');
    const q = query(itemsRef, orderBy('order'));

  const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const allItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      const visibleItems = allItems.filter((note: INote) =>
        note.published || note.createdBy === userId
      );
      const ownPrivateNotes = allItems.filter((note: INote) =>
        note.published === false && note.createdBy === userId
      );
      setOwnPrivateNotes(ownPrivateNotes);
      setMessages(visibleItems);
    });

  // Listen for changes to the sprint document (e.g., isOpen toggled)
  const unsubscribeSprint = onSnapshot(sprintDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      setSprintTitle(data.title || sprintId);
      setCurrentSprint(data);
      setIsOpen(data.isOpen);
    } else {
      navigate('/');
    }
  });

  return () => {
    unsubscribeItems();
    unsubscribeSprint(); // Clean up both subscriptions
  };
}, [sprintId, setSprintId]);

  const handleAddMessage = async (message: string, category: string) => {
    if (!contextSprintId) return;
    const itemsRef = collection(db, 'sprints', contextSprintId, 'items');
    await addDoc(itemsRef, {
      text: message.trim(),
      category,
      createdBy: userId,
      createdAt: new Date(),
      published: category === NoteCategory.ActionItem,
      likes: 0,
      dislikes: 0,
      order: messages.length
    });
  };

  const onPublishNotes = async () => {
    if (!contextSprintId) return; // Ensure we have a valid sprint ID

    const batch = writeBatch(db);

    // Loop through all unpublished personal notes and update them to published: true
    ownPrivateNotes.forEach((note) => {
      if (note.published === false) {
        const noteRef = doc(db, 'sprints', contextSprintId, 'items', note.id); // Reference to the note in the 'items' subcollection
        batch.update(noteRef, { published: true });
      }
    });

    try {
      await batch.commit(); // Commit the batch of updates
    } catch (error) {
      console.error('Error publishing notes:', error);
    }
  };

  const handleNoActionsAllowed = (allowed: boolean) => {
    setNoActionsAllowed(allowed)
  }

  return (
    <div>
      {currentSprint?.isOpen && (
        <GradientBorderButtonComponent
          onPublishNotes={onPublishNotes}
          unpublishedNotes={ownPrivateNotes}
          disabled={noActionsAllowed}
        />
      )}
      <SprintHeaderComponent sprintTitle={sprintTitle} />
      <ThreeColumnsGridComponent
        messages={messages}
        onAddMessage={handleAddMessage}
        onNoActionsAllowed={handleNoActionsAllowed}
        noActionsAllowed={noActionsAllowed}
      />
    </div>
  );
};

export default SprintBoardComponent;
