import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import { Phone as PhoneIcon } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { loginUser, registerUser, clearError } from '../store/authSlice';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`auth-tabpanel-${index}`}
      aria-labelledby={`auth-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState(0);

  const loginForm = useForm({
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const registerForm = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
  });

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    dispatch(clearError());
  };

  const onLogin = async (data) => {
    try {
      await dispatch(loginUser(data)).unwrap();
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error || 'Login failed');
    }
  };

  const onRegister = async (data) => {
    if (data.password !== data.confirmPassword) {
      registerForm.setError('confirmPassword', {
        message: 'Passwords do not match',
      });
      return;
    }

    try {
      const { confirmPassword, ...registerData } = data;
      await dispatch(registerUser(registerData)).unwrap();
      toast.success('Registration successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error || 'Registration failed');
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={6}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 3,
          }}
        >
          {/* Logo and Title */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <PhoneIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography component="h1" variant="h4" gutterBottom>
              WebPhone
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Multi-number Twilio management
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              aria-label="auth tabs"
              variant="fullWidth"
            >
              <Tab label="Sign In" />
              <Tab label="Sign Up" />
            </Tabs>
          </Box>

          {/* Login Form */}
          <TabPanel value={activeTab} index={0}>
            <form onSubmit={loginForm.handleSubmit(onLogin)}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="identifier"
                label="Email or Username"
                autoComplete="email"
                autoFocus
                {...loginForm.register('identifier', {
                  required: 'Email or username is required',
                })}
                error={!!loginForm.formState.errors.identifier}
                helperText={loginForm.formState.errors.identifier?.message}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                {...loginForm.register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                error={!!loginForm.formState.errors.password}
                helperText={loginForm.formState.errors.password?.message}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
                size="large"
              >
                {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
            </form>
          </TabPanel>

          {/* Register Form */}
          <TabPanel value={activeTab} index={1}>
            <form onSubmit={registerForm.handleSubmit(onRegister)}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="First Name"
                  autoFocus
                  {...registerForm.register('firstName', {
                    required: 'First name is required',
                  })}
                  error={!!registerForm.formState.errors.firstName}
                  helperText={registerForm.formState.errors.firstName?.message}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Last Name"
                  {...registerForm.register('lastName', {
                    required: 'Last name is required',
                  })}
                  error={!!registerForm.formState.errors.lastName}
                  helperText={registerForm.formState.errors.lastName?.message}
                />
              </Box>
              <TextField
                margin="normal"
                required
                fullWidth
                label="Username"
                {...registerForm.register('username', {
                  required: 'Username is required',
                  minLength: {
                    value: 3,
                    message: 'Username must be at least 3 characters',
                  },
                })}
                error={!!registerForm.formState.errors.username}
                helperText={registerForm.formState.errors.username?.message}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Email Address"
                type="email"
                autoComplete="email"
                {...registerForm.register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                error={!!registerForm.formState.errors.email}
                helperText={registerForm.formState.errors.email?.message}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Password"
                type="password"
                autoComplete="new-password"
                {...registerForm.register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
                error={!!registerForm.formState.errors.password}
                helperText={registerForm.formState.errors.password?.message}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                label="Confirm Password"
                type="password"
                autoComplete="new-password"
                {...registerForm.register('confirmPassword', {
                  required: 'Please confirm your password',
                })}
                error={!!registerForm.formState.errors.confirmPassword}
                helperText={registerForm.formState.errors.confirmPassword?.message}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
                size="large"
              >
                {isLoading ? <CircularProgress size={24} /> : 'Sign Up'}
              </Button>
            </form>
          </TabPanel>

        </Paper>
      </Box>
    </Container>
  );
};

export default Login;