import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip
} from '@mui/material';
import { Phone as PhoneIcon, History as HistoryIcon } from '@mui/icons-material';
import { callsAPI } from '../services/api';

const Calls = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('don');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(true);

  // Load call history
  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    try {
      setLoadingCalls(true);
      const response = await callsAPI.getCalls({ limit: 20 });
      setCalls(response.data.data.calls || []);
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setLoadingCalls(false);
    }
  };

  const handleMakeCall = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await callsAPI.makeCall({
        to: phoneNumber,
        twilioNumber,
        message: message || 'Call from WebPhone'
      });

      if (response.data.success) {
        setResult({
          type: 'success',
          message: 'Call initiated successfully!',
          data: response.data.data.call
        });
        // Clear form
        setPhoneNumber('');
        setMessage('');
        // Refresh call history
        loadCalls();
      } else {
        setResult({
          type: 'error',
          message: response.data.error || 'Failed to make call'
        });
      }
    } catch (error) {
      console.error('Error making call:', error);
      setResult({
        type: 'error',
        message: error.response?.data?.error || 'Failed to make call. Please check your connection.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Format +1234567890 as +1 (234) 567-890
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'in-progress': return 'info';
      case 'ringing': return 'warning';
      case 'failed': case 'busy': case 'no-answer': return 'error';
      default: return 'default';
    }
  };

  const twilioNumbers = {
    don: { label: "Don's Number", phone: '+1 (602) 960-9874' },
    demie: { label: "Demie's Number", phone: '+1 (602) 600-0707' },
    business: { label: 'Business Number', phone: '+1 (480) 576-7537' }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        📞 Calls
      </Typography>

      <Grid container spacing={3}>
        {/* Make Call Form */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <PhoneIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Make a Call
              </Typography>
              
              <Box component="form" onSubmit={handleMakeCall} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  required
                  margin="normal"
                  helperText="Include country code (e.g., +1 for US)"
                />

                <FormControl fullWidth margin="normal">
                  <InputLabel>Call From</InputLabel>
                  <Select
                    value={twilioNumber}
                    onChange={(e) => setTwilioNumber(e.target.value)}
                    label="Call From"
                  >
                    {Object.entries(twilioNumbers).map(([key, info]) => (
                      <MenuItem key={key} value={key}>
                        {info.label} ({info.phone})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  label="Message (Optional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Call message or notes"
                  margin="normal"
                  multiline
                  rows={2}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={loading || !phoneNumber.trim()}
                  sx={{ mt: 2 }}
                  startIcon={loading ? <CircularProgress size={20} /> : <PhoneIcon />}
                >
                  {loading ? 'Making Call...' : 'Make Call'}
                </Button>
              </Box>

              {/* Result Display */}
              {result && (
                <Alert severity={result.type} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    {result.message}
                  </Typography>
                  {result.data && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">
                        <strong>Call SID:</strong> {result.data.callSid}
                      </Typography>
                      <Typography variant="caption" display="block">
                        <strong>To:</strong> {result.data.to}
                      </Typography>
                      <Typography variant="caption" display="block">
                        <strong>From:</strong> {result.data.from}
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Call History */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Calls
              </Typography>

              {loadingCalls ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress />
                </Box>
              ) : calls.length > 0 ? (
                <List dense>
                  {calls.map((call, index) => (
                    <React.Fragment key={call._id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body1">
                                {formatPhoneNumber(call.to)}
                              </Typography>
                              <Chip 
                                label={call.status} 
                                size="small" 
                                color={getStatusColor(call.status)}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="textSecondary">
                                From: {twilioNumbers[call.twilioNumber]?.label || call.twilioNumber}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {new Date(call.createdAt).toLocaleString()}
                              </Typography>
                              {call.duration && (
                                <Typography variant="caption" color="textSecondary" display="block">
                                  Duration: {call.duration}s
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < calls.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary" textAlign="center" py={2}>
                  No calls yet. Make your first call!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Calls;