import * as React from 'react';
import { Button, Modal, Select, TextInput } from '@mantine/core';
import { addDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

import { db } from '../../firebase';
import { useUser } from '../../contexts/UserContext';

import styles from './CreateSprintModalComponent.module.scss';

interface ICreateSprintModalComponentProps {
  isModalOpen: boolean;
  onClose: () => void;
}

const CreateSprintModalComponent = (props: ICreateSprintModalComponentProps) => {
  const {
    isModalOpen,
    onClose
  } = props;

  const navigate = useNavigate();
  const { team: currentUserTeam } = useUser();
  const [sprintName, setSprintName] = React.useState<string>('');
  const [sprintTeam, setSprintTeam] = React.useState<string>(currentUserTeam);

  const handleCloseModal = () => {
    onClose();
    setSprintName('');
  }

  const onCreateNewSprintBoard = async () => {
    try {
      // Create a new sprint document in Firestore
      const docRef = await addDoc(collection(db, 'sprints'), {
        title: sprintName,
        team: sprintTeam,
        isOpen: true,
        createdAt: new Date(),
      });

      // Redirect to the new sprint page
      navigate(`/sprint/${docRef.id}`);
    } catch (error) {
      console.error('Error creating new sprint:', error);
    }
  };

  return (
    <Modal centered opened={isModalOpen} onClose={handleCloseModal} title='Create Board'>
      <div>
        <div className={styles.modalBodyContainer}>
          <TextInput
            label='Sprint Board Name'
            placeholder='Enter sprint board name'
            value={sprintName}
            data-autofocus
            onChange={(event) => setSprintName(event.target.value)}
            type='text'
          />
          <Select
            label='Team'
            placeholder='Pick a team'
            data={['Protoss', 'Tigers']}
            searchable
            checkIconPosition='right'
            defaultValue={currentUserTeam}
            onChange={(option) => setSprintTeam(option)}
          />
        </div>
        <div className={styles.buttonContainer}>
          <Button
            variant='outline'
            onClick={handleCloseModal}
          >
            Cancel
          </Button>
          <Button
            disabled={!sprintName.trim().length || !sprintTeam}
            onClick={() => onCreateNewSprintBoard()}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
    );
};

export default CreateSprintModalComponent;
