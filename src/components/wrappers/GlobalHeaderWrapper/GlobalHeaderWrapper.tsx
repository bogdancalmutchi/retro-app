import * as React from 'react';
import { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container } from '@mantine/core';

import TabbedHeaderComponent from '../../shared/TabbedHeaderComponent/TabbedHeaderComponent';

interface IGlobalHeaderWrapperProps {
  children: ReactNode;
}

const GlobalHeaderWrapper = (props: IGlobalHeaderWrapperProps) => {
  const {
    children
  } = props;

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTeam = searchParams.get('team') || 'Protoss';

  const handleTabChange = (team: string) => {
    setSearchParams({ team });
  };

  return (
    <div>
      <TabbedHeaderComponent
        onTabChange={handleTabChange}
        selectedTeam={selectedTeam}
      />
      <Container size='100%'>
        {children}
      </Container>
    </div>
  );
};

export default GlobalHeaderWrapper;
