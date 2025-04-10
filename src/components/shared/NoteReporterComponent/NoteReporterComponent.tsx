import React from 'react';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Avatar, Flex } from '@mantine/core';

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

  return <div className={styles.reporterContainer}>
    <Flex justify='center' direction='row' gap='xs' align='center'>
      <Avatar size='xs' src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(userId)}&backgroundColor=ffdfbf`}/>
      {displayName}
    </Flex>
  </div>;
};

export default NoteReporterComponent;
