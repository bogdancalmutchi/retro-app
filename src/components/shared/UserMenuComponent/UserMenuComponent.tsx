import * as React from 'react';
import { Group, Menu, Text, UnstyledButton, Avatar } from '@mantine/core';
import {
  IconChevronRight,
  IconUserEdit,
  IconLogout,
} from '@tabler/icons-react';
import Cookies from 'js-cookie';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';

interface IUserMenuComponentProps {
  email: string;
  displayName: string;
}

const UserMenuComponent = (props: IUserMenuComponentProps) => {
  const {
    email,
    displayName
  } = props;

  const navigate = useNavigate();
  const { setUserId, setDisplayName, setEmail } = useUser();

  const onLogout = () => {
    Cookies.remove('userId', { path: '/retro-app' });
    Cookies.remove('displayName', { path: '/retro-app' });
    Cookies.remove('email', { path: '/retro-app' });

    setUserId(null);
    setDisplayName(null);
    setEmail(null);

    navigate('/auth');
  };

  const userButton = () => {
    return (
      <UnstyledButton>
        <Group>
          <Avatar key={displayName} name={displayName} color="initials" />
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {displayName}
            </Text>
            <Text c="dimmed" size="xs">
              {email}
            </Text>
          </div>
          <IconChevronRight size={14} stroke={1.5} />
        </Group>
      </UnstyledButton>
    );
  }

  return (
    <div>
      <Menu shadow='md' width={200}>
        <Menu.Target>
          {userButton()}
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => console.log('>>> WWWW')} leftSection={<IconUserEdit size={14} />}>
            Change Name
          </Menu.Item>
          <Menu.Item onClick={onLogout} leftSection={<IconLogout size={14} />}>
            Sign Out
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
};

export default UserMenuComponent;
