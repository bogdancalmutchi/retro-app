import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import React from 'react';
import { Button } from '@mantine/core';
import CreateSprintModalComponent from './CreateSprintModalComponent/CreateSprintModalComponent';

const HomePage = () => {
  const [sprints, setSprints] = useState<any[]>([]);
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);

  useEffect(() => {
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

    fetchSprints();
  }, []);

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

  return (
    <div>
      <h1>ProtoTigers Sprint Boards</h1>
      {renderCreateSprintButton()}
      {renderCreateSprintModal()}
      <ul>
        {sprints.map((sprint) => (
          <li key={sprint.id}>
            <Link to={`/sprint/${sprint.id}`}>
              {sprint.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HomePage;
