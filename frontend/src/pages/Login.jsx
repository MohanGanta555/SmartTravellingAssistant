import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import axios from "axios";
import "../styles/Login.css";
import API_URL from "../api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotDob, setForgotDob] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const data = response.data || {};
      sessionStorage.setItem("userInfo", JSON.stringify(data));
      if (data.weakPassword) {
        alert("Your password does not meet security requirements. Please change your password (use Forgot Password) to a stronger one with at least 8 characters, uppercase, lowercase, number, and special symbol.");
      }
      window.location.href = data.weakPassword ? "/forgot" : "/";
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await axios.post(`${API_URL}/auth/google`, {
        credential: credentialResponse.credential,
      });

      sessionStorage.setItem("userInfo", JSON.stringify(response.data));
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed");
    }
  };

  const handleGoogleError = () => {
    setError("Google login was unsuccessful. Try again later.");
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Login to TripPlanner</h2>
        {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ paddingRight: 72 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide" : "Show"}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
          <button type="submit" className="login-btn">
            Login
          </button>
        </form>
        <div className="google-login-container" style={{ marginTop: '15px', display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "370403775632-ekl0knt2d7ukm2uk94qde5sqr3gho6ck.apps.googleusercontent.com"}
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            theme="filled_blue"
            shape="rectangular"
          />
        </div>
        <p className="signup-link">
          Don't have an account? <a href="/register">Register here</a>
        </p>
        <p className="signup-link" style={{marginTop: '8px'}}>
          Forgot your password? <a href="/forgot">Reset here</a>
        </p>
        
      </div>
    </div>
  );
}

export default Login;
