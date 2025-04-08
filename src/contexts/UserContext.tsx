import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Cookies from 'js-cookie';

interface UserContextType {
  userId: string | null;
  displayName: string | null;
  email: string | null;
  setUserId: (id: string | null) => void;
  setDisplayName: (name: string | null) => void;
  setEmail: (email: string | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = Cookies.get('userId') || null;
    const storedDisplayName = Cookies.get('displayName') || null;
    const storedEmail = Cookies.get('email') || null;
    setUserId(storedUserId);
    setDisplayName(storedDisplayName);
    setEmail(storedEmail);
  }, []);

  return (
    <UserContext.Provider value={{ userId, displayName, email, setUserId, setDisplayName, setEmail }}>
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
