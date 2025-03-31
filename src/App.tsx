import React from 'react';
import RetroBoardContainer from './components/RetroBoardContainer';
import { MantineProvider } from '@mantine/core';
import "@mantine/core/styles.css";

const App = () => {

  return (
    <MantineProvider defaultColorScheme="light">
      <RetroBoardContainer />
    </MantineProvider>
  );
};

export default App;
