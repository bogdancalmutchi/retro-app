import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // Add a loading state

  useEffect(() => {
    const userId = Cookies.get('userId'); // Get the UUID from cookies
    if (!userId) {
      // If no cookie exists, redirect to the login page
      navigate('/auth');
    } else {
      setLoading(false); // Set loading to false once the user is found
    }
  }, [navigate]);

  if (loading) {
    return null; // Optionally, you can display a loading spinner here
  }

  return <>{children}</>; // Render the children (protected content) if logged in
};

export default ProtectedRoute;
