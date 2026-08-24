import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useUser } from './UserContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, isAdmin, loading } = useUser();

  // Session lifetime is handled by Firebase, which refreshes its own token, so
  // there are no cookies to keep alive on user activity any more.
  useEffect(() => {
    if (loading) return;

    if (!userId) {
      navigate('/auth', { state: { from: location }, replace: true });
      return;
    }

    if (location.pathname === '/admin' && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [loading, userId, isAdmin, location, navigate]);

  if (loading || !userId) {
    return null;
  }

  if (location.pathname === '/admin' && !isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
