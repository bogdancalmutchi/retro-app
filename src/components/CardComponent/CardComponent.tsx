import * as React from 'react';
import { Button, Group, Paper, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import classNames from 'classnames';

import { INote, NoteCategory } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';

import styles from './CardComponent.module.scss';

export interface ISprint {
  id: string;
  title: string;
  team: string;
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
  const categoryCounts = getCategoryCounts(sprint.items);

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

  return (
    <Paper withBorder shadow='md' radius='md' p='xl' className={styles.cardContainer}>
      <Text ta='center' fz='lg' fw={500} mt='sm'>
        {sprint.title}
      </Text>
      <Text ta='center' fz='sm' c='dimmed'>
        {sprint.team}
      </Text>

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
        onClick={() => navigate(`/sprint/${sprint.id}`)}
      >
        Open Sprint Board
      </Button>
    </Paper>
  );
};

export default CardComponent;
