import axios from "axios";

const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const axiosInstance = axios.create({
  baseURL: base,
});

export default axiosInstance;
