import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Button } from '@mantine/core';

import { db } from '../firebase';
import CreateSprintModalComponent from './CreateSprintModalComponent/CreateSprintModalComponent';
import PassphraseModalComponent from './PassphraseModalComponent/PassphraseModalComponent';

const HomePage = () => {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [accessGranted, setAccessGranted] = useState(() => {
    return sessionStorage.getItem('accessGranted') === 'true';
  });

  useEffect(() => {
    if (accessGranted) {
      fetchSprints();
    }
    fetchPassphrase();
  }, [accessGranted]);

    const fetchSprints = async () => {
      const sprintsRef = collection(db, 'sprints');
      const q = query(sprintsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const sprintList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setSprints(sprintList);
    };

  const fetchPassphrase = async () => {
    try {
      const passphraseRef = doc(db, 'settings', 'passphrase');
      const docSnap = await getDoc(passphraseRef);
      setPassphrase(docSnap.data()?.value);
    } catch (error) {
      console.error('Error fetching passphrase:', error);
    }
  };

  const renderCreateSprintButton = () => {
    return (
      <Button onClick={() => setIsCreateSprintModalOpen(true)}>Create Board</Button>
    );
  };

  const renderCreateSprintModal = () => {
    return (
      <CreateSprintModalComponent
        isModalOpen={isCreateSprintModalOpen}
        onClose={() => setIsCreateSprintModalOpen(false)}
      />
    );
  };

   if (!accessGranted) {
    return (
      <PassphraseModalComponent
        fetchedPassphrase={passphrase}
        onAccessGranted={() => setAccessGranted(true)}
      />
    );
  }

  return (
    <div>
      <h1>ProtoTigers Sprint Boards</h1>
      {renderCreateSprintButton()}
      {renderCreateSprintModal()}
      <ul>
        {sprints.map((sprint) => (
          <li key={sprint.id}>
            <Link to={`/sprint/${sprint.id}`}>{sprint.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HomePage;
