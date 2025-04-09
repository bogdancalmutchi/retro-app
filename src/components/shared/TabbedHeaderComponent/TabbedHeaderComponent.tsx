import * as React from 'react';
import { Avatar, Container, Tabs, Text } from '@mantine/core';

import { useUser } from '../../../contexts/UserContext';
import UserMenuComponent from '../UserMenuComponent/UserMenuComponent';

import styles from './TabbedHeaderComponent.module.scss';

interface ITabbedHeaderComponentProps {
  onTabChange: (team: string) => void;
}

const TabbedHeaderComponent = (props: ITabbedHeaderComponentProps) => {
  const {
    onTabChange
  } = props;

  const tabs = ['Protoss', 'Tigers'];
  const { displayName, email, userId } = useUser();

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
              ProtoTigers Retro App
            </Text>
          </div>
          <UserMenuComponent email={email} displayName={displayName} userId={userId} />
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
