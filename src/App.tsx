import React from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { SprintProvider } from './contexts/SprintContext';
import SprintBoardComponent from './components/SprintBoardComponent';
import HomePageComponent from './components/HomePageComponent/HomePageComponent';
import AuthPageComponent from './components/AuthPageComponent/AuthPageComponent';
import InvitePageComponent from './components/InvitePageComponent/InvitePageComponent';
import ProtectedRoute from './contexts/ProtectedRoute';
import { UserProvider, useUser } from './contexts/UserContext';
import GlobalHeaderWrapper from './components/wrappers/GlobalHeaderWrapper/GlobalHeaderWrapper';
import ConfettiCanvas from './components/shared/ConfettiCanvas/ConfettiCanvas';
import AdminPageComponent from './components/AdminPageComponent/AdminPageComponent';

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

              {/* Redeeming an invite is how an account comes to exist, so this
                  one cannot be behind ProtectedRoute either. */}
              <Route path='/invite/:token' element={<InvitePageComponent />} />

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
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <GlobalHeaderWrapper>
                      <AdminPageComponent />
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
  const { userId, loading } = useUser();

  // Redirect to the homepage if signed in, otherwise to the auth page. Waits
  // for the Firebase session to resolve so a reload does not bounce a
  // signed-in user to /auth.
  React.useEffect(() => {
    if (loading) return;
    navigate(userId ? '/' : '/auth');
  }, [navigate, userId, loading]);

  return null;
};

export default App;
