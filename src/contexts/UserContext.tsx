import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface UserContextType {
  userId: string | null;
  displayName: string | null;
  email: string | null;
  team: string | null;
  canParty: boolean;
  isAdmin: boolean;
  hasTempPassword: boolean;
  setUserId: (id: string | null) => void;
  setDisplayName: (name: string | null) => void;
  setEmail: (email: string | null) => void;
  setTeam: (team: string | null) => void;
  setCanParty: (canParty: boolean) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setHasTempPassword: (hasTempPassword: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [canParty, setCanParty] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [hasTempPassword, setHasTempPassword] = useState<boolean>(false);

  useEffect(() => {
    const storedUserId = Cookies.get('userId') || null;
    const storedDisplayName = Cookies.get('displayName') || null;
    const storedEmail = Cookies.get('email') || null;
    const storedTeam = Cookies.get('userTeam') || null;
    const storedCanParty = Cookies.get('canParty') === 'true';
    setUserId(storedUserId);
    setDisplayName(storedDisplayName);
    setEmail(storedEmail);
    setTeam(storedTeam);
    setCanParty(storedCanParty);

    // If userId exists, fetch the user document to check if the user is an admin
    if (storedUserId) {
      const fetchUserAdminStatus = async () => {
        try {
          const userRef = doc(db, 'users', storedUserId);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setIsAdmin(userData?.isAdmin || false); // Set isAdmin based on Firestore data
          }
        } catch (error) {
          console.error('Error fetching user admin status:', error);
        }
      };

      fetchUserAdminStatus();
    }
  }, []);

  return (
    <UserContext.Provider value={
      {
        userId, displayName, email, team, canParty, isAdmin, hasTempPassword,
        setUserId, setDisplayName, setEmail, setTeam, setCanParty, setIsAdmin, setHasTempPassword
      }
    }>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
