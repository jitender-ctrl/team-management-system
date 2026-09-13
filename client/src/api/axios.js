import axios from "axios";
import { toast } from "../utils/toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    } else {
      // Surface every other failure instead of failing silently, so a form
      // that "does nothing" on click actually tells you why.
      const message = err.response?.data?.message || err.message || "Something went wrong";
      toast.error(message);
    }
    return Promise.reject(err);
  }
);

export default api;
