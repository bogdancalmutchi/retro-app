import * as React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Anchor, Button, Center, Flex, Loader, Paper, Text, TextInput } from '@mantine/core';

import { auth, authPersistenceReady, functions } from '../../firebase';
import { callableMessage, MIN_PASSWORD_LENGTH } from '../../utils/authForms';
import LowPolyBackgroundComponent from '../shared/LowPolyBackgroundComponent/LowPolyBackgroundComponent';
import AnimatedAppLogoComponent from '../shared/AppLogoComponent/AnimatedAppLogoComponent';

import styles from './InvitePageComponent.module.scss';

const checkInviteCallable = httpsCallable<
  { token: string },
  { ok: boolean; email: string; team: string }
>(functions, 'checkInvite');

const redeemInviteCallable = httpsCallable<
  { token: string; displayName: string; password: string },
  { ok: boolean; email: string; team: string }
>(functions, 'redeemInvite');

const InvitePageComponent = () => {
  const { token = '' } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [invite, setInvite] = useState<{ email: string; team: string } | null>(null);
  const [invalidMessage, setInvalidMessage] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await checkInviteCallable({ token });
        if (cancelled) return;
        setInvite({ email: data.email, team: data.team });
        setStatus('valid');
      } catch (error) {
        if (cancelled) return;
        setInvalidMessage(
          callableMessage(error, 'This invite link is not valid or has expired.')
        );
        setStatus('invalid');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onAccept = async () => {
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsBusy(true);
    setFormError('');

    try {
      const { data } = await redeemInviteCallable({
        token,
        displayName: displayName.trim(),
        password
      });

      await authPersistenceReady;
      await signInWithEmailAndPassword(auth, data.email, password);
      navigate(`/?team=${encodeURIComponent(data.team)}`);
    } catch (error) {
      setFormError(callableMessage(error, 'Could not create your account.'));
    } finally {
      setIsBusy(false);
    }
  };

  const isInputEmpty =
    !displayName.trim().length || !password.trim().length || !confirmPassword.trim().length;

  const renderChecking = () => (
    <Flex direction='column' align='center' gap='md'>
      <Loader />
      <Text fz='sm' c='dimmed'>Checking your invite…</Text>
    </Flex>
  );

  const renderInvalid = () => (
    <Flex direction='column' align='center' gap='sm'>
      <Text fw={600}>This invite cannot be used</Text>
      <Text fz='sm' c='dimmed' ta='center'>{invalidMessage}</Text>
      <Text fz='sm' c='dimmed' ta='center'>
        Ask an admin for a new invite link, or{' '}
        <Anchor fz='sm' onClick={() => navigate('/auth')}>sign in</Anchor>
        {' '}if you already have an account.
      </Text>
    </Flex>
  );

  const renderForm = () => (
    <Flex direction='column' gap='md'>
      <div className={styles.invitedAs}>
        <Text fz='sm' c='dimmed'>You have been invited to team</Text>
        <Text fw={600}>{invite?.team}</Text>
        <Text fz='sm' c='dimmed'>{invite?.email}</Text>
      </div>
      <TextInput
        data-autofocus
        label='Name'
        placeholder='Name'
        maxLength={40}
        value={displayName}
        withAsterisk
        onChange={(event) => setDisplayName(event.currentTarget.value)}
      />
      <TextInput
        label='Password'
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        type='password'
        maxLength={128}
        value={password}
        withAsterisk
        onFocus={() => setFormError('')}
        onChange={(event) => setPassword(event.currentTarget.value)}
      />
      <TextInput
        label='Confirm Password'
        placeholder='Confirm Password'
        type='password'
        maxLength={128}
        value={confirmPassword}
        error={formError}
        withAsterisk
        onFocus={() => setFormError('')}
        onChange={(event) => setConfirmPassword(event.currentTarget.value)}
        onKeyDown={async (event) => {
          if (event.key === 'Enter' && !isInputEmpty && !isBusy) {
            await onAccept();
          }
        }}
      />
      <Flex justify='flex-end'>
        <Button onClick={onAccept} loading={isBusy} disabled={isInputEmpty}>
          Create account
        </Button>
      </Flex>
    </Flex>
  );

  return (
    <>
      <LowPolyBackgroundComponent />
      <Center h='70vh'>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.inviteCard}>
          <AnimatedAppLogoComponent className={styles.logoContainer} />
          {status === 'checking' && renderChecking()}
          {status === 'invalid' && renderInvalid()}
          {status === 'valid' && renderForm()}
        </Paper>
      </Center>
    </>
  );
};

export default InvitePageComponent;
