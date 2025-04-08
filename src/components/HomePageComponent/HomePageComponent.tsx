import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

import { db } from '../../firebase';
import CreateSprintModalComponent from '../CreateSprintModalComponent/CreateSprintModalComponent';
import CardComponent from '../CardComponent/CardComponent';
import EmptyCardComponent from '../CardComponent/EmptyCardComponent';
import TabbedHeaderComponent from '../shared/TabbedHeaderComponent/TabbedHeaderComponent';

import styles from './HomePageComponent.module.scss';

const HomePageComponent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTeam = searchParams.get('team') || 'Protoss';
  const [sprints, setSprints] = useState<any[]>([]);
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);

  useEffect(() => {
    fetchSprints();
  }, []);

  const fetchSprints = async () => {
    const sprintsRef = collection(db, 'sprints');
    const q = query(sprintsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

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
  };

  const filteredSprints = sprints.filter(
    (sprint) => sprint.team === selectedTeam
  );

  const handleTeamChange = (team: string) => {
    setSearchParams({ team });
  };

  return (
    <div>
      <TabbedHeaderComponent onTabChange={handleTeamChange} />
      <CreateSprintModalComponent
        isModalOpen={isCreateSprintModalOpen}
        onClose={() => setIsCreateSprintModalOpen(false)}
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
