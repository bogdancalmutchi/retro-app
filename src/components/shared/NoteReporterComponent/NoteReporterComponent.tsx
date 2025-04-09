import React from 'react';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../../firebase';

import styles from './NoteReporterComponent.module.scss';

const NoteReporterComponent = ({ userId }: { userId: string }) => {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setDisplayName(userSnap.data().displayName);
        } else {
          setDisplayName('Unknown user');
        }
      } catch (err) {
        console.error('Failed to fetch user', err);
        setDisplayName('Error');
      }
    };

    fetchUser();
  }, [userId]);

  return <div className={styles.reporterContainer}>{displayName}</div>;
};

export default NoteReporterComponent;
