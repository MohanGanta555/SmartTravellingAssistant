const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000/api');

if (process.env.NODE_ENV === 'production' && !process.env.REACT_APP_API_URL) {
  console.warn("WARNING: REACT_APP_API_URL is not set in production. API calls will likely fail unless a proxy is configured.");
}

export default API_URL;