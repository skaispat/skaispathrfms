import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { supabase } from '../supabaseClient';
import loginImage from '../assets/logo.jpg';

// Clear language hint on load if needed
localStorage.removeItem('hasSeenLanguageHint');

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Fetch user from Supabase 'users' table
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) {
        // If error is "Row not found", it means invalid username
        if (error.code === 'PGRST116') {
          toast.error('Invalid credentials');
        } else {
          console.error('Supabase error:', error);
          toast.error('Error connecting to login server');
        }
        setSubmitting(false);
        return;
      }

      // 2. Validate Password (Plain text comparison as per existing system)
      if (!user || user.password !== password) {
        toast.error('Invalid credentials');
        setSubmitting(false);
        return;
      }

      // 3. Check if account is active
      if (user.is_active === false) {
        toast.error('Your account has been deactivated. Please contact the administrator.');
        setSubmitting(false);
        return;
      }

      toast.success('Login successful!');

      // 4. Create compatibility object for existing app components
      // The app expects 'Admin' (Yes/No) and 'Name' keys in some places (like Sidebar)
      const userForStore = {
        ...user,
        Name: user.full_name,
        // Map 'role' to 'Admin' for backward compatibility
        Admin: (user.role && user.role.toLowerCase() === 'admin') ? 'Yes' : 'No'
      };

      // 5. Store user session
      localStorage.setItem('user', JSON.stringify(userForStore));
      login(userForStore);

      // 6. Navigate based on role
      const isAdmin = userForStore.Admin === 'Yes';
      if (isAdmin) {
        navigate("/", { replace: true });
      } else {
        navigate("/my-profile", { replace: true });
      }

    } catch (err) {
      console.error('Login exception:', err);
      toast.error('An unexpected error occurred during login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Big Image / Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-50 items-center justify-center relative overflow-hidden p-12">
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Main Image */}
        <div className="relative z-10 w-full max-w-lg">
          <img
            src={loginImage}
            alt="Sarthak TMT"
            className="w-full h-auto object-contain drop-shadow-xl rounded-xl"
          />
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="max-w-[420px] w-full space-y-8">

          {/* Header & Logo Placeholder */}
          <div className="text-center">
            {/* Logo */}
            <div className="mx-auto flex justify-center animate-fade-in-up">
              <img
                src={loginImage}
                alt="Logo"
                className="h-32 w-auto object-contain"
              />
            </div>

            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Please enter your details to sign in.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-gray-50/50 focus:bg-white"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm bg-gray-50/50 focus:bg-white"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/20 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:-translate-y-0.5 ${submitting ? 'opacity-70 cursor-not-allowed hover:bg-indigo-600 hover:translate-y-0' : ''
                }`}
            >
              {submitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
