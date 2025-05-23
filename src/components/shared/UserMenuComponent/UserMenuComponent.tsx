import * as React from 'react';
import { Group, Menu, Text, UnstyledButton, Avatar, Modal, TextInput, Button, Flex } from '@mantine/core';
import {
  IconChevronRight,
  IconUserEdit,
  IconLogout,
  IconClipboard,
} from '@tabler/icons-react';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { useUser } from '../../../contexts/UserContext';
import { useSprint } from '../../../contexts/SprintContext';
import { db } from '../../../firebase';
import { cookieLifetime } from '../../../utils/LocalStorage';

import styles from './UserMenuComponent.module.scss';

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
  const { canParty, setUserId, setDisplayName, setEmail, isAdmin } = useUser();
  const { sprintId } = useSprint();
  const [isEditUserModalOpen, setIsEditUserModalOpen] = React.useState(false);
  const [newDisplayName, setNewDisplayName] = React.useState('');

  const onLogout = () => {
    Cookies.remove('userId', { path: '/' });
    Cookies.remove('displayName', { path: '/' });
    Cookies.remove('email', { path: '/' });
    Cookies.remove('userTeam', { path: '/' });
    Cookies.remove('canParty', { path: '/' });

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

      // Update cookies
      Cookies.remove('displayName', { path: '/' });
      Cookies.set('displayName', newDisplayName, { expires: cookieLifetime, path: '/' });

      setDisplayName(newDisplayName);

      setIsEditUserModalOpen(false);
    } catch (error) {
      console.error('Failed to update display name:', error);
    }
  };

  const userButton = () => {
    return (
      <UnstyledButton>
        <Group>
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
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && newDisplayName.trim().length) {
                await onUpdateDisplayName();
              }
            }}
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

  const triggerGlobalCelebration = async (sprintId: string) => {
    if (canParty && sprintId) {
      const sprintRef = doc(db, 'sprints', sprintId);
      const sprintDoc = await getDoc(sprintRef);

      if (sprintDoc.exists() && sprintDoc.data().celebrating) {
        return; // Prevent the celebration if it's already in progress
      }

      try {
        await updateDoc(sprintRef, { celebrating: true });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await updateDoc(sprintRef, { celebrating: false });
      } catch (error) {
        console.error('Error celebrating sprint:', error);
      }
    }
  };

  const getRandomShape = () => {
    const shapes = ['circle', 'square', 'triangle'];
    return shapes[Math.floor(Math.random() * shapes.length)];
  };

  const renderAvatar = () => {
    const confettiCount = 10;
    return (
      <div style={{ position: 'relative', width: 'fit-content' }}>
        <Avatar
          src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(userId)}&backgroundColor=F2D3B1`}
          onClick={() => triggerGlobalCelebration(sprintId)}
        />
        {canParty && (
          <div className={styles.confettiOverlay}>
            {[...Array(confettiCount)].map((_, index) => (
              <div
                key={index}
                className={`${styles.confettiPiece} ${styles[getRandomShape()]}`}
                style={{
                  left: `${Math.random() * 100}%`, // Random horizontal position
                  animationDuration: `${Math.random() * 2 + 2}s`, // Random animation duration
                  animationDelay: `${index * 2}s, 10s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {isEditUserModalOpen && renderEditUserModal()}
      <div className={styles.menuContainer}>
        {renderAvatar()}
        <Menu shadow='md' width={200}>
          <Menu.Target>
            {userButton()}
          </Menu.Target>
          <Menu.Dropdown>
            {isAdmin && (
              <>
                <Menu.Item onClick={() => navigate('/admin')} leftSection={<IconClipboard size={14}/>}>
                  Admin Panel
                </Menu.Item>
                <Menu.Divider />
              </>
              )}
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
