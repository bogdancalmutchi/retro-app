import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInAnonymously, updateProfile, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { Center, Loader } from '@mantine/core';

import { auth, db } from '../firebase';
import UserDetailsModalComponent from '../components/shared/UserDetailsModalComponent/UserDetailsModalComponent';

type UserContextType = {
  user: User | null;
  displayName: string | null;
  setUserDetails: (email: string, displayName: string) => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  user: null,
  displayName: null,
  setUserDetails: async () => {}
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
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setDisplayName(data.displayName);
        }
      } else {
        await signInAnonymously(auth);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setUserDetails = async (email?: string, displayName?: string) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    if (email && !displayName) {
      // Just looking up existing user by email
      const usersCollection = collection(db, 'users');
      const snapshot = await getDocs(usersCollection);
      const match = snapshot.docs.find(doc => doc.data().email === email);

      if (match) {
        const fetchedName = match.data().displayName;
        setDisplayName(fetchedName);
        await updateProfile(auth.currentUser, { displayName: fetchedName });
      }
    } else if (email && displayName) {
      // Creating new user
      await updateProfile(auth.currentUser, { displayName });
      await setDoc(doc(db, 'users', uid), {
        displayName,
        email,
        createdAt: new Date(),
      });
      setDisplayName(displayName);
    } else if (displayName && !email) {
      // Updating name only
      await updateProfile(auth.currentUser, { displayName });
      await updateDoc(doc(db, 'users', uid), { displayName });
      setDisplayName(displayName);
    }
  };

  if (loading || !user) {
    return (
      <Center h='100vh'>
        <Loader />
      </Center>
    );
  }

  if (!displayName) {
    return <UserDetailsModalComponent onSetUserDetails={setUserDetails} />;
  }

  return (
    <UserContext.Provider value={{ user, displayName, setUserDetails }}>
      {children}
    </UserContext.Provider>
  );
};
