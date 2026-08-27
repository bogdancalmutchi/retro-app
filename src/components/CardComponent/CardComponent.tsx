import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Flex, Group, Paper, Text, Tooltip } from '@mantine/core';
import classNames from 'classnames';
import { Timestamp } from 'firebase/firestore';

import { INote, NoteCategory } from '../ThreeColumnsGridComponent/ThreeColumnsGridComponent';
import { useSprint } from '../../contexts/SprintContext';
import { formatSprintDate } from '../../utils/utils';
import { CATEGORY_DISPLAY, CATEGORY_ORDER, getCategoryCounts } from '../../utils/noteCategories';

import styles from './CardComponent.module.scss';

export interface ISprint {
  id: string;
  title: string;
  team: string;
  isOpen: boolean;
  items?: INote[];
  summary: string;
  createdAt?: Timestamp;
}

interface ICardComponentProps {
  sprint: ISprint;
}

const CardComponent = ({ sprint }: ICardComponentProps) => {
  const navigate = useNavigate();
  const { setSprintId } = useSprint();
  const categoryCounts = sprint.items ? getCategoryCounts(sprint.items) : null;

  const sprintNameRef = useRef<HTMLDivElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = sprintNameRef.current;
    if (el) {
      setTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [sprint.title]);

  const renderedItems = CATEGORY_ORDER.map((category) => {
    const count = categoryCounts ? (categoryCounts[category] || 0) : '—';
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
    <>
      <div>
        <Paper withBorder shadow='md' radius='md' p='xl' className={styles.cardContainer}>
          <Tooltip disabled={!truncated} label={sprint.title}>
            <Text ref={sprintNameRef} truncate='end' ta='center' fz='lg' fw={500} mt='sm'>
              {sprint.title}
            </Text>
          </Tooltip>
          <Flex justify='center' direction='row' gap='xs'>
            <Badge size='xs' variant='light' color={sprint.isOpen ? 'blue' : 'red'}>{sprint.isOpen ? 'Open' : 'Closed'}</Badge>
          </Flex>
          <Text ta='center' fz='xs' c='dimmed' mt={4}>
            {formatSprintDate(sprint.createdAt)}
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
