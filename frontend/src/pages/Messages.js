import React from 'react';
import { Typography, Box, Card, CardContent } from '@mui/material';

const Messages = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Messages
      </Typography>
      <Card>
        <CardContent>
          <Typography>Message management coming soon...</Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Messages;