import React from 'react';
import { useDispatch } from 'react-redux';
import { Typography, Box, Card, CardContent, Button } from '@mui/material';
import { logout } from '../store/authSlice';
import toast from 'react-hot-toast';

const Profile = () => {
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
    toast.success('Logged out successfully');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>
      <Card>
        <CardContent>
          <Typography paragraph>User profile and account management coming soon...</Typography>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Profile;