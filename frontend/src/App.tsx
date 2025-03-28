import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

const RetroBoard = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    // Real-time listener for Firestore updates, ordered by createdAt timestamp
    const q = query(collection(db, 'retro-items'), orderBy('createdAt'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const retroItems = snapshot.docs.map((doc) => doc.data().text as string);
      setMessages(retroItems);
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  const sendMessage = async () => {
    if (note.trim()) {
      await addDoc(collection(db, 'retro-items'), {
        text: note,
        createdAt: serverTimestamp()  // Add timestamp field
      });
      setNote('');
    }
  };

  return (
    <div>
      <h1>Retro Board</h1>
      <input
        type='text'
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder='Write a note...'
      />
      <button onClick={sendMessage} disabled={!note.trim()}>
        Send
      </button>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
};

export default RetroBoard;
