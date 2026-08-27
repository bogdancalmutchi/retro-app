import * as React from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { Button, Flex, Modal, Table, TextInput, Title } from '@mantine/core';
import { IconClockShield } from '@tabler/icons-react';
import classNames from 'classnames';

import { db, functions } from '../../firebase';
import InviteSectionComponent from './InviteSectionComponent';

import styles from './AdminPageComponent.module.scss';

const setTempPasswordCallable = httpsCallable<
  { uid: string; tempPassword: string },
  { ok: boolean }
>(functions, 'setTempPassword');

interface IAdminPageComponentProps {
  // Define props here
}

const AdminPageComponent = (props: IAdminPageComponentProps) => {
  const {

  } = props;

  const [users, setUsers] = useState<any[]>([]);
  const [isTempPasswordModalOpen, setIsTempPasswordModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string>('');
  const [tempPasswordError, setTempPasswordError] = useState<string>('');
  const [manipulatedUser, setManipulatedUser] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAllUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        // Extract data from documents
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        setUsers(usersList); // Set the users to state
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchAllUsers();
  }, []);

  const setTempPasswordHash = async () => {
    const targetId = manipulatedUser.id;
    const chosenPassword = tempPassword;

    setTempPassword('');
    setIsTempPasswordModalOpen(false);
    setTempPasswordError('');

    try {
      // Hashing and writing happen in the setTempPassword function: the
      // browser is no longer allowed to touch a password hash.
      await setTempPasswordCallable({ uid: targetId, tempPassword: chosenPassword });

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === targetId
            ? { ...user, hasTempPassword: true }
            : user
        )
      );
    } catch (error) {
      console.error('Error setting temporary password:', error);
      setTempPasswordError((error as { message?: string })?.message ?? 'Could not set the password.');
      setIsTempPasswordModalOpen(true);
    }
  }

  const renderModalBody = () => {
    return (
      <Flex direction='column' gap='md'>
        <TextInput
          label={`Set Temporary Password for ${manipulatedUser.email}`}
          value={tempPassword}
          error={tempPasswordError}
          onFocus={() => setTempPasswordError('')}
          onChange={(event) => setTempPassword(event.currentTarget.value)}
        />
        <Flex justify='flex-end'>
          <Button
            onClick={setTempPasswordHash}
            disabled={!tempPassword.trim().length}
          >
            Set
          </Button>
        </Flex>
      </Flex>
    );
  };

  const renderTempPasswordModal = () => {
    return (
      <Modal
        centered
        title='Set Temporary Password'
        opened={isTempPasswordModalOpen}
        onClose={() => {
          setIsTempPasswordModalOpen(false);
          setManipulatedUser({});
          setTempPassword('');
        }}
      >
        {renderModalBody()}
      </Modal>
    );
  };

  const rows = users.map((user) => (
    <Table.Tr key={user.id}>
      <Table.Td>{user.displayName}</Table.Td>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td>{user.team}</Table.Td>
      <Table.Td>
        <div className={classNames({ [styles.tempPasswordText]: user.hasTempPassword })}>
          {JSON.stringify(user.hasTempPassword)}
        </div>
      </Table.Td>
      <Table.Td className={styles.centeredTableHeader}>
        <IconClockShield
          onClick={() => {
            setIsTempPasswordModalOpen(true);
            setManipulatedUser(user);
          }}
          size={20}
          style={{ cursor: 'pointer' }}
        />
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <>
      {renderTempPasswordModal()}
      <Title order={2} fz='h4' mb='sm'>Users</Title>
      <Table striped highlightOnHover verticalSpacing='sm'>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Display Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Team</Table.Th>
            <Table.Th>Temp Password</Table.Th>
            <Table.Th className={styles.centeredTableHeader}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>
      <InviteSectionComponent />
    </>
  );
};

export default AdminPageComponent;
