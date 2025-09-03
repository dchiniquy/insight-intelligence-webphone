import React from 'react';
import { AppBar, Toolbar, Typography, Box, IconButton, Badge } from '@mui/material';
import { Phone as PhoneIcon, Notifications as NotificationsIcon } from '@mui/icons-material';

const Header = () => {
  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <PhoneIcon sx={{ mr: 2 }} />
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          WebPhone
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton size="large" color="inherit">
            <Badge badgeContent={0} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;