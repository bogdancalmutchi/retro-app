import React from 'react';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import SprintBoardComponent from './components/SprintBoardComponent';
import HomePage from './components/HomePageComponent';
import { SprintProvider } from './contexts/SprintContext';

const App = () => {

  return (
    <MantineProvider defaultColorScheme='light'>
      <SprintProvider>
        <BrowserRouter basename='/retro-app'>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/sprint/:sprintId' element={<SprintBoardComponent />} />
          </Routes>
        </BrowserRouter>
      </SprintProvider>
    </MantineProvider>
  );
};

export default App;
