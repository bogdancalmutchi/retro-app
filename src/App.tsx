import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { SprintProvider } from './contexts/SprintContext';
import SprintBoardComponent from './components/SprintBoardComponent';
import HomePageComponent from './components/HomePageComponent/HomePageComponent';

const App = () => {

  return (
    <MantineProvider defaultColorScheme='light'>
      <SprintProvider>
        <BrowserRouter basename='/retro-app/'>
          <Routes>
            <Route path='/' element={<HomePageComponent />} />
            <Route path='/sprint/:sprintId' element={<SprintBoardComponent />} />
          </Routes>
        </BrowserRouter>
      </SprintProvider>
    </MantineProvider>
  );
};

export default App;
