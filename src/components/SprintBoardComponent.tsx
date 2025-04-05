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
import React from 'react';
import PassphraseModalComponent from './PassphraseModalComponent/PassphraseModalComponent';
import ThreeColumnsGridComponent from './ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { useSprint } from '../contexts/SprintContext';
import SprintHeaderComponent from './SprintHeaderComponent/SprintHeaderComponent';
import { Loader } from '@mantine/core'; // Import useSprint to access context

const SprintBoardComponent = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const { setSprintId, sprintId: contextSprintId } = useSprint(); // Access sprintId and setSprintId from context
  const [sprintTitle, setSprintTitle] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [passphrase, setPassphrase] = useState('');
  const [modalOpened, setModalOpened] = useState(true);

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
    fetchPassphrase();

    return () => unsubscribe();
  }, [sprintId, setSprintId]); // Ensure useEffect runs when sprintId or setSprintId changes

  const fetchPassphrase = async () => {
    try {
      const passphraseRef = doc(db, 'settings', 'passphrase');
      const docSnap = await getDoc(passphraseRef);
      setPassphrase(docSnap.data()?.value);
    } catch (error) {
      console.error('Error fetching passphrase:', error);
    }
  };

  const handleAddMessage = async (message: string, category: string) => {
    if (!contextSprintId) return;
    const itemsRef = collection(db, 'sprints', contextSprintId, 'items');
    await addDoc(itemsRef, {
      text: message,
      category,
      createdAt: new Date(),
      likes: 0,
      dislikes: 0
    });
  };

  const handleCloseModal = () => setModalOpened(false);
  const isAccessGranted = sessionStorage.getItem('accessGranted');

  return (
    <div>
      {isAccessGranted && (
        <SprintHeaderComponent sprintTitle={sprintTitle} />
      )}
      {!isAccessGranted && (
        <PassphraseModalComponent
          fetchedPassphrase={passphrase}
          onClose={handleCloseModal}
        />
      )}
      {isAccessGranted && (
        <ThreeColumnsGridComponent
          messages={messages}
          onAddMessage={handleAddMessage}
        />
      )}
    </div>
  );
};

export default SprintBoardComponent;
