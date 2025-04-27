import React from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import Cookies from 'js-cookie';

import { SprintProvider } from './contexts/SprintContext';
import SprintBoardComponent from './components/SprintBoardComponent';
import HomePageComponent from './components/HomePageComponent/HomePageComponent';
import AuthPageComponent from './components/AuthPageComponent/AuthPageComponent';
import ProtectedRoute from './contexts/ProtectedRoute';
import { UserProvider } from './contexts/UserContext';
import GlobalHeaderWrapper from './components/wrappers/GlobalHeaderWrapper/GlobalHeaderWrapper';
import ConfettiCanvas from './components/shared/ConfettiCanvas/ConfettiCanvas';

const App = () => {
  return (
    <MantineProvider defaultColorScheme='light'>
      <Notifications />
      <UserProvider>
        <SprintProvider>
          <ConfettiCanvas />
          <HashRouter>
            <Routes>
              {/* No protection needed for the login page */}
              <Route path='/auth' element={<AuthPageComponent />} />

              {/* Protect all other routes */}
              <Route
                path='/'
                element={
                  <ProtectedRoute>
                    <GlobalHeaderWrapper>
                      <HomePageComponent />
                    </GlobalHeaderWrapper>
                  </ProtectedRoute>
                }
              />
              <Route
                path='/sprint/:sprintId'
                element={
                  <ProtectedRoute>
                    <GlobalHeaderWrapper>
                      <SprintBoardComponent />
                    </GlobalHeaderWrapper>
                  </ProtectedRoute>
                }
              />
              {/* Catch-all route for unknown paths */}
              <Route path="*" element={<NotFoundRedirect />} />
            </Routes>
          </HashRouter>
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

  return null;
};

export default App;
