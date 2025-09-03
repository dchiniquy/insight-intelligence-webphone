import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Header from './Header';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8, // Account for header height
          ml: { sm: '240px' }, // Account for sidebar width on larger screens
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;