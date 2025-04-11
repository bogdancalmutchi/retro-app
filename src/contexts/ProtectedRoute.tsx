import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

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
    }
  }, [navigate, location]);

  if (loading) {
    return null; // Optionally, you can display a loading spinner here
  }

  return <>{children}</>; // Render the children (protected content) if logged in
};

export default ProtectedRoute;
