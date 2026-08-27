import * as React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button, Center, Flex, Modal, Paper, TextInput } from '@mantine/core';

import { auth, authPersistenceReady, db } from '../../firebase';
import { MIN_PASSWORD_LENGTH } from '../../utils/authForms';
import LowPolyBackgroundComponent from '../shared/LowPolyBackgroundComponent/LowPolyBackgroundComponent';
import AnimatedAppLogoComponent from '../shared/AppLogoComponent/AnimatedAppLogoComponent';

import styles from './AuthPageComponent.module.scss';

/**
 * Firebase reports a wrong password and an unknown account with different codes
 * depending on whether email-enumeration protection is on. Both collapse to one
 * message so the form never reveals which addresses exist.
 */
const signInMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code ?? '';

  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'Incorrect email or password.';
  }
  return 'Could not sign you in. Please try again.';
};

const AuthPageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname + location.state?.from?.search || '/';

  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');

  const [isNewPasswordModalRendered, setIsNewPasswordModalRendered] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const goToApp = (team: string | null, path: string = '/') => {
    const url = new URL(window.location.origin + path);
    if (team) {
      url.searchParams.set('team', team);
    }
    navigate(url.pathname + url.search);
  };

  // Firebase verifies the password itself, so nothing here handles credentials.
  const onLogin = async () => {
    setIsBusy(true);
    setLoginError('');

    try {
      await authPersistenceReady;
      const credential = await signInWithEmailAndPassword(
        auth,
        loginEmailInput,
        loginPasswordInput
      );

      const profile = await getDoc(doc(db, 'users', credential.user.uid));
      const data = profile.data();

      if (data?.hasTempPassword) {
        // Signed in on a password an admin chose. Force a change first.
        setIsNewPasswordModalRendered(true);
        return;
      }

      goToApp(data?.team ?? null, redirectPath);
    } catch (error) {
      setLoginError(signInMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const onSetNewPassword = async () => {
    if (newPasswordInput !== confirmPasswordInput) {
      setNewPasswordError('Passwords do not match');
      return;
    }
    if (newPasswordInput.length < MIN_PASSWORD_LENGTH) {
      setNewPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsBusy(true);
    setNewPasswordError('');

    try {
      const user = auth.currentUser;
      if (!user) {
        setNewPasswordError('Your session expired. Please sign in again.');
        return;
      }

      // Firebase requires a recent sign-in for this, which we just did.
      await updatePassword(user, newPasswordInput);
      await updateDoc(doc(db, 'users', user.uid), { hasTempPassword: false });

      const profile = await getDoc(doc(db, 'users', user.uid));

      setIsNewPasswordModalRendered(false);
      goToApp(profile.data()?.team ?? null, redirectPath);
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setNewPasswordError(
        code === 'auth/weak-password'
          ? 'That password is too weak.'
          : code === 'auth/requires-recent-login'
            ? 'Please sign in again before changing your password.'
            : 'Could not update your password.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const renderNewPasswordModal = () => {
    const isInputEmpty = !newPasswordInput.trim().length || !confirmPasswordInput.trim().length;

    return (
      <Modal
        centered
        title='Choose a new password'
        opened={isNewPasswordModalRendered}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        // Deliberately not dismissable: a temporary password must be replaced
        // before the user reaches the app.
        onClose={() => undefined}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            data-autofocus
            label='New Password'
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={newPasswordInput}
            type='password'
            maxLength={128}
            withAsterisk
            onFocus={() => setNewPasswordError('')}
            onChange={(event) => setNewPasswordInput(event.currentTarget.value)}
          />
          <TextInput
            label='Confirm Password'
            placeholder='Confirm Password'
            type='password'
            value={confirmPasswordInput}
            error={newPasswordError}
            withAsterisk
            onFocus={() => setNewPasswordError('')}
            onChange={(event) => setConfirmPasswordInput(event.currentTarget.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !isInputEmpty && !isBusy) {
                await onSetNewPassword();
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button onClick={onSetNewPassword} loading={isBusy} disabled={isInputEmpty}>
              Save and continue
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  const renderAuthPage = () => {
    const isInputEmpty = !loginEmailInput.trim().length || !loginPasswordInput.trim().length;

    return (
      <Center h='70vh'>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.authCard}>
          <AnimatedAppLogoComponent className={styles.logoContainer} />
          <Flex direction='column' gap='md'>
            <TextInput
              autoFocus
              label='Email'
              placeholder='e-mail'
              type='email'
              autoComplete='username'
              value={loginEmailInput}
              onFocus={() => setLoginError('')}
              onChange={(event) => setLoginEmailInput(event.currentTarget.value.trim().toLowerCase())}
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && !isInputEmpty && !isBusy) {
                  await onLogin();
                }
              }}
            />
            <TextInput
              label='Password'
              placeholder='Password'
              type='password'
              autoComplete='current-password'
              maxLength={128}
              value={loginPasswordInput}
              error={loginError}
              onFocus={() => setLoginError('')}
              onChange={(event) => setLoginPasswordInput(event.currentTarget.value)}
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && !isInputEmpty && !isBusy) {
                  await onLogin();
                }
              }}
            />
            <Button
              fullWidth
              mt='xs'
              variant='gradient'
              gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
              onClick={onLogin}
              loading={isBusy}
              disabled={isInputEmpty}
            >
              Login
            </Button>
          </Flex>
        </Paper>
      </Center>
    );
  };

  return (
    <>
      <LowPolyBackgroundComponent />
      {isNewPasswordModalRendered && renderNewPasswordModal()}
      {renderAuthPage()}
    </>
  );
};

export default AuthPageComponent;
