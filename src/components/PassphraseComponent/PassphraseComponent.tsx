import * as React from 'react';
import { Button, Modal, TextInput } from '@mantine/core';
import { useState } from 'react';

import styles from './PassphraseComponent.module.scss';

interface IPassphraseComponentProps {
  fetchedPassphrase: string;
  onClose: () => void
}

const PassphraseComponent = (props: IPassphraseComponentProps) => {
  const {
    fetchedPassphrase,
    onClose
  } = props;
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleSubmit = () => {
    if (passphrase === fetchedPassphrase) {
      onClose();
      setIsModalOpen(false);
      localStorage.setItem('accessGranted', JSON.stringify(true));
    } else {
      setError('Invalid passphrase. Try again.');
    }
  };

  return (
    <Modal withCloseButton={false} opened={isModalOpen} onClose={onClose} title="Enter Passphrase">
      <>
        <TextInput
          label="Passphrase"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          type="password"
          error={error && error}
          onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
        />
        <div className={styles.buttonContainer}>
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </>
    </Modal>
  );
};

export default PassphraseComponent;
