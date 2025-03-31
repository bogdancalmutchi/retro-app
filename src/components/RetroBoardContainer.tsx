import * as React from 'react';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, doc, getDoc } from 'firebase/firestore';

import { db } from '../firebase';
import ThreeColumnsGridComponent from './ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import PassphraseComponent from './PassphraseComponent/PassphraseComponent';

const RetroBoardContainer = () => {
  const [messages, setMessages] = useState<any[]>([]); // assuming you'll store messages with category info
  const [passphrase, setPassphrase] = useState('');
  const [modalOpened, setModalOpened] = useState(true);

  useEffect(() => {
    const dbQuery = query(collection(db, 'retro-items'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(dbQuery, (snapshot) => {
      const retroItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(retroItems);
    });
    fetchPassphrase();

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  const fetchPassphrase = async () => {
    try {
      const passphraseRef = doc(db, 'settings', 'passphrase');  // Reference to the passphrase document
      const docSnap = await getDoc(passphraseRef);

      const passphrase = docSnap.data().value;
      setPassphrase(passphrase);
    } catch (error) {
      console.error('Error fetching passphrase:', error);
    }
  };

  const handleAddMessage = async (message: string, category: string) => {
    try {
      await addDoc(collection(db, 'retro-items'), {
        text: message,
        category: category, // Categorize the message (Good, Bad, Action Items)
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Error adding message: ", error);
    }
  };

  const handleCloseModal = () => {
    setModalOpened(false);
  };

  const isAccessGranted = localStorage.getItem('accessGranted');

  return (
    <div>
      {isAccessGranted && <h1>Retro Board</h1>}
      {!isAccessGranted && <PassphraseComponent
        fetchedPassphrase={passphrase}
        onClose={handleCloseModal}
      />}
      {isAccessGranted && <ThreeColumnsGridComponent
        messages={messages}
        onAddMessage={handleAddMessage}
      />}
    </div>
  );
};

export default RetroBoardContainer;
