import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';

import { db } from '../../firebase';
import CreateSprintModalComponent from '../CreateSprintModalComponent/CreateSprintModalComponent';
import PassphraseModalComponent from '../PassphraseModalComponent/PassphraseModalComponent';
import CardComponent from '../CardComponent/CardComponent';
import EmptyCardComponent from '../CardComponent/EmptyCardComponent';
import TabbedHeaderComponent from '../shared/TabbedHeaderComponent/TabbedHeaderComponent';

import styles from './HomePageComponent.module.scss';

const HomePageComponent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTeam = searchParams.get('team') || 'Protoss';
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

  const filteredSprints = sprints.filter(
    (sprint) => sprint.team === selectedTeam
  );

  const handleTeamChange = (team: string) => {
    setSearchParams({ team }); // sets ?team=Protoss (or Tigers, etc.)
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
      <TabbedHeaderComponent onTabChange={handleTeamChange} />
      {renderCreateSprintModal()}
      <div className={styles.boardContainer}>
        <EmptyCardComponent onCardClick={() => setIsCreateSprintModalOpen(true)} />
        {filteredSprints.map((sprint) => (
          <CardComponent
            sprint={sprint}
            key={sprint.id}
          />
        ))}
      </div>
    </div>
  );
};

export default HomePageComponent;
