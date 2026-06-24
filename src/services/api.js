import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const BASE_URL = 'https://contractor-backend-production.up.railway.app/api/v1';
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
};

export const projects = {
  getAll: () => api.get('/projects'),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.patch(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  getDashboard: () => api.get('/projects/dashboard'),
};

export const workers = {
  getAll: () => api.get('/workers'),
  create: (data) => api.post('/workers', data),
  update: (id, data) => api.patch(`/workers/${id}`, data),
  getToday: () => api.get('/workers/attendance/today'),
  markAttendance: (id, data) => api.post(`/workers/${id}/attendance`, data),
};

export const materials = {
  getAll: () => api.get('/materials'),
  getLowStock: () => api.get('/materials/low-stock'),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.patch(`/materials/${id}`, data),
  adjust: (id, delta) => api.post(`/materials/${id}/adjust`, { delta }),
};

export const invoices = {
  getAll: () => api.get('/invoices'),
  getSummary: () => api.get('/invoices/summary'),
  create: (data) => api.post('/invoices', data),
  markPaid: (id) => api.post(`/invoices/${id}/mark-paid`),
};

export const expenses = {
  getAll: () => api.get('/expenses'),
  getSummary: () => api.get('/expenses/summary'),
  create: (data) => api.post('/expenses', data),
};

export default api;