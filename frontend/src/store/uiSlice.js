import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme: 'auto',
    sidebarOpen: true,
    activeNumber: 'don',
    notifications: [],
  },
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setActiveNumber: (state, action) => {
      state.activeNumber = action.payload;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
  },
});

export const { setTheme, setSidebarOpen, setActiveNumber, addNotification, removeNotification } = uiSlice.actions;
export default uiSlice.reducer;