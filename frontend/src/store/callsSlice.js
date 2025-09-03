import { createSlice } from '@reduxjs/toolkit';

const callsSlice = createSlice({
  name: 'calls',
  initialState: {
    calls: [],
    activeCall: null,
    isLoading: false,
    error: null,
  },
  reducers: {
    setCalls: (state, action) => {
      state.calls = action.payload;
    },
    addCall: (state, action) => {
      state.calls.unshift(action.payload);
    },
    updateCall: (state, action) => {
      const index = state.calls.findIndex(call => call._id === action.payload._id);
      if (index !== -1) {
        state.calls[index] = action.payload;
      }
    },
    setActiveCall: (state, action) => {
      state.activeCall = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { setCalls, addCall, updateCall, setActiveCall, setLoading, setError } = callsSlice.actions;
export default callsSlice.reducer;