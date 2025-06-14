import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  IconArrowNarrowLeft,
  IconCheck,
  IconSparkles,
  IconX
} from '@tabler/icons-react';
import classNames from 'classnames';
import { Badge, Blockquote, Flex, Text, TextInput, Tooltip } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

import { db } from '../../firebase';
import { useSprint } from '../../contexts/SprintContext';
import { useUser } from '../../contexts/UserContext';
import { fireConfettiRain } from '../shared/ConfettiCanvas/ConfettiCanvas';
import AiSummaryButtonComponent from '../AiSummaryComponent/AiSummaryButtonComponent';
import { ISprint } from '../CardComponent/CardComponent';

import styles from './SprintHeaderComponent.module.scss';

interface ISprintNameComponentProps {
  currentSprint: Partial<ISprint>;
}

const SprintHeaderComponent = (props: ISprintNameComponentProps) => {
  const {
    currentSprint
  } = props;

  const { sprintId, isOpen: isSprintOpen } = useSprint();
  const navigate = useNavigate();
  const { team, isAdmin: isCurrentUserAdmin } = useUser();
  const [inEditMode, setInEditMode] = useState(false);
  const [newSprintTitle, setNewSprintTitle] = useState('');

  useEffect(() => {
    if (inEditMode) {
      setNewSprintTitle(currentSprint.title);
    }
  }, [inEditMode, currentSprint?.title]);

  useEffect(() => {
    if (!sprintId) return;

    const unsub = onSnapshot(doc(db, 'sprints', sprintId), (docSnap) => {
      if (docSnap.exists() && docSnap.data().celebrating) {
        fireConfettiRain();
      }
    });

    return () => unsub();
  }, [sprintId]);

  const renderBackToHomeButton = () => (
    <div className={styles.backButtonContainer} onClick={() => navigate(`/?team=${encodeURIComponent(team)}`)}>
      <IconArrowNarrowLeft size={14} />
      Back to all sprints page
    </div>
  );

  const handleEdit = async (newData: { title: string }) => {
    try {
      const itemRef = doc(db, 'sprints', sprintId);
      await updateDoc(itemRef, newData);
      setInEditMode(false);
      setNewSprintTitle(newData.title);
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const renderSprintTitle = () => {
    if (inEditMode) {
      return (
        <TextInput
          defaultValue={newSprintTitle || currentSprint.title}
          onChange={(event) => setNewSprintTitle(event.target.value)}
          type='text'
          maxLength={128}
          rightSectionWidth='50'
          rightSection={
            <div className={styles.editActionsContainer}>
              <IconCheck
                className={classNames(styles.icon, { [styles.disabledIcon]: !newSprintTitle.trim().length })}
                size={18}
                onClick={() => currentSprint.title !== newSprintTitle ? handleEdit({ title: newSprintTitle }) : setInEditMode(false)}
                color='green'
              />
              <IconX
                className={styles.icon}
                size={18}
                onClick={() => {
                  setInEditMode(false);
                  setNewSprintTitle(currentSprint.title);
                }}
                color='red'
              /></div>
          }
          error={!newSprintTitle.trim().length && 'Name cannot be empty.'}
          onKeyDown={async (event) => {
            if (event.key === 'Enter' && newSprintTitle.trim().length) {
              await handleEdit({title: newSprintTitle});
            }
          }}
        />
      )
    }
    return (
      <Tooltip.Floating
        color='blue'
        className={styles.icon}
        disabled={inEditMode || !isSprintOpen}
        label='Click to edit Sprint Title'
      >
        <div
          className={styles.header}
          style={{ cursor: isSprintOpen ? 'pointer' : 'default' }}
          onClick={() => isSprintOpen && setInEditMode(true)}
        >
          <Flex justify='center' direction='row' gap='xs' align='center'>
            <Text
              variant='gradient'
              gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
            >
              {newSprintTitle || currentSprint?.title}
            </Text>
            <Badge size='md' variant='light' color={isSprintOpen ? 'blue' : 'red'}>{isSprintOpen? 'Open' : 'Closed'}</Badge>
          </Flex>
        </div>
      </Tooltip.Floating>
    );
  };

  const renderSprintSummary = () => {
    const aiIcon = <IconSparkles />
    return (
      <Blockquote className={styles.sprintSummaryContainer} color='blue' radius='md' icon={aiIcon} mt='xl'>
        {currentSprint?.summary}
      </Blockquote>
    )
  }

  return (
    <>
      <div className={styles.headerContainer}>
        <div className={styles.titleAndButtonContainer}>
          {renderSprintTitle()}
        </div>
      </div>
      <div className={styles.generateSummaryButton}>
        {(!currentSprint?.summary && !currentSprint?.isOpen && isCurrentUserAdmin) && <AiSummaryButtonComponent sprintId={sprintId}/>}
      </div>
      {renderBackToHomeButton()}
      {currentSprint?.summary && renderSprintSummary()}
    </>
  );
};

export default SprintHeaderComponent;
