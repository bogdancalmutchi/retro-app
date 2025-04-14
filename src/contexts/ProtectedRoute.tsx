import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

import { cookieLifetime } from '../utils/LocalStorage';

const refreshCookies = (cookieExpiration: Date) => {
  Cookies.set('userId', Cookies.get('userId') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('displayName', Cookies.get('displayName') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('email', Cookies.get('email') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('userTeam', Cookies.get('userTeam') ?? '', { expires: cookieExpiration, path: '/' });
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true); // Add a loading state

  useEffect(() => {
    const userId = Cookies.get('userId'); // Get the UUID from cookies
    if (!userId) {
      navigate('/auth', { state: { from: location }, replace: true });
    } else {
      setLoading(false); // Set loading to false once the user is found

      // Add event listeners to refresh the cookie on user activity
      const handleActivity = () => {
        refreshCookies(cookieLifetime);
      };

      const events = ['click', 'keydown'];
      events.forEach((event) => window.addEventListener(event, handleActivity));

      // Clean up event listeners on component unmount
      return () => {
        events.forEach((event) => window.removeEventListener(event, handleActivity));
      };
    }
  }, [navigate, location]);

  if (loading) {
    return null;
  }

  return <>{children}</>; // Render the children (protected content) if logged in
};

export default ProtectedRoute;
