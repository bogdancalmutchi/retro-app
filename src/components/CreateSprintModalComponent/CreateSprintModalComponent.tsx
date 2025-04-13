import * as React from 'react';
import { Button, Modal, TextInput } from '@mantine/core';
import { addDoc, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

import { db } from '../../firebase';

import styles from './CreateSprintModalComponent.module.scss';

interface ICreateSprintModalComponentProps {
  isModalOpen: boolean;
  onClose: () => void;
  currentSelectedTeam: string;
}

const CreateSprintModalComponent = (props: ICreateSprintModalComponentProps) => {
  const {
    isModalOpen,
    onClose,
    currentSelectedTeam
  } = props;

  const navigate = useNavigate();
  const [sprintName, setSprintName] = React.useState<string>('');

  const handleCloseModal = () => {
    onClose();
    setSprintName('');
  }

  const onCreateNewSprintBoard = async () => {
    try {
      // Create a new sprint document in Firestore
      const docRef = await addDoc(collection(db, 'sprints'), {
        title: sprintName,
        team: currentSelectedTeam,
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
        <div className={styles.modalInfo}>
          Create a new sprint board for team <span>{currentSelectedTeam}</span>.
        </div>
        <div className={styles.modalBodyContainer}>
          <TextInput
            label='Sprint Board Name'
            placeholder='Enter sprint board name'
            maxLength={128}
            value={sprintName}
            data-autofocus
            onChange={(event) => setSprintName(event.target.value)}
            type='text'
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
            disabled={!sprintName.trim().length}
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
