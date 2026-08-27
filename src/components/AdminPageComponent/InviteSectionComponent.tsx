import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Flex,
  Group,
  Modal,
  Select,
  Table,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { IconCopy, IconMailPlus, IconTrash } from '@tabler/icons-react';

import { functions } from '../../firebase';
import { callableMessage } from '../../utils/authForms';
import { TEAMS } from '../../utils/teams';

interface IInvite {
  tokenHash: string;
  email: string;
  team: string;
  createdAt: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
}

const createInviteCallable = httpsCallable<
  { email: string; team: string },
  { ok: boolean; token: string; email: string; team: string; expiresAt: string }
>(functions, 'createInvite');

const listInvitesCallable = httpsCallable<
  Record<string, never>,
  { ok: boolean; invites: IInvite[] }
>(functions, 'listInvites');

const revokeInviteCallable = httpsCallable<{ tokenHash: string }, { ok: boolean }>(
  functions,
  'revokeInvite'
);

const inviteLink = (token: string) => `${window.location.origin}/#/invite/${token}`;

const formatIso = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const inviteStatus = (invite: IInvite) => {
  if (invite.usedAt) return { label: 'Accepted', color: 'green' };
  if (invite.revokedAt) return { label: 'Revoked', color: 'gray' };
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return { label: 'Expired', color: 'gray' };
  }
  return { label: 'Pending', color: 'blue' };
};

const InviteSectionComponent = () => {
  const [invites, setInvites] = useState<IInvite[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState<string | null>(TEAMS[0]);
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [issuedLink, setIssuedLink] = useState('');

  const refresh = useCallback(async () => {
    try {
      const { data } = await listInvitesCallable({});
      setInvites(data.invites);
    } catch (err) {
      console.error('Could not load invites:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onCreate = async () => {
    if (!team) return;
    setIsBusy(true);
    setError('');

    try {
      const { data } = await createInviteCallable({ email: email.trim().toLowerCase(), team });
      setIssuedLink(inviteLink(data.token));
      setIsModalOpen(false);
      setEmail('');
      await refresh();
    } catch (err) {
      setError(callableMessage(err, 'Could not create the invite.'));
    } finally {
      setIsBusy(false);
    }
  };

  const onRevoke = async (tokenHash: string) => {
    try {
      await revokeInviteCallable({ tokenHash });
      await refresh();
    } catch (err) {
      console.error('Could not revoke the invite:', err);
    }
  };

  const renderCreateModal = () => (
    <Modal
      centered
      title='Invite a user'
      opened={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setError('');
      }}
    >
      <Flex direction='column' gap='md'>
        <TextInput
          data-autofocus
          label='Email'
          placeholder='e-mail'
          value={email}
          error={error}
          withAsterisk
          onFocus={() => setError('')}
          onChange={(event) => setEmail(event.currentTarget.value.trim().toLowerCase())}
        />
        <Select
          label='Team'
          data={TEAMS}
          value={team}
          allowDeselect={false}
          withAsterisk
          onChange={setTeam}
        />
        <Flex justify='flex-end'>
          <Button onClick={onCreate} loading={isBusy} disabled={!email.trim().length || !team}>
            Create invite
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );

  const rows = invites.map((invite) => {
    const status = inviteStatus(invite);
    const isOutstanding = status.label === 'Pending';

    return (
      <Table.Tr key={invite.tokenHash}>
        <Table.Td>{invite.email}</Table.Td>
        <Table.Td>{invite.team}</Table.Td>
        <Table.Td>
          <Badge size='xs' variant='light' color={status.color}>{status.label}</Badge>
        </Table.Td>
        <Table.Td>{formatIso(invite.expiresAt)}</Table.Td>
        <Table.Td>
          {isOutstanding && (
            <IconTrash
              size={20}
              style={{ cursor: 'pointer' }}
              onClick={() => onRevoke(invite.tokenHash)}
            />
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <>
      {renderCreateModal()}

      <Group justify='space-between' align='center' mt='xl' mb='sm'>
        <Title order={2} fz='h4'>Invites</Title>
        <Button
          leftSection={<IconMailPlus size={16} />}
          onClick={() => setIsModalOpen(true)}
        >
          Invite a user
        </Button>
      </Group>

      {issuedLink && (
        <Alert
          color='blue'
          mb='sm'
          withCloseButton
          onClose={() => setIssuedLink('')}
          title='Copy this link now'
        >
          <Text fz='sm' mb='xs'>
            Only the hash is stored, so this link cannot be shown again. If you lose it, revoke
            the invite and issue a new one.
          </Text>
          <Group gap='xs'>
            <Text fz='xs' style={{ wordBreak: 'break-all' }}>{issuedLink}</Text>
            <CopyButton value={issuedLink}>
              {({ copied, copy }) => (
                <Button
                  size='xs'
                  variant='light'
                  leftSection={<IconCopy size={14} />}
                  onClick={copy}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
        </Alert>
      )}

      {invites.length ? (
        <Table striped highlightOnHover verticalSpacing='sm'>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Team</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Expires</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      ) : (
        <Text fz='sm' c='dimmed'>No invites yet.</Text>
      )}
    </>
  );
};

export default InviteSectionComponent;
