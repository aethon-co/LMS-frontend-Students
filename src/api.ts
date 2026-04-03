import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://lms-backend-ivory-one.vercel.app/api/student',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const getStudentAttendance = () => api.get('/attendance');

export const uploadAssignmentViaApi = (
  assignmentId: string,
  file: File,
  onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
) =>
  api.put(`/assignments/${assignmentId}/upload`, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    onUploadProgress,
  });
