import * as React from 'react';
import { Container, SimpleGrid } from '@mantine/core';
import ColumnComponent from './ColumnComponent';

import styles from './ThreeColumnsGridComponent.module.scss';

export enum NoteCategory {
  Good = 'good',
  Bad = 'bad',
  ActionItem = 'action'
}

export type IMessageType = {
  id: string;
  text: string;
  category: NoteCategory;
  likes: number;
}

interface IThreeGridComponentProps {
  messages: IMessageType[];
  onAddMessage: (message: string, category: string) => void;
}

const ThreeColumnsGridComponent = (props: IThreeGridComponentProps) => {
  const {
    messages,
    onAddMessage
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
        />
        <ColumnComponent
          header='The Bad'
          messages={badMessages}
          onSubmit={(message) => onAddMessage(message, 'bad')}
        />
        <ColumnComponent
          header='Action Items'
          messages={actionMessages}
          onSubmit={(message) => onAddMessage(message, 'action')}
        />
      </SimpleGrid>
    </Container>
  );
};

export default ThreeColumnsGridComponent;
