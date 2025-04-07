import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously, updateProfile, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Center, Loader } from '@mantine/core';

import { auth, db } from '../firebase';
import UserDetailsModalComponent from '../components/shared/UserDetailsModalComponent/UserDetailsModalComponent';

type UserContextType = {
  user: User | null;
  displayName: string | null;
  setUserName: (name: string) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  displayName: null,
  setUserName: async () => {}
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setDisplayName(firebaseUser.displayName);
      } else {
        await signInAnonymously(auth);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setUserName = async (name: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    // Update Firebase Auth profile
    await updateProfile(auth.currentUser, { displayName: name });

    // Save to Firestore
    await setDoc(doc(db, 'users', uid), {
      displayName: name,
      createdAt: new Date(),
    });

    // Update local state
    setDisplayName(name);
  };

  if (loading || !user) {
    return (
      <Center h='100vh'>
        <Loader />
      </Center>
    );
  }

  if (!displayName) {
    return (
      <UserDetailsModalComponent setUserName={setUserName} />
    );
  }

  return (
    <UserContext.Provider value={{ user, displayName, setUserName }}>
      {children}
    </UserContext.Provider>
  );
};
