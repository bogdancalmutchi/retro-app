import * as React from 'react';
import { Button, Modal, TextInput } from '@mantine/core';
import { useState } from 'react';

import styles from './PassphraseModalComponent.module.scss';

interface IPassphraseComponentProps {
  fetchedPassphrase: string;
  onAccessGranted: () => void;
}

const PassphraseModalComponent = (props: IPassphraseComponentProps) => {
  const {
    fetchedPassphrase,
    onAccessGranted
  } = props;
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (passphrase === fetchedPassphrase) {
      sessionStorage.setItem('accessGranted', 'true');
      onAccessGranted();
    } else {
      setError('Invalid passphrase. Try again.');
    }
  };

  return (
    <Modal withCloseButton={false} opened onClose={() => {}} title='Enter Passphrase'>
      <>
        <TextInput
          label='Passphrase'
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          type='password'
          error={error}
          onKeyDown={(event) => event.key === 'Enter' && handleSubmit()}
        />
        <div className={styles.buttonContainer}>
          <Button onClick={handleSubmit}>Submit</Button>
        </div>
      </>
    </Modal>
  );
};

export default PassphraseModalComponent;
