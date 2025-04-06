import React from 'react';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Button } from '@mantine/core';

import { db } from '../firebase';
import CreateSprintModalComponent from './CreateSprintModalComponent/CreateSprintModalComponent';
import PassphraseModalComponent from './PassphraseModalComponent/PassphraseModalComponent';
import CardComponent from './CardComponent/CardComponent';

import styles from './HomePageComponent.module.scss';

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

    const sprintList = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const sprintId = docSnap.id;
        const sprintData = docSnap.data();

        // Fetch 'items' subcollection
        const itemsRef = collection(db, 'sprints', sprintId, 'items');
        const itemsSnap = await getDocs(itemsRef);
        const items = itemsSnap.docs.map((itemDoc) => ({
          id: itemDoc.id,
          ...itemDoc.data(),
        }));

        return {
          id: sprintId,
          ...sprintData,
          items,
        };
      })
    );

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
      <div className={styles.boardContainer}>
        {sprints.map((sprint) => (
          <CardComponent
            sprint={sprint}
            key={sprint.id}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
