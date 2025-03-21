// pages/auth/profile.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const Profile: React.FC = () => {
  const { user, loading, error } = useAuth();
  const [userData, setUserData] = useState(user);

  useEffect(() => {
    if (user) {
      setUserData(user);
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 border rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Profile</h2>
      <div>
        <p><strong>Username:</strong> {userData?.username}</p>
        <p><strong>Email:</strong> {userData?.email}</p>
        <p><strong>Full Name:</strong> {userData?.first_name} {userData?.last_name}</p>
        <p><strong>Referral Code:</strong> {userData?.referral_code}</p>
      </div>
    </div>
  );
};

export default Profile;
