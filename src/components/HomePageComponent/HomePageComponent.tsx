import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';

import { db } from '../../firebase';
import CreateSprintModalComponent from '../CreateSprintModalComponent/CreateSprintModalComponent';
import CardComponent from '../CardComponent/CardComponent';
import EmptyCardComponent from '../CardComponent/EmptyCardComponent';

import styles from './HomePageComponent.module.scss';

const HomePageComponent = () => {
  const [searchParams] = useSearchParams();
  const selectedTeam = searchParams.get('team') || 'Protoss';
  const [sprints, setSprints] = useState<any[]>([]);
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);

  useEffect(() => {
    const sprintsRef = collection(db, 'sprints');
    const q = query(sprintsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const sprintList = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const sprintId = docSnap.id;
          const sprintData = docSnap.data();

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
    });

    return () => unsubscribe();
  }, []);

  const filteredSprints = sprints.filter(
    (sprint) => sprint.team === selectedTeam
  );

  return (
    <div>
      <CreateSprintModalComponent
        isModalOpen={isCreateSprintModalOpen}
        onClose={() => setIsCreateSprintModalOpen(false)}
        currentSelectedTeam={selectedTeam}
      />
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
