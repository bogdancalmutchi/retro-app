import * as React from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { useEffect, useState } from 'react';
import { Button, Flex, Modal, Table, TextInput } from '@mantine/core';
import { IconClockShield } from '@tabler/icons-react';
import classNames from 'classnames';

import { db } from '../../firebase';

import styles from './AdminPageComponent.module.scss';

interface IAdminPageComponentProps {
  // Define props here
}

const AdminPageComponent = (props: IAdminPageComponentProps) => {
  const {

  } = props;

  const [users, setUsers] = useState<any[]>([]);
  const [isTempPasswordModalOpen, setIsTempPasswordModalOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string>('');
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
    const hash = await bcrypt.hash(tempPassword, 10);
    const userRef = doc(db, 'users', manipulatedUser.id);

    setTempPassword('');
    setIsTempPasswordModalOpen(false);

    await updateDoc(userRef, {
      hasTempPassword: true,
      passwordHash: hash
    });

    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === manipulatedUser.id
          ? { ...user, hasTempPassword: true }
          : user
      )
    );
  }

  const renderModalBody = () => {
    return (
      <Flex direction='column' gap='md'>
        <TextInput
          label={`Set Temporary Password for ${manipulatedUser.email}`}
          value={tempPassword}
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
    </>
  );
};

export default AdminPageComponent;
