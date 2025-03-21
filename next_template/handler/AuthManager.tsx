import api from './axiosInstance'; // Import the reusable API instance
import { LOGIN_URL, SIGN_UP_URL, REFRESH_TOKEN_URL, LOGOUT_URL } from './ApiConfig';
import  { AxiosError} from 'axios';

// Define the error response structure
interface ApiErrorResponse {
  detail?: string;
  [key: string]: unknown;
}
// Define the response data structure for authentication
interface AuthResponse {
  access: string;
  refresh: string;
}
// Handler for API errors
const handleApiError = (error: AxiosError<ApiErrorResponse>) => {
  if (error.response && error.response.data) {
    console.error('API Error:', error.response.data);
    throw error.response.data; // Throw detailed API error response
  } else {
    console.error('API Error:', error.message);
    throw error; // Throw general error if no response
  }
};

class AuthManager {
  async login(email: string, password: string): Promise<AuthResponse | undefined> {
    try {
      const response = await api.post<AuthResponse>(LOGIN_URL, { email, password });
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
      return response.data;
    } catch (error) {
      handleApiError(error as AxiosError<ApiErrorResponse>);
    }
  }

  async register(email: string, password1: string, password2: string, user_type: string): Promise<AuthResponse | undefined> {
    try {
      const response = await api.post(SIGN_UP_URL, { email, password1, password2, user_type });
      return response.data;
    } catch (error) {
      handleApiError(error as AxiosError<ApiErrorResponse>);
    }
  }

  async refreshToken(): Promise<AuthResponse | undefined> {
    try {
      const token = localStorage.getItem('refreshToken');
      if (!token) {
        throw new Error('No refresh token found');
      }
      const response = await api.post<AuthResponse>(REFRESH_TOKEN_URL, { refresh: token });
      localStorage.setItem('accessToken', response.data.access);
      return response.data;
    } catch (error) {
      handleApiError(error as AxiosError<ApiErrorResponse>);
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post(LOGOUT_URL);
    } catch (error) {
      handleApiError(error as AxiosError<ApiErrorResponse>);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async getUser() {
    try {
      const response = await api.get('/users/');
      return response.data[0];
    } catch (error) {
      console.error('Failed to fetch user', error);
      handleApiError(error as AxiosError<ApiErrorResponse>);
      throw error;
    }
  }

  async updateUser(id: string, data: FormData) {
    try {
      const response = await api.patch(`/users/${id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      handleApiError(error as AxiosError<ApiErrorResponse>);
      throw error;
    }
  }
}

const authManager = new AuthManager();
export default authManager;
