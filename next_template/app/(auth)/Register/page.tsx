// pages/auth/register.tsx
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/Input';

const Register: React.FC = () => {
  const { register, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [userType, setUserType] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register(email, password1, password2, userType);
    } catch (err) {
      setRegisterError('Registration failed, please try again.');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 p-6 border rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Register</h2>
      <form onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          error={registerError}
        />
        <Input
          label="Password"
          type="password"
          value={password1}
          onChange={(e) => setPassword1(e.target.value)}
          placeholder="Enter your password"
          error={registerError}
        />
        <Input
          label="Confirm Password"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Confirm your password"
          error={registerError}
        />
        <Input
          label="User Type"
          type="text"
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          placeholder="Enter your user type"
          error={registerError}
        />
        <button
          type="submit"
          className={`w-full py-2 mt-4 bg-green-500 text-white rounded ${loading ? 'opacity-50' : ''}`}
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
};

export default Register;
