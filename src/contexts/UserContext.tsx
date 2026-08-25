import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { SESSION_MAX_AGE_MS } from '../utils/session';

interface UserContextType {
  userId: string | null;
  displayName: string | null;
  email: string | null;
  team: string | null;
  canParty: boolean;
  isAdmin: boolean;
  hasTempPassword: boolean;
  /** True until the Firebase session has been resolved on first load. */
  loading: boolean;
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
  const [loading, setLoading] = useState<boolean>(true);

  // Identity comes from the Firebase session, never from a cookie. Setting a
  // cookie in devtools used to be enough to impersonate anyone; now the uid is
  // whatever the signed ID token says it is.
  useEffect(() => {
    // onIdTokenChanged rather than onAuthStateChanged so that a refreshed
    // token, and therefore a changed role claim, is picked up too.
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setUserId(null);
        setDisplayName(null);
        setEmail(null);
        setTeam(null);
        setCanParty(false);
        setIsAdmin(false);
        setHasTempPassword(false);
        setLoading(false);
        return;
      }

      const { claims } = await user.getIdTokenResult();

      // The rules refuse a session older than this, so sign out rather than let
      // the app run into permission errors it cannot explain. auth_time is the
      // last real sign-in and does not move when the token refreshes, and this
      // callback runs on every refresh, so an expired session is caught within
      // an hour of the ceiling.
      const authTimeMs = Number(claims.auth_time) * 1000;
      if (authTimeMs && Date.now() - authTimeMs > SESSION_MAX_AGE_MS) {
        await signOut(auth);
        return;
      }

      setUserId(user.uid);
      // The role is read from the signed token, not from the user document,
      // so it cannot be granted by writing to Firestore.
      setIsAdmin(claims.isAdmin === true);
      setLoading(false);
    });
  }, []);

  // Profile fields stay live, so a rename or the confetti unlock shows up
  // without a reload.
  useEffect(() => {
    if (!userId) return;

    return onSnapshot(doc(db, 'users', userId), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      setDisplayName(data.displayName ?? null);
      setEmail(data.email ?? null);
      setTeam(data.team ?? null);
      setCanParty(data.canParty === true);
      setHasTempPassword(data.hasTempPassword === true);
    });
  }, [userId]);

  return (
    <UserContext.Provider value={
      {
        userId, displayName, email, team, canParty, isAdmin, hasTempPassword, loading,
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
