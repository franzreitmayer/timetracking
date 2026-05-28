import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export type User = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string;
  end_time: string;
  short_text: string;
  long_text: string | null;
  kostenstelle: string | null;
  kostentraeger: string | null;
  is_travel: boolean;
  is_billable: boolean;
  external_ref1: string | null;
  external_ref2: string | null;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  entry_id: string;
  original_name: string;
  stored_name: string;
  mimetype: string;
  size: number;
  created_at: string;
};

export function attachmentUrl(att: Attachment, download = false): string {
  const token = localStorage.getItem('token') || '';
  return `/api/attachments/file/${att.id}?token=${encodeURIComponent(token)}${download ? '&download=1' : ''}`;
}

export type ExtRefItem = {
  id: string;
  referent: string;
  beschreibung: string | null;
  is_active: boolean;
  created_at: string;
};

export type MasterDataItem = {
  id: string;
  type: 'kostenstelle' | 'kostentraeger';
  code: string;
  label: string;
  is_active: boolean;
};
