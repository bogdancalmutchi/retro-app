import * as React from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import bcrypt from 'bcryptjs';
import Cookies from 'js-cookie';
import { collection, doc, DocumentData, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Button, Center, Flex, Group, Modal, Paper, Radio, TextInput } from '@mantine/core';
import { v4 as uuidv4 } from 'uuid';

import { useUser } from '../../contexts/UserContext';
import { db } from '../../firebase';
import { cookieLifetime } from '../../utils/LocalStorage';
import LowPolyBackgroundComponent from '../shared/LowPolyBackgroundComponent/LowPolyBackgroundComponent';
import AnimatedAppLogoComponent from '../shared/AppLogoComponent/AnimatedAppLogoComponent';

import styles from './AuthPageComponent.module.scss';

const AuthPageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from?.pathname + location.state?.from?.search || '/';
  const { setUserId, setDisplayName, setEmail, setTeam, setCanParty, setIsAdmin, setHasTempPassword } = useUser();

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
  const [isResetPasswordModalRendered, setIsResetPasswordModalRendered] = useState(false);
  const [resetPasswordConfirmPassInput, setResetPasswordConfirmPassInput] = useState('');
  const [resetPasswordNewPassInput, setResetPasswordNewPassInput] = useState('');
  const [incorrectEmailError, setIncorrectEmailError] = useState('');
  const [incorrectPasswordError, setIncorrectPasswordError] = useState('');
  const [notMatchingPasswordError, setNotMatchingPasswordError] = useState('');
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
        canParty: false,
        id: userId,
        passwordHash: hashedPassword,
        hasTempPassword: false,
        isAdmin: false
      });

      Cookies.set('userId', userId, { expires: cookieLifetime, path: '/' });
      Cookies.set('displayName', displayName, { expires: cookieLifetime, path: '/' });
      Cookies.set('email', email, { expires: cookieLifetime, path: '/' });
      Cookies.set('userTeam', team, { expires: cookieLifetime, path: '/' });
      Cookies.set('canParty', team, { expires: cookieLifetime, path: '/' });

      setUserId(userId);
      setDisplayName(displayName);
      setEmail(email);
      setTeam(team);
      setCanParty(false);

      navigate(`/?team=${encodeURIComponent(team)}`);
    } catch (error) {
      console.error('Error registering user:', error);
    }
  };

  const getUsersData = async (email: string) => {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const userDoc = snapshot.docs.find(doc => doc.data().email === email);

    if (!userDoc) {
      setIncorrectEmailError('User not found');
      return;
    }

    return userDoc.data();
  }

  const setUserData = (data: DocumentData) => {
    const userId = data.id;
    const displayName = data.displayName;
    const userTeam = data.team;
    const canParty = data.canParty;
    const isAdmin = data.isAdmin;
    const email = data.email;

    // Store the UUID in a cookie
    Cookies.set('userId', userId, { expires: cookieLifetime, path: '/' });
    Cookies.set('displayName', displayName, { expires: cookieLifetime, path: '/' });
    Cookies.set('email', email, { expires: cookieLifetime, path: '/' });
    Cookies.set('userTeam', userTeam, { expires: cookieLifetime, path: '/' });
    Cookies.set('canParty', canParty, { expires: cookieLifetime, path: '/' });

    setUserId(userId);
    setDisplayName(displayName);
    setEmail(email);
    setTeam(userTeam);
    setCanParty(canParty);
    setIsAdmin(isAdmin);
  }

  const onClickRegister = async () => {
    if (!isEmailFormatValid(signupEmailInput)) {
      setEmailFormatError(true);
      return;
    }
    setEmailFormatError(false);

    if (!signupEmailInput.endsWith(allowedDomain) || !signupEmailInput.endsWith('@admin.com')) {
      setEmailDomainError(true);
      return;
    }
    setEmailDomainError(false);

    await registerUser(signupDisplayName, signupEmailInput, signupPasswordInput, signupTeam);
  }

  const registerWithFirebase = async () => {
    const auth = getAuth();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmailInput, signupPasswordInput);
      const user = userCredential.user;

      const userId = uuidv4();
      const userRef = doc(db, 'users', userId);

      const userData = {
        email: user.email,
        displayName: signupDisplayName,
        team: signupTeam,
        canParty: true,
        id: userId,
        hasTempPassword: false,
        isAdmin: true
      };

      await setDoc(userRef, userData);

      setUserData(userData);

      navigate(`/?team=${encodeURIComponent(signupTeam)}`);
    } catch (error) {
      console.error('Firebase registration error:', error);
      setUserExistsError(error.message);
    }
  };

  const signInWithFirebase = async () => {
    const auth = getAuth();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmailInput, loginPasswordInput);
      const user = userCredential.user;

      // Get matching user from Firestore
      const data = await getUsersData(user.email || '');
      if (!data) {
        setIncorrectEmailError('User not found in Firestore');
        return;
      }

      // Set cookies and context
      setUserData(data);

      const url = new URL(window.location.origin + redirectPath);
      url.searchParams.set('team', data.team);
      navigate(url.pathname + url.search);
    } catch (error) {
      console.error('Firebase login error:', error);
      setIncorrectPasswordError('Incorrect email or password');
    }
  };

  const loginUser = async (email: string, password: string, redirectPath: string = '/') => {
    try {
      const data = await getUsersData(email);
      const isPasswordValid = await bcrypt.compare(password, data.passwordHash);

      if (!isPasswordValid) {
        setIncorrectPasswordError('Incorrect password');
        return;
      }

      if (data.hasTempPassword) {
        setIsLoginModalRendered(false);
        setIsResetPasswordModalRendered(true);
        return;
      }

      setUserData(data);

      setIncorrectEmailError(null);
      setIncorrectPasswordError(null);

      const url = new URL(window.location.origin + redirectPath);
      url.searchParams.set('team', data.team);
      navigate(url.pathname + url.search);
    } catch (error) {
      console.error('Error logging in user:', error);
    }
  };

  const loginUserAfterPassReset = async (email: string, confirmPassword: string, newPassword: string) => {
    const data = await getUsersData(email);
    const userRef = doc(db, 'users', data.id);
    const isNewPasswordMatching = confirmPassword === newPassword;

    if (data.hasTempPassword && !isNewPasswordMatching) {
      setNotMatchingPasswordError('Passwords do not match');
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await updateDoc(userRef, {
      hasTempPassword: false,
      passwordHash: newPasswordHash
    });

    setUserData(data);
    setHasTempPassword(false);
    navigate(`/?team=${encodeURIComponent(data.team)}`);
  }

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
              onClick={() => signupEmailInput.endsWith('@admin.com') ? registerWithFirebase() : onClickRegister()}
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
                loginEmailInput.endsWith('@admin.com') ? await signInWithFirebase() : await loginUser(loginEmailInput, loginPasswordInput, redirectPath)
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => loginEmailInput.endsWith('@admin.com') ? signInWithFirebase() : loginUser(loginEmailInput, loginPasswordInput, redirectPath)}
              disabled={isInputEmpty}
            >
              Login
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  const renderResetPasswordModal = () => {
    const isInputEmpty = !resetPasswordConfirmPassInput.trim().length || !resetPasswordNewPassInput.trim().length;
    return (
      <Modal
        centered
        title='Reset Password'
        opened={isResetPasswordModalRendered}
        onClose={resetLoginModalState}
      >
        <Flex direction='column' gap='md'>
          <TextInput
            data-autofocus
            label='New Password'
            placeholder='New Password'
            value={resetPasswordNewPassInput}
            error={notMatchingPasswordError}
            type='password'
            maxLength={128}
            withAsterisk
            onFocus={() => setNotMatchingPasswordError('')}
            onChange={(event) => setResetPasswordNewPassInput(event.currentTarget.value)}
          />
          <TextInput
            label='Confirm Password'
            placeholder='Confirm Password'
            type='password'
            value={resetPasswordConfirmPassInput}
            error={notMatchingPasswordError}
            withAsterisk
            onFocus={() => setNotMatchingPasswordError('')}
            onChange={(event) => setResetPasswordConfirmPassInput(event.currentTarget.value)}
            onKeyDown={async (event) => {
              if (event.key === 'Enter' && !isInputEmpty) {
                await loginUserAfterPassReset(loginEmailInput, resetPasswordConfirmPassInput, resetPasswordNewPassInput)
              }
            }}
          />
          <Flex justify='flex-end'>
            <Button
              onClick={() => loginUserAfterPassReset(loginEmailInput, resetPasswordConfirmPassInput, resetPasswordNewPassInput)}
              disabled={isInputEmpty}
            >
              Login
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  }

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
      {isResetPasswordModalRendered && renderResetPasswordModal()}
      {renderAuthPage()}
    </>
  );
};

export default AuthPageComponent;
