import * as React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import Cookies from 'js-cookie';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { Avatar, Button, Center, Flex, Group, Modal, Paper, Radio, Text, TextInput } from '@mantine/core';
import { v4 as uuidv4 } from 'uuid';

import { useUser } from '../../contexts/UserContext';
import { db } from '../../firebase';
import { cookieLifetime } from '../../utils/LocalStorage';
import AppLogoComponent from '../shared/AppLogoComponent/AppLogoComponent';

import styles from './AuthPageComponent.module.scss';

const AuthPageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname || '/';
  const { setUserId, setDisplayName, setEmail, setTeam } = useUser();

  const allowedDomain = '@intralinks.com';
  const [emailDomainError, setEmailDomainError] = useState(false);
  const [emailFormatError, setEmailFormatError] = useState(false);
  const [signupEmailInput, setSignupEmailInput] = useState('');
  const [signupPasswordInput, setSignupPasswordInput] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [signupTeam, setSignupTeam] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [isSignupModalRendered, setIsSignupModalRendered] = useState(false);
  const [isLoginModalRendered, setIsLoginModalRendered] = useState(false);
  const [incorrectEmailError, setIncorrectEmailError] = useState('');
  const [incorrectPasswordError, setIncorrectPasswordError] = useState('');
  const [userExistsError, setUserExistsError] = useState('');

  const resetLoginModalState = () => {
    setIsLoginModalRendered(false);
    setLoginEmailInput('');
    setLoginPasswordInput('');
    setIncorrectEmailError('');
    setIncorrectPasswordError('');
  };

  const resetSignupModalState = () => {
    setIsSignupModalRendered(false);
    setSignupDisplayName('');
    setSignupEmailInput('');
    setSignupPasswordInput('');
    setEmailDomainError(false);
    setEmailFormatError(false);
  };

  const isEmailFormatValid = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const registerUser = async (displayName: string, email: string, password: string, team: string) => {
    try {
    const userId = uuidv4();

    // Check if email already exists
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const existing = snapshot.docs.find(doc => doc.data().email === email);

    if (existing) {
        console.error('User with this email already exists.');
        setUserExistsError('User with this email already exists.');
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

    // Store user using UUID as doc ID
    const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        email,
        displayName,
        team,
        id: userId,
        passwordHash: hashedPassword
      });

      Cookies.set('userId', userId, { expires: cookieLifetime, path: '/' });
      Cookies.set('displayName', displayName, { expires: cookieLifetime, path: '/' });
      Cookies.set('email', email, { expires: cookieLifetime, path: '/' });
      Cookies.set('userTeam', team, { expires: cookieLifetime, path: '/' });

      setUserId(userId);
      setDisplayName(displayName);
      setEmail(email);
      setTeam(team);

      navigate(`/?team=${encodeURIComponent(team)}`);
    } catch (error) {
      console.error('Error registering user:', error);
    }
  };

  const onClickRegister = async () => {
    if (!isEmailFormatValid(signupEmailInput)) {
      setEmailFormatError(true);
      return;
    }
    setEmailFormatError(false);

    if (!signupEmailInput.endsWith(allowedDomain)) {
      setEmailDomainError(true);
      return;
    }
    setEmailDomainError(false);

    await registerUser(signupDisplayName, signupEmailInput, signupPasswordInput, signupTeam);
  }

  const loginUser = async (email: string, password: string, redirectPath: string = '/') => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const userDoc = snapshot.docs.find(doc => doc.data().email === email);

      if (!userDoc) {
        setIncorrectEmailError('User not found');
        return;
      }

      const data = userDoc.data();
      const isPasswordValid = await bcrypt.compare(password, data.passwordHash);

      if (!isPasswordValid) {
        setIncorrectPasswordError('Incorrect password');
        return;
      }

      const userId = userDoc.id;
      const displayName = data.displayName;
      const userTeam = data.team;

      // Store the UUID in a cookie
      Cookies.set('userId', userId, { expires: cookieLifetime, path: '/' });
      Cookies.set('displayName', displayName, { expires: cookieLifetime, path: '/' });
      Cookies.set('email', email, { expires: cookieLifetime, path: '/' });
      Cookies.set('userTeam', userTeam, { expires: cookieLifetime, path: '/' });

      setUserId(userId);
      setDisplayName(displayName);
      setEmail(email);
      setTeam(userTeam);

      setIncorrectEmailError(null);
      setIncorrectPasswordError(null);

      navigate(`/?team=${encodeURIComponent(userTeam)}`);
    } catch (error) {
      console.error('Error logging in user:', error);
    }
  };

  const renderSignupModal = () => {
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
            maxLength={128}
            value={signupDisplayName}
            withAsterisk
            onChange={(event) => setSignupDisplayName(event.currentTarget.value)}
          />
          <TextInput
            label='Email'
            placeholder='e-mail'
            value={signupEmailInput}
            error={
              emailFormatError
                ? 'Invalid email format.'
                : emailDomainError
                  ? 'Email domain not allowed.'
                  : userExistsError
            }
            withAsterisk
            onFocus={() => {
              setEmailDomainError(false);
              setUserExistsError('');
            }}
            onChange={(event) => setSignupEmailInput(event.currentTarget.value.trim().toLowerCase())}
          />
          <TextInput
            label='Password'
            placeholder='Password'
            value={signupPasswordInput}
            type='password'
            maxLength={128}
            withAsterisk
            onChange={(event) => setSignupPasswordInput(event.currentTarget.value)}
          />
          <Radio.Group
            name='team'
            label='Select Team'
            withAsterisk
          >
            <Group mt='xs'>
              <Radio onChange={(event) => setSignupTeam(event.currentTarget.value)} value='Protoss' label='Protoss' />
              <Radio onChange={(event) => setSignupTeam(event.currentTarget.value)} value='Tigers' label='Tigers' />
            </Group>
          </Radio.Group>
          <Flex justify='flex-end'>
            <Button
              onClick={onClickRegister}
              disabled={
                !signupDisplayName.trim().length ||
                !signupEmailInput.trim().length ||
                !signupPasswordInput.trim().length ||
                !signupTeam
              }
            >
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
            error={incorrectEmailError}
            onFocus={() => setIncorrectEmailError('')}
            onChange={(event) => setLoginEmailInput(event.currentTarget.value.trim().toLowerCase())}
          />
          <TextInput
            label='Password'
            placeholder='Password'
            value={loginPasswordInput}
            error={incorrectPasswordError}
            type='password'
            maxLength={128}
            onFocus={() => setIncorrectPasswordError('')}
            onChange={(event) => {
              setIncorrectPasswordError('');
              setLoginPasswordInput(event.currentTarget.value);
            }}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !isInputEmpty) {
                await loginUser(loginEmailInput, loginPasswordInput, redirectPath)
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => loginUser(loginEmailInput, loginPasswordInput, redirectPath)}
              disabled={isInputEmpty}
            >
              Login
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
          <AppLogoComponent className={styles.logoContainer} />
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
      {isSignupModalRendered && renderSignupModal()}
      {isLoginModalRendered && renderLoginModal()}
      {renderAuthPage()}
    </>
  );
};

export default AuthPageComponent;
