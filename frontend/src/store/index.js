import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authSlice';
import websocketSlice from './websocketSlice';
import callsSlice from './callsSlice';
import messagesSlice from './messagesSlice';
import uiSlice from './uiSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    websocket: websocketSlice,
    calls: callsSlice,
    messages: messagesSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['websocket/setSocket'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['websocket.socket'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;