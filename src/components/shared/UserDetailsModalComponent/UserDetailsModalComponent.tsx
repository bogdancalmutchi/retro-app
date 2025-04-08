import * as React from 'react';
import { useEffect, useState } from 'react';
import { Button, Group, Modal, TextInput, useModalsStack } from '@mantine/core';
import { collection, getDocs } from 'firebase/firestore';

import { db } from '../../../firebase';

interface IUserDetailsModalComponentProps {
  onSetUserDetails: (email?: string, displayName?: string) => void;
}

const UserDetailsModalComponent = ({ onSetUserDetails }: IUserDetailsModalComponentProps) => {
  useEffect(() => {
    stack.open('emailModal');
  }, []);

  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stack = useModalsStack(['emailModal', 'displayNameModal']);

  const fetchEmails = async () => {
    const usersCollection = collection(db, 'users');
    const snapshot = await getDocs(usersCollection);
    return snapshot.docs.map(doc => doc.data().email);
  };

  const checkEmailExists = async () => {
    const emails = await fetchEmails();
    return emails.includes(emailInput);
  };

  const handleEmailContinue = async () => {
    const emailRegex = /^[^\s@]+@intralinks\.com$/;
    if (!emailRegex.test(emailInput)) {
      setError('Email must be a valid @intralinks.com address');
      return;
    }

    setError(null);
    const exists = await checkEmailExists();

    if (exists) {
      await onSetUserDetails(emailInput); // No displayName needed
      stack.closeAll();
    } else {
      stack.open('displayNameModal');
    }
  };

  const handleNameConfirm = async () => {
    await onSetUserDetails(emailInput, nameInput);
    stack.closeAll();
  };

  return (
    <>
      <Modal.Stack>
        <Modal withCloseButton={false} {...stack.register('emailModal')} title='Enter email'>
          <TextInput
            placeholder='e-mail'
            value={emailInput}
            error={error}
            onClick={() => setError(null)}
            onChange={(event) => setEmailInput(event.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleEmailContinue()}
          />
          <Group mt='lg' justify='flex-end'>
            <Button onClick={handleEmailContinue}>
              Continue
            </Button>
          </Group>
        </Modal>

        <Modal withCloseButton={false} {...stack.register('displayNameModal')} title='Enter display name'>
          <TextInput
            placeholder='Name'
            value={nameInput}
            onChange={(e) => setNameInput(e.currentTarget.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleNameConfirm()}
          />
          <Group mt='lg' justify='flex-end'>
            <Button
              onClick={() => {
                stack.open('emailModal');
                stack.close('displayNameModal');
              }}
              variant='default'
            >
              Back
            </Button>
            <Button
              disabled={!nameInput.trim().length}
              onClick={handleNameConfirm}
            >
              Confirm
            </Button>
          </Group>
        </Modal>
      </Modal.Stack>
    </>
  );
};

export default UserDetailsModalComponent;
