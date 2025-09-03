import { createSlice } from '@reduxjs/toolkit';

const messagesSlice = createSlice({
  name: 'messages',
  initialState: {
    messages: [],
    threads: [],
    activeThread: null,
    isLoading: false,
    error: null,
  },
  reducers: {
    setMessages: (state, action) => {
      state.messages = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.unshift(action.payload);
    },
    updateMessage: (state, action) => {
      const index = state.messages.findIndex(msg => msg._id === action.payload._id);
      if (index !== -1) {
        state.messages[index] = action.payload;
      }
    },
    setThreads: (state, action) => {
      state.threads = action.payload;
    },
    setActiveThread: (state, action) => {
      state.activeThread = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setMessages, addMessage, updateMessage, setThreads, setActiveThread, setLoading, setError } = messagesSlice.actions;
export default messagesSlice.reducer;