import { createSlice } from '@reduxjs/toolkit';
import { getStoredToken } from '../utils/auth';

const websocketSlice = createSlice({
  name: 'websocket',
  initialState: {
    socket: null,
    isConnected: false,
    connectionStatus: 'disconnected', // disconnected, connecting, connected, error
    lastMessage: null,
    subscriptions: [],
  },
  reducers: {
    setSocket: (state, action) => {
      state.socket = action.payload;
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
      state.isConnected = action.payload === 'connected';
    },
    setLastMessage: (state, action) => {
      state.lastMessage = action.payload;
    },
    addSubscription: (state, action) => {
      if (!state.subscriptions.includes(action.payload)) {
        state.subscriptions.push(action.payload);
      }
    },
    removeSubscription: (state, action) => {
      state.subscriptions = state.subscriptions.filter(
        (sub) => sub !== action.payload
      );
    },
    clearSubscriptions: (state) => {
      state.subscriptions = [];
    },
  },
});

export const {
  setSocket,
  setConnectionStatus,
  setLastMessage,
  addSubscription,
  removeSubscription,
  clearSubscriptions,
} = websocketSlice.actions;

// Async action to initialize WebSocket
export const initializeWebSocket = () => (dispatch, getState) => {
  const token = getStoredToken();
  if (!token) return;

  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
  const socket = new WebSocket(`${wsUrl}?token=${token}`);

  dispatch(setConnectionStatus('connecting'));

  socket.onopen = () => {
    console.log('WebSocket connected');
    dispatch(setConnectionStatus('connected'));
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      dispatch(setLastMessage(message));
      
      // Handle different message types
      switch (message.type) {
        case 'new_call':
          // Handle new call notification
          break;
        case 'new_message':
          // Handle new message notification
          break;
        default:
          console.log('WebSocket message:', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
    dispatch(setConnectionStatus('disconnected'));
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    dispatch(setConnectionStatus('error'));
  };

  dispatch(setSocket(socket));
};

export default websocketSlice.reducer;