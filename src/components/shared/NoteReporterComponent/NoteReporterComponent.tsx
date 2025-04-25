import React from 'react';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Avatar, Flex } from '@mantine/core';

import { db } from '../../../firebase';

import styles from './NoteReporterComponent.module.scss';

const NoteReporterComponent = ({ userId }: { userId: string }) => {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const userRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(userRef, (userSnap) => {
        if (userSnap.exists()) {
          setDisplayName(userSnap.data().displayName);
        } else {
          setDisplayName('Unknown user');
        }
    }, (error) => {
      console.error('Failed to fetch user', error);
        setDisplayName('Error');
    });

    return () => unsubscribe();
  }, [userId]);

  return <div className={styles.reporterContainer}>
    <Flex justify='center' direction='row' gap='xs' align='center'>
      <Avatar size='xs' src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(userId)}&backgroundColor=ffdfbf`}/>
      {displayName}
    </Flex>
  </div>;
};

export default NoteReporterComponent;
