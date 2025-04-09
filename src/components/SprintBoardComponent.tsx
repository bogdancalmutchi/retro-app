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
  getDoc
} from 'firebase/firestore';

import { db } from '../firebase';
import ThreeColumnsGridComponent from './ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { useSprint } from '../contexts/SprintContext';
import SprintHeaderComponent from './SprintHeaderComponent/SprintHeaderComponent';
import { useUser } from '../contexts/UserContext';

const SprintBoardComponent = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const { userId, displayName } = useUser();
  const { setSprintId, sprintId: contextSprintId } = useSprint(); // Access sprintId and setSprintId from context
  const [sprintTitle, setSprintTitle] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

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
          setSprintTitle(sprintDoc.data().title || sprintId);
        } else {
          setSprintTitle(`Sprint ${sprintId} (not found)`);
        }
      } catch (err) {
        console.error('Failed to load sprint info:', err);
        setSprintTitle(`Sprint ${sprintId} (error)`);
      }
    };

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(items);
    });

    fetchSprint();
    return () => unsubscribe();
  }, [sprintId, setSprintId]); // Ensure useEffect runs when sprintId or setSprintId changes

  const handleAddMessage = async (message: string, category: string) => {
    if (!contextSprintId) return;
    const itemsRef = collection(db, 'sprints', contextSprintId, 'items');
    await addDoc(itemsRef, {
      text: message,
      category,
      createdBy: userId,
      createdAt: new Date(),
      likes: 0,
      dislikes: 0
    });
  };

  return (
    <div>
      <SprintHeaderComponent sprintTitle={sprintTitle} />
      <ThreeColumnsGridComponent
        messages={messages}
        onAddMessage={handleAddMessage}
      />
    </div>
  );
};

export default SprintBoardComponent;
