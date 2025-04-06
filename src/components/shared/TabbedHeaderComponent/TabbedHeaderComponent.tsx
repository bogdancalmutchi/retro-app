import * as React from 'react';
import { Avatar, Button, Container, Image, Tabs, Text } from '@mantine/core';

import styles from './TabbedHeaderComponent.module.scss';

interface ITabbedHeaderComponentProps {
  onTabChange: (team: string) => void;
  onButtonClick: () => void;
}

const TabbedHeaderComponent = (props: ITabbedHeaderComponentProps) => {
  const {
    onTabChange,
    onButtonClick
  } = props;

  const tabs = ['Protoss', 'Tigers'];

  return (
    <div className={styles.header}>
      <Container size='100%'>
        <div className={styles.headerContainer}>
          <div className={styles.headerText}>
            <Avatar radius='md' src='/retro-app/favicon.svg'/>
            <Text
              variant='gradient'
              gradient={{ from: 'indigo', to: 'cyan', deg: 90 }}
            >
              <h1>ProtoTigers Retro App</h1>
            </Text>
          </div>
          <Button
            variant='gradient'
            gradient={{ from: 'cyan', to: 'indigo', deg: 90 }}
            onClick={onButtonClick}
          >
            Create Board
          </Button>
        </div>
        <Tabs
          defaultValue='Protoss'
          variant='outline'
          classNames={{
            root: styles.tabs,
            list: styles.tabsList,
            tab: styles.tab,
          }}
          onChange={(value) => onTabChange(value)}
        >
          <Tabs.List>
            {tabs.map((tab) => (
              <Tabs.Tab value={tab} key={tab}>
                {tab}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </Container>
    </div>
  );
};

export default TabbedHeaderComponent;
