import * as React from 'react';
import { Button, Group, Paper, Text } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { INote } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';

import styles from './CardComponent.module.scss';

export interface ISprint {
  id: string;
  title: string;
  team: string;
  items: INote[];
}

const displayNames: Record<string, string> = {
  good: 'Good',
  bad: 'Bad',
  action: 'Action Items'
};

interface ICardComponentProps {
  sprint: ISprint;
}

const CardComponent = (props: ICardComponentProps) => {
  const {
    sprint
  } = props;

  const navigate = useNavigate();

  const categoryCounts = sprint.items.reduce(
    (acc, note) => {
      acc[note.category] = (acc[note.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sortOrder = ['good', 'bad', 'action'];

  const items = Object.entries(categoryCounts)
    .sort(([a], [b]) => sortOrder.indexOf(a) - sortOrder.indexOf(b))
    .map(([key, value]) => (
      <div key={key}>
        <Text ta='center' fz='lg' fw={500}>
          {value}
        </Text>
        <Text ta='center' fz='sm' c='dimmed' lh={1}>
          {displayNames[key]}
        </Text>
      </div>
  ));

  return (
    <Paper withBorder shadow='md' radius='md' p='xl' className={styles.cardContainer}>
      <Text ta='center' fz='lg' fw={500} mt='sm'>
        {sprint.title}
      </Text>
      <Text ta='center' fz='sm' c='dimmed'>
        {sprint.team}
      </Text>
      <Group mt='md' justify='center' gap={30}>
        {items}
      </Group>
      <Button fullWidth radius='md' mt='xl' size='md' variant='default' onClick={() => navigate(`/sprint/${sprint.id}`)}>
        Open Sprint Board
      </Button>
    </Paper>
  );
};

export default CardComponent;
