// pages/auth/reset-password.tsx
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';

const ResetPassword: React.FC = () => {
  const { loading, error } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }
    try {
      // Call your reset password API here
      console.log('Password reset to:', password);
    } catch (err) {
      setResetPasswordError('Failed to reset password, please try again.');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 border rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <Input
          label="New Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your new password"
          error={resetPasswordError}
        />
        <Input
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your new password"
          error={resetPasswordError}
        />
        <button
          type="submit"
          className={`w-full py-2 mt-4 bg-purple-500 text-white rounded ${loading ? 'opacity-50' : ''}`}
          disabled={loading}
        >
          {loading ? 'Resetting password...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
