import * as React from 'react';
import { Avatar, Container, Tabs, Text } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUser } from '../../../contexts/UserContext';
import UserMenuComponent from '../UserMenuComponent/UserMenuComponent';
import AppLogoComponent from '../AppLogoComponent/AppLogoComponent';

import styles from './TabbedHeaderComponent.module.scss';

interface ITabbedHeaderComponentProps {
  onTabChange: (team: string) => void;
  selectedTeam: string;
}

const TabbedHeaderComponent = (props: ITabbedHeaderComponentProps) => {
  const {
    onTabChange,
    selectedTeam
  } = props;

  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === '/';
  const tabs = ['Protoss', 'Tigers'];
  const { displayName, email, userId, team } = useUser();

  return (
    <div className={styles.header}>
      <Container size='100%'>
        <div className={styles.headerContainer}>
          <AppLogoComponent
            className={styles.headerText}
            onClick={() => navigate(`/?team=${encodeURIComponent(team)}`)}
            style={{ cursor: 'pointer' }}
          />
          <UserMenuComponent email={email} displayName={displayName} userId={userId} />
        </div>
        {isHomePage && (
          <Tabs
            value={selectedTeam}
            onChange={onTabChange}
            variant='outline'
            classNames={{
              root: styles.tabs,
              list: styles.tabsList,
              tab: styles.tab,
            }}
          >
            <Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Tab value={tab} key={tab}>
                  {tab}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        )}
      </Container>
    </div>
  );
};

export default TabbedHeaderComponent;
