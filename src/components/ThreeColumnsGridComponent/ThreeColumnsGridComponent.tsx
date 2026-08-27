import * as React from 'react';
import { Container, SimpleGrid } from '@mantine/core';
import ColumnComponent from './ColumnComponent';

import styles from './ThreeColumnsGridComponent.module.scss';

export enum NoteCategory {
  Good = 'good',
  Bad = 'bad',
  ActionItem = 'action'
}

export const VOTE_UP = 1;
export const VOTE_DOWN = -1;

export interface INote {
  id: string;
  text: string;
  category: NoteCategory;
  likes: number;
  dislikes: number;
  // Who voted what, keyed by uid. This is the record of who has already voted;
  // likes/dislikes are counters kept in step with it by the same write. Notes
  // created before this field existed simply have no map.
  votes?: Record<string, number>;
  createdBy: string;
  published: boolean;
  order: number;
}

interface IThreeGridComponentProps {
  messages: INote[];
  onAddMessage: (message: string, category: string) => void;
  onNoActionsAllowed: (allowed: boolean) => void;
  noActionsAllowed: boolean;
  highlightedCardId: string | null;
  isPresenter: boolean;
}

const ThreeColumnsGridComponent = (props: IThreeGridComponentProps) => {
  const {
    messages,
    onAddMessage,
    onNoActionsAllowed,
    noActionsAllowed,
    highlightedCardId,
    isPresenter
  } = props;

  const goodMessages = messages.filter((msg) => msg.category === NoteCategory.Good);
  const badMessages = messages.filter((msg) => msg.category === NoteCategory.Bad);
  const actionMessages = messages.filter((msg) => msg.category === NoteCategory.ActionItem);

  return (
    <Container fluid my='sm' className={styles.container}>
      <SimpleGrid cols={3} spacing='sm'>
        <ColumnComponent
          header='The Good'
          messages={goodMessages}
          onSubmit={(message) => onAddMessage(message, 'good')}
          onNoActionsAllowed={onNoActionsAllowed}
          noActionsAllowed={noActionsAllowed}
          highlightedCardId={highlightedCardId}
          isPresenter={isPresenter}
        />
        <ColumnComponent
          header='The Bad'
          messages={badMessages}
          onSubmit={(message) => onAddMessage(message, 'bad')}
          onNoActionsAllowed={onNoActionsAllowed}
          noActionsAllowed={noActionsAllowed}
          highlightedCardId={highlightedCardId}
          isPresenter={isPresenter}
        />
        <ColumnComponent
          header='Action Items'
          messages={actionMessages}
          onSubmit={(message) => onAddMessage(message, 'action')}
          onNoActionsAllowed={onNoActionsAllowed}
          noActionsAllowed={noActionsAllowed}
          highlightedCardId={highlightedCardId}
          isPresenter={isPresenter}
        />
      </SimpleGrid>
    </Container>
  );
};

export default ThreeColumnsGridComponent;
