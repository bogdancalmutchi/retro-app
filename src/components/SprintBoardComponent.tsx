import React from 'react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

const SprintBoardComponent = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const { userId } = useUser();
  const { setIsOpen, setSprintId, sprintId: contextSprintId } = useSprint(); // Access sprintId and setSprintId from context
  const [sprintTitle, setSprintTitle] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [ownPrivateNotes, setOwnPrivateNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!sprintId) return;

    // Set the sprintId in context when the component mounts
    setSprintId(sprintId);

    const sprintDocRef = doc(db, 'sprints', sprintId);
    const itemsRef = collection(sprintDocRef, 'items');
    const q = query(itemsRef, orderBy('createdAt', 'desc'));

    const fetchSprint = async () => {
      try {
        const sprintDoc = await getDoc(sprintDocRef);
        if (sprintDoc.exists()) {
          const data = sprintDoc.data();
          setSprintTitle(data.title || sprintId);
          setIsOpen(data.isOpen);
        } else {
          setSprintTitle(`Sprint ${sprintId} (not found)`);
        }
      } catch (err) {
        console.error('Failed to load sprint info:', err);
        setSprintTitle(`Sprint ${sprintId} (error)`);
      }
    };

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

    fetchSprint();
    return () => unsubscribe();
  }, [sprintId, setSprintId]); // Ensure useEffect runs when sprintId or setSprintId changes

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
      dislikes: 0
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

  return (
    <div>
      <GradientBorderButtonComponent onPublishNotes={onPublishNotes} unpublishedNotes={ownPrivateNotes}/>
      <SprintHeaderComponent sprintTitle={sprintTitle} />
      <ThreeColumnsGridComponent
        messages={messages}
        onAddMessage={handleAddMessage}
      />
    </div>
  );
};

export default SprintBoardComponent;
