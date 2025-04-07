import * as React from 'react';
import { useState } from 'react';
import { Button, Center, Paper, Text, TextInput } from '@mantine/core';

interface IUserDetailsModalComponentProps {
  setUserName: (name: string) => void;
}

const UserDetailsModalComponent = (props: IUserDetailsModalComponentProps) => {
  const {
    setUserName
  } = props;

  const [nameInput, setNameInput] = useState('');

  return (
    <Center h='100vh'>
      <Paper shadow='md' p='lg' withBorder maw={400} w='100%'>
        <Text size='lg' fw={500} mb='md'>Please enter user details</Text>
        <TextInput
          placeholder='Name'
          value={nameInput}
          onChange={(e) => setNameInput(e.currentTarget.value)}
        />
        <Button mt='md' onClick={() => setUserName(nameInput)} disabled={!nameInput.trim()}>
          Continue
        </Button>
      </Paper>
    </Center>
  );
};

export default UserDetailsModalComponent;
