import * as React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Button, Center, Flex, Group, Modal, Paper, Radio, TextInput } from '@mantine/core';

import { auth, authPersistenceReady, db, functions } from '../../firebase';
import LowPolyBackgroundComponent from '../shared/LowPolyBackgroundComponent/LowPolyBackgroundComponent';
import AnimatedAppLogoComponent from '../shared/AppLogoComponent/AnimatedAppLogoComponent';

import styles from './AuthPageComponent.module.scss';

const MIN_PASSWORD_LENGTH = 10;

const signupCallable = httpsCallable<
  { displayName: string; email: string; password: string; team: string },
  { ok: boolean; team: string }
>(functions, 'signup');

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

/**
 * Callable errors arrive as `functions/<code>` and their message is one we threw
 * deliberately, so it is safe to show. Transport failures (a blocked request, a
 * cold start timing out) instead surface as a bare code like "internal", which
 * means nothing to a user, so those fall back to a readable sentence.
 */
const OPAQUE_CALLABLE_ERRORS = ['internal', 'unavailable', 'deadline-exceeded', 'cancelled'];

const callableMessage = (error: unknown, fallback: string) => {
  const message = (error as { message?: string })?.message?.trim();
  if (!message || OPAQUE_CALLABLE_ERRORS.includes(message.toLowerCase())) {
    return fallback;
  }
  return message;
};

const AuthPageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname + location.state?.from?.search || '/';

  const [signupEmailInput, setSignupEmailInput] = useState('');
  const [signupPasswordInput, setSignupPasswordInput] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupTeam, setSignupTeam] = useState('');
  const [signupError, setSignupError] = useState('');

  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');

  const [isSignupModalRendered, setIsSignupModalRendered] = useState(false);
  const [isLoginModalRendered, setIsLoginModalRendered] = useState(false);
  const [isNewPasswordModalRendered, setIsNewPasswordModalRendered] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const resetLoginModalState = () => {
    setIsLoginModalRendered(false);
    setLoginEmailInput('');
    setLoginPasswordInput('');
    setLoginError('');
  };

  const resetSignupModalState = () => {
    setIsSignupModalRendered(false);
    setSignupDisplayName('');
    setSignupEmailInput('');
    setSignupPasswordInput('');
    setSignupTeam('');
    setSignupError('');
  };

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
        setIsLoginModalRendered(false);
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

  const onSignup = async () => {
    setIsBusy(true);
    setSignupError('');

    try {
      const { data } = await signupCallable({
        displayName: signupDisplayName,
        email: signupEmailInput,
        password: signupPasswordInput,
        team: signupTeam
      });

      // The account exists now; sign in with it the ordinary way.
      await authPersistenceReady;
      await signInWithEmailAndPassword(auth, signupEmailInput, signupPasswordInput);
      goToApp(data.team);
    } catch (error) {
      setSignupError(callableMessage(error, 'Could not create your account.'));
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

  const renderSignupModal = () => {
    const isInputEmpty =
      !signupDisplayName.trim().length ||
      !signupEmailInput.trim().length ||
      !signupPasswordInput.trim().length ||
      !signupTeam;

    return (
      <Modal
        centered
        title='Create new user'
        opened={isSignupModalRendered}
        onClose={resetSignupModalState}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            data-autofocus
            label='Name'
            placeholder='Name'
            maxLength={40}
            value={signupDisplayName}
            withAsterisk
            onChange={(event) => setSignupDisplayName(event.currentTarget.value)}
          />
          <TextInput
            label='Email'
            placeholder='e-mail'
            value={signupEmailInput}
            error={signupError}
            withAsterisk
            onFocus={() => setSignupError('')}
            onChange={(event) => setSignupEmailInput(event.currentTarget.value.trim().toLowerCase())}
          />
          <TextInput
            label='Password'
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={signupPasswordInput}
            type='password'
            maxLength={128}
            withAsterisk
            onChange={(event) => setSignupPasswordInput(event.currentTarget.value)}
          />
          <Radio.Group
            name='team'
            label='Select Team'
            value={signupTeam}
            onChange={setSignupTeam}
            withAsterisk
          >
            <Group mt='xs'>
              <Radio value='Protoss' label='Protoss' />
              <Radio value='Tigers' label='Tigers' />
            </Group>
          </Radio.Group>
          <Flex justify='flex-end'>
            <Button onClick={onSignup} loading={isBusy} disabled={isInputEmpty}>
              Create
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  const renderLoginModal = () => {
    const isInputEmpty = !loginEmailInput.trim().length || !loginPasswordInput.trim().length;

    return (
      <Modal
        centered
        title='Login'
        opened={isLoginModalRendered}
        onClose={resetLoginModalState}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            data-autofocus
            label='Email'
            placeholder='e-mail'
            value={loginEmailInput}
            onFocus={() => setLoginError('')}
            onChange={(event) => setLoginEmailInput(event.currentTarget.value.trim().toLowerCase())}
          />
          <TextInput
            label='Password'
            placeholder='Password'
            value={loginPasswordInput}
            error={loginError}
            type='password'
            maxLength={128}
            onFocus={() => setLoginError('')}
            onChange={(event) => setLoginPasswordInput(event.currentTarget.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !isInputEmpty && !isBusy) {
                await onLogin();
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button onClick={onLogin} loading={isBusy} disabled={isInputEmpty}>
              Login
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
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
    return (
      <Center h='50vh'>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.authCard}>
          <AnimatedAppLogoComponent className={styles.logoContainer} />
          <Group justify='center' align='center' gap={20}>
            <Button
              variant='gradient'
              gradient={{ from: 'indigo', to: 'cyan', deg: 45 }}
              onClick={() => setIsLoginModalRendered(true)}
            >
              Login
            </Button>
            <Button
              variant='gradient'
              gradient={{ from: 'cyan', to: 'indigo', deg: 45 }}
              onClick={() => setIsSignupModalRendered(true)}
            >
              Signup
            </Button>
          </Group>
        </Paper>
      </Center>
    );
  };

  return (
    <>
      <LowPolyBackgroundComponent />
      {isSignupModalRendered && renderSignupModal()}
      {isLoginModalRendered && renderLoginModal()}
      {isNewPasswordModalRendered && renderNewPasswordModal()}
      {renderAuthPage()}
    </>
  );
};

export default AuthPageComponent;
