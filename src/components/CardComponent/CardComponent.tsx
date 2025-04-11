import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Flex, Group, Modal, Paper, Text } from '@mantine/core';
import classNames from 'classnames';
import { IconSquareRoundedX } from '@tabler/icons-react';
import { doc, updateDoc } from 'firebase/firestore';

import { INote, NoteCategory } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { db } from '../../firebase';
import { useSprint } from '../../contexts/SprintContext';

import styles from './CardComponent.module.scss';

export interface ISprint {
  id: string;
  title: string;
  team: string;
  isOpen: boolean;
  items: INote[];
}

interface ICardComponentProps {
  sprint: ISprint;
}

const CATEGORY_DISPLAY: Record<string, string> = {
  good: 'Good',
  bad: 'Bad',
  action: 'Action Items'
};

const CATEGORY_ORDER = ['good', 'bad', 'action'];

const getCategoryCounts = (items: INote[]): Record<string, number> => {
  return items.reduce((acc, note) => {
    acc[note.category] = (acc[note.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
};

const CardComponent = ({ sprint }: ICardComponentProps) => {
  const navigate = useNavigate();
  const { setSprintId } = useSprint();
  const categoryCounts = getCategoryCounts(sprint.items);

  const [shouldRenderCloseSprintButton, setShouldRenderCloseSprintButton] = React.useState(false);
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);

  const renderedItems = CATEGORY_ORDER.map((category) => {
    const count = categoryCounts[category] || 0;
    return (
      <div
        key={category}
        className={classNames({
          [styles.good]: category === NoteCategory.Good,
          [styles.bad]: category === NoteCategory.Bad,
          [styles.action]: category === NoteCategory.ActionItem,
        })}
      >
        <Text ta='center' fz='lg' fw={500}>
          {count}
        </Text>
        <Text ta='center' fz='sm' lh={1}>
          {CATEGORY_DISPLAY[category] ?? category}
        </Text>
      </div>
    );
  });

  const onCloseSprint = async () => {
    const itemRef = doc(db, 'sprints', sprint.id);
    await updateDoc(itemRef, { isOpen: false });
  }

  const renderCloseSprintModal = () => {
    return (
      <Modal
        title='Close Sprint'
        withOverlay
        opened={isCloseSprintModalOpen}
        onClose={() => setIsCloseSprintModalOpen(false)}
      >
        <Flex direction='column' gap='xl'>
          <div>{`Are you sure you want to close ${sprint.title}?`}</div>
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
    )
  };

  return (
    <>
      {renderCloseSprintModal()}
      <div
        onMouseEnter={() => setShouldRenderCloseSprintButton(true)}
        onMouseLeave={() => setShouldRenderCloseSprintButton(false)}
      >
        <Flex justify='flex-end' direction='row' gap='xs'>
          {(shouldRenderCloseSprintButton && sprint.isOpen) && (
            <div className={styles.closeSprintButton}>
              <IconSquareRoundedX style={{ cursor: 'pointer' }} color='red' size={20} onClick={() => setIsCloseSprintModalOpen(true)} />
            </div>
          )}
        </Flex>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.cardContainer}>
          <Text ta='center' fz='lg' fw={500} mt='sm'>
            {sprint.title}
          </Text>
          <Flex justify='center' direction='row' gap='xs'>
            <Badge size='xs' variant='light' color={sprint.isOpen ? 'blue' : 'red'}>{sprint.isOpen ? 'Open' : 'Closed'}</Badge>
          </Flex>

          <Group mt='md' justify='center' gap={30}>
            {renderedItems}
          </Group>

          <Button
            className={styles.cardButton}
            fullWidth
            radius='md'
            mt='xl'
            size='md'
            variant='default'
            onClick={() => {
              navigate(`/sprint/${sprint.id}`);
              setSprintId(sprint.id);
            }}
          >
            Open Sprint Board
          </Button>
        </Paper>
      </div>
    </>
  );
};

export default CardComponent;
