import axios from 'axios';
import { getStoredToken, removeAuthToken } from '../utils/auth';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeAuthToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (identifier, password) =>
    api.post('/auth/login', { identifier, password }),
    
  register: (userData) =>
    api.post('/auth/register', userData),
    
  getMe: () =>
    api.get('/auth/me'),
    
  refreshToken: () =>
    api.post('/auth/refresh'),
    
  logout: () =>
    api.post('/auth/logout'),
};

// Users API
export const usersAPI = {
  getProfile: () =>
    api.get('/users/profile'),
    
  updateProfile: (data) =>
    api.put('/users/profile', data),
    
  changePassword: (passwordData) =>
    api.put('/users/password', passwordData),
    
  deleteAccount: (data) =>
    api.delete('/users/account', { data }),
};

// Calls API
export const callsAPI = {
  getCalls: (params) =>
    api.get('/calls', { params }),
    
  getCall: (id) =>
    api.get(`/calls/${id}`),
    
  makeCall: (callData) =>
    api.post('/calls', callData),
    
  updateCall: (id, data) =>
    api.put(`/calls/${id}`, data),
    
  deleteCall: (id) =>
    api.delete(`/calls/${id}`),
    
  getCallStats: (params) =>
    api.get('/calls/stats', { params }),
};

// Messages API
export const messagesAPI = {
  getMessages: (params) =>
    api.get('/messages', { params }),
    
  getMessage: (id) =>
    api.get(`/messages/${id}`),
    
  sendMessage: (messageData) =>
    api.post('/messages', messageData),
    
  updateMessage: (id, data) =>
    api.put(`/messages/${id}`, data),
    
  deleteMessage: (id) =>
    api.delete(`/messages/${id}`),
    
  getThreads: (params) =>
    api.get('/messages/threads', { params }),
    
  getConversation: (twilioNumber, otherNumber, params) =>
    api.get(`/messages/conversation/${twilioNumber}/${otherNumber}`, { params }),
    
  markAsRead: (id) =>
    api.put(`/messages/${id}/read`),
    
  markThreadAsRead: (threadId) =>
    api.put(`/messages/thread/${threadId}/read`),
    
  getMessageStats: (params) =>
    api.get('/messages/stats', { params }),
};

export default api;