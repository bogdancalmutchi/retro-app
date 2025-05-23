import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

import { cookieLifetime } from '../utils/LocalStorage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const refreshCookies = (cookieExpiration: Date) => {
  Cookies.set('userId', Cookies.get('userId') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('displayName', Cookies.get('displayName') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('email', Cookies.get('email') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('userTeam', Cookies.get('userTeam') ?? '', { expires: cookieExpiration, path: '/' });
  Cookies.set('canParty', Cookies.get('canParty') ?? '', { expires: cookieExpiration, path: '/' });
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true); // Add a loading state
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const userId = Cookies.get('userId'); // Get the UUID from cookies
    if (!userId) {
      // Redirect to the auth page if no userId is found
      navigate('/auth', { state: { from: location }, replace: true });
    } else {
      // Fetch user data from Firestore to check if the user is an admin
      const fetchUserData = async () => {
        const userDocRef = doc(db, 'users', userId); // Assuming your users are stored in the 'users' collection
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          setLoading(false);
          const userData = userDoc.data();
          if (userData?.isAdmin) {
            setIsAdmin(true); // Set isAdmin to true if user has admin privileges
          }
          // If the user is not an admin, don't set isAdmin, allowing access to other routes
        } else {
          navigate('/auth'); // Redirect to auth page if user document is not found
        }
      };

      fetchUserData();
    }

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
  }, [navigate, location]);

  if (loading) {
    return null; // Show nothing while loading
  }

  // Only restrict /admin route to admins
  if (location.pathname === '/admin' && !isAdmin) {
    navigate('/'); // Redirect to homepage if the user is not an admin
    return null;
  }

  // Render children (protected content) for all logged-in users
  return <>{children}</>;
};

export default ProtectedRoute;
