import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionIcon, Badge, Button, Flex, Menu, Modal, Text } from '@mantine/core';
import classNames from 'classnames';
import { IconDotsVertical, IconPlus, IconSquareRoundedX } from '@tabler/icons-react';
import { doc, updateDoc } from 'firebase/firestore';

import { ISprint } from '../CardComponent/CardComponent';
import { NoteCategory } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { db } from '../../firebase';
import { useSprint } from '../../contexts/SprintContext';
import { formatSprintDate } from '../../utils/utils';
import { CATEGORY_DISPLAY, CATEGORY_ORDER } from '../../utils/noteCategories';

import styles from './LiveSprintPanelComponent.module.scss';

interface ILiveSprintPanelComponentProps {
  sprint?: ISprint;
  team: string;
  onCreateSprint: () => void;
}

const LiveSprintPanelComponent = (props: ILiveSprintPanelComponentProps) => {
  const {
    sprint,
    team,
    onCreateSprint
  } = props;

  const navigate = useNavigate();
  const { setSprintId } = useSprint();
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);

  const onCloseSprint = async () => {
    if (!sprint) return;
    try {
      await updateDoc(doc(db, 'sprints', sprint.id), { isOpen: false });
    } catch (error) {
      console.error('Error closing sprint:', error);
    }
  };

  const renderCloseSprintModal = () => {
    return (
      <Modal
        title='Close Sprint'
        withOverlay
        opened={isCloseSprintModalOpen}
        onClose={() => setIsCloseSprintModalOpen(false)}
      >
        <Flex direction='column' gap='xs'>
          <div>
            <p>{`Are you sure you want to close ${sprint?.title}?`}</p>
            <p>You will no longer be able to make any changes to the board or its contents.</p>
          </div>
          <Flex justify='flex-end' gap='md'>
            <Button
              variant='outline'
              onClick={() => setIsCloseSprintModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color='red'
              onClick={async () => {
                await onCloseSprint();
                setIsCloseSprintModalOpen(false);
              }}
            >
              Close
            </Button>
          </Flex>
        </Flex>
      </Modal>
    );
  };

  if (!sprint) {
    return (
      <div className={styles.heroEmpty}>
        <Text fw={600} fz='md'>
          {`No sprint is open for ${team}`}
        </Text>
        <Text fz='sm' c='dimmed' maw={420}>
          Start the next one to begin collecting Good, Bad and Action Items.
        </Text>
        <Button size='md' leftSection={<IconPlus size={16} />} onClick={onCreateSprint}>
          Start a new sprint
        </Button>
      </div>
    );
  }

  const categoryCounts = sprint.counts;

  return (
    <>
      {renderCloseSprintModal()}
      <div className={styles.hero}>
        <span className={styles.heroAccent} />
        <div className={styles.heroMain}>
          <div className={styles.heroHead}>
            <Badge size='xs' variant='light' color='blue'>Open</Badge>
          </div>
          <div className={styles.heroTitle}>{sprint.title}</div>
          <div className={styles.heroMeta}>
            {`Started ${formatSprintDate(sprint.createdAt)}`}
          </div>
        </div>
        <div className={styles.heroCounters}>
          {CATEGORY_ORDER.map((category) => (
            <div
              key={category}
              className={classNames({
                [styles.good]: category === NoteCategory.Good,
                [styles.bad]: category === NoteCategory.Bad,
                [styles.action]: category === NoteCategory.ActionItem
              })}
            >
              <div className={styles.heroNum}>
                {categoryCounts ? (categoryCounts[category] || 0) : '—'}
              </div>
              <div className={styles.heroLabel}>
                {CATEGORY_DISPLAY[category] ?? category}
              </div>
            </div>
          ))}
        </div>
        <div className={styles.heroActions}>
          <Button
            size='md'
            radius='md'
            onClick={() => {
              navigate(`/sprint/${sprint.id}`);
              setSprintId(sprint.id);
            }}
          >
            Open Sprint Board
          </Button>
          <Menu position='bottom-end' withinPortal>
            <Menu.Target>
              <ActionIcon
                variant='subtle'
                color='gray'
                aria-label={`Actions for ${sprint.title}`}
              >
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color='red'
                leftSection={<IconSquareRoundedX size={16} />}
                onClick={() => setIsCloseSprintModalOpen(true)}
              >
                Close Sprint
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    </>
  );
};

export default LiveSprintPanelComponent;
