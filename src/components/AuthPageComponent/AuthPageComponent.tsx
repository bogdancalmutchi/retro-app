import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import Cookies from 'js-cookie';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { Avatar, Button, Center, Flex, Group, Modal, Paper, Text, TextInput } from '@mantine/core';
import { v4 as uuidv4 } from 'uuid';

import { useUser } from '../../contexts/UserContext';
import { db } from '../../firebase';

import styles from './AuthPageComponent.module.scss';

interface ILoginPageComponentProps {
  // Define props here
}

const AuthPageComponent = (props: ILoginPageComponentProps) => {
  const {

  } = props;

  const navigate = useNavigate();
  const { setUserId, setDisplayName, setEmail } = useUser();

  const [signupEmailInput, setSignupEmailInput] = useState('');
  const [signupPasswordInput, setSignupPasswordInput] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [isSignupModalRendered, setIsSignupModalRendered] = useState(false);
  const [isLoginModalRendered, setIsLoginModalRendered] = useState(false);
  const [incorrectEmailError, setIncorrectEmailError] = useState('');
  const [incorrectPasswordError, setIncorrectPasswordError] = useState('');
  const [userExistsError, setUserExistsError] = useState('');

  const registerUser = async (displayName: string, email: string, password: string) => {
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
        id: userId,
        passwordHash: hashedPassword,
      });

      Cookies.set('userId', userId, { expires: 7, path: '' });
      Cookies.set('displayName', displayName, { expires: 7, path: '' });
      Cookies.set('email', email, { expires: 7, path: '' });
      setUserId(userId);
      setDisplayName(displayName);
      setEmail(email);

      navigate('/');
    } catch (error) {
      console.error('Error registering user:', error);
    }
  };

  const loginUser = async (email: string, password: string) => {
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

      // Store the UUID in a cookie
      Cookies.set('userId', userId, { expires: 7, path: '' });
      Cookies.set('displayName', displayName, { expires: 7, path: '' });
      Cookies.set('email', email, { expires: 7, path: '' });

      setUserId(userId);
      setDisplayName(displayName);
      setEmail(email);

      setIncorrectEmailError(null);
      setIncorrectPasswordError(null);

      navigate('/');
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
        onClose={() => {
          setIsSignupModalRendered(false);
          setSignupDisplayName('');
          setSignupEmailInput('');
          setSignupPasswordInput('');
        }}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            label='Name'
            placeholder='Name'
            value={signupDisplayName}
            withAsterisk
            onChange={(event) => setSignupDisplayName(event.currentTarget.value)}
          />
          <TextInput
            label='Email'
            placeholder='e-mail'
            value={signupEmailInput}
            error={userExistsError}
            withAsterisk
            onChange={(event) => setSignupEmailInput(event.currentTarget.value)}
          />
          <TextInput
            label='Password'
            placeholder='Password'
            value={signupPasswordInput}
            type='password'
            withAsterisk
            onChange={(event) => setSignupPasswordInput(event.currentTarget.value)}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => registerUser(signupDisplayName, signupEmailInput, signupPasswordInput)}
              disabled={!signupDisplayName.trim().length || !signupEmailInput.trim().length || !signupPasswordInput.trim().length}
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
        onClose={() => {
         setIsLoginModalRendered(false);
         setLoginEmailInput('');
         setLoginPasswordInput('');
       }}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            label='Email'
            placeholder='e-mail'
            value={loginEmailInput}
            error={incorrectEmailError}
            onChange={(event) => setLoginEmailInput(event.currentTarget.value)}
          />
          <TextInput
            label='Password'
            placeholder='Password'
            value={loginPasswordInput}
            error={incorrectPasswordError}
            type='password'
            onChange={(event) => setLoginPasswordInput(event.currentTarget.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !isInputEmpty) {
                await loginUser(loginEmailInput, loginPasswordInput)
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => loginUser(loginEmailInput, loginPasswordInput)}
              disabled={isInputEmpty}
            >
              Login
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  const renderLogo = () => {
    return (
      <div className={styles.headerText}>
        <Avatar radius='md' src='/retro-app/favicon.svg'/>
        <Text
          variant='gradient'
          gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
        >
          ProtoTigers Retro App
        </Text>
      </div>
    );
  };

  const renderAuthPage = () => {
    return (
      <Center h='50vh'>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.authCard}>
          {renderLogo()}
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
