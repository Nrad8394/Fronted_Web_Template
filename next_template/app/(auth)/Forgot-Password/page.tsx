// pages/auth/forgot-password.tsx
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';

const ForgotPassword: React.FC = () => {
  const { loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Call your forgot password API here
      console.log('Forgot password for email:', email);
    } catch (err) {
      setForgotPasswordError('Failed to reset password, please try again.');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 border rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          error={forgotPasswordError}
        />
        <button
          type="submit"
          className={`w-full py-2 mt-4 bg-yellow-500 text-white rounded ${loading ? 'opacity-50' : ''}`}
          disabled={loading}
        >
          {loading ? 'Sending request...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default ForgotPassword;
