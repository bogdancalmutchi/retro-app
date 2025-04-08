import React from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import Cookies from 'js-cookie';

import { SprintProvider } from './contexts/SprintContext';
import SprintBoardComponent from './components/SprintBoardComponent';
import HomePageComponent from './components/HomePageComponent/HomePageComponent';
import AuthPageComponent from './components/AuthPageComponent/AuthPageComponent';
import ProtectedRoute from './contexts/ProtectedRoute';
import { UserProvider } from './contexts/UserContext';

const App = () => {
  return (
    <MantineProvider defaultColorScheme='light'>
      <UserProvider>
        <SprintProvider>
          <BrowserRouter basename='/retro-app/'>
            <Routes>
              {/* No protection needed for the login page */}
              <Route path='/auth' element={<AuthPageComponent />} />

              {/* Protect all other routes */}
              <Route
                path='/'
                element={
                  <ProtectedRoute>
                    <HomePageComponent />
                  </ProtectedRoute>
                }
              />
              <Route
                path='/sprint/:sprintId'
                element={
                  <ProtectedRoute>
                    <SprintBoardComponent />
                  </ProtectedRoute>
                }
              />
              {/* Catch-all route for unknown paths */}
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </BrowserRouter>
        </SprintProvider>
      </UserProvider>
    </MantineProvider>
  );
};

const NotFoundRedirect = () => {
  const navigate = useNavigate();

  // Check if the user is logged in by looking for a valid cookie (UUID or user ID)
  const userId = Cookies.get('userId');

  // Redirect to the homepage if logged in, otherwise to the auth page
  React.useEffect(() => {
    if (userId) {
      navigate('/');
    } else {
      navigate('/auth');
    }
  }, [navigate, userId]);

  return null; // This component doesn't render anything directly
};

export default App;
