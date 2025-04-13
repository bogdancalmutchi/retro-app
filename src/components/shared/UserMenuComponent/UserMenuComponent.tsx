import * as React from 'react';
import { Group, Menu, Text, UnstyledButton, Avatar, Modal, TextInput, Button, Flex } from '@mantine/core';
import {
  IconChevronRight,
  IconUserEdit,
  IconLogout,
} from '@tabler/icons-react';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';

import { useUser } from '../../../contexts/UserContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

interface IUserMenuComponentProps {
  email: string;
  displayName: string;
  userId: string;
}

const UserMenuComponent = (props: IUserMenuComponentProps) => {
  const {
    email,
    displayName,
    userId
  } = props;

  const navigate = useNavigate();
  const { setUserId, setDisplayName, setEmail } = useUser();
  const [isEditUserModalOpen, setIsEditUserModalOpen] = React.useState(false);
  const [newDisplayName, setNewDisplayName] = React.useState('');

  const onLogout = () => {
    Cookies.remove('userId', { path: '/retro-app' });
    Cookies.remove('displayName', { path: '/retro-app' });
    Cookies.remove('email', { path: '/retro-app' });
    Cookies.remove('userTeam', { path: '/retro-app' });

    setUserId(null);
    setDisplayName(null);
    setEmail(null);

    navigate('/auth');
  };

  const onUpdateDisplayName = async () => {
    try {
      const userRef = doc(db, 'users', userId);

      // Update Firestore
      await updateDoc(userRef, {
        displayName: newDisplayName,
      });

      // Update cookie
      Cookies.remove('displayName', { path: '/retro-app' });
      Cookies.set('displayName', newDisplayName, { expires: 7, path: '/retro-app' });

      setDisplayName(newDisplayName);

      setIsEditUserModalOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to update display name:', error);
    }
  };

  const userButton = () => {
    return (
      <UnstyledButton>
        <Group>
          <Avatar src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(userId)}&backgroundColor=F2D3B1`}/>
          <div style={{ flex: 1 }}>
            <Text size='sm' fw={500}>
              {displayName}
            </Text>
            <Text c='dimmed' size='xs'>
              {email}
            </Text>
          </div>
          <IconChevronRight size={14} stroke={1.5} />
        </Group>
      </UnstyledButton>
    );
  }

  const renderEditUserModal = () => {
    return (
      <Modal
        centered
        title='Edit User'
        opened={isEditUserModalOpen}
        onClose={() => {
          setIsEditUserModalOpen(false);
        }}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            label='Name'
            placeholder='Name'
            maxLength={128}
            value={newDisplayName}
            onChange={(event) => setNewDisplayName(event.currentTarget.value)}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => onUpdateDisplayName()}
              disabled={!newDisplayName.trim().length}
            >
              Update
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  return (
    <>
      {isEditUserModalOpen && renderEditUserModal()}
      <div>
        <Menu shadow='md' width={200}>
          <Menu.Target>
            {userButton()}
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setIsEditUserModalOpen(true)} leftSection={<IconUserEdit size={14} />}>
              Change Name
            </Menu.Item>
            <Menu.Item onClick={onLogout} leftSection={<IconLogout size={14} />}>
              Sign Out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </>
  );
};

export default UserMenuComponent;
