import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import axios from "axios";
import "../styles/Register.css";
import API_URL from "../api";

function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Details, 2: OTP
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    mobile: "",
    address: "",
    email: "",
    password: "",
    dob: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [passwordIssues, setPasswordIssues] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const computePasswordIssues = (pwd) => {
    const issues = [];
    if (!pwd || pwd.length < 8) issues.push("Minimum 8 characters");
    if (!/[A-Z]/.test(pwd)) issues.push("At least one uppercase letter");
    if (!/[a-z]/.test(pwd)) issues.push("At least one lowercase letter");
    if (!/\d/.test(pwd)) issues.push("At least one number");
    if (!/[^\w\s]/.test(pwd)) issues.push("At least one special symbol");
    return issues;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (e.target.name === "password") {
      setPasswordIssues(computePasswordIssues(e.target.value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    const issues = computePasswordIssues(formData.password);
    if (issues.length > 0) {
      setPasswordIssues(issues);
      setError(issues.join(", "));
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/send-register-otp`, {
        email: formData.email,
      });
      setStep(2);
      console.log("OTP sent:", response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        ...formData,
        otpCode,
      });

      console.log("Registration success:", response.data);
      sessionStorage.setItem("userInfo", JSON.stringify(response.data));
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
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
      setError(err.response?.data?.message || "Google registration failed");
    }
  };

  const handleGoogleError = () => {
    setError("Google registration was unsuccessful. Try again later.");
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <h2>{step === 1 ? "Create Account" : "Verify Email"}</h2>
        {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
        
        {step === 1 ? (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                required
              />
            </div>
            <div className="input-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                required
              />
            </div>
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
              />
            </div>
            <div className="input-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleChange}
                placeholder="Enter your mobile number"
                required
              />
            </div>
            <div className="input-group">
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Enter your address"
                required
              />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="input-group">
              <label>Date of Birth</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
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
              {passwordIssues.length > 0 ? (
                <div style={{ color: 'red', fontSize: 12, marginTop: 6 }}>
                  {passwordIssues.map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                </div>
              ) : formData.password ? (
                <div style={{ color: 'green', fontSize: 12, marginTop: 6 }}>
                  Strong password
                </div>
              ) : null}
            </div>
            <div className="input-group">
              <label>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  required
                  style={{ paddingRight: 72 }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  title={showConfirm ? "Hide" : "Show"}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                >
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <button type="submit" className="register-btn" disabled={loading}>
              {loading ? "Sending OTP..." : "Register"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndRegister}>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              We've sent a 6-digit OTP to <strong>{formData.email}</strong>. Please enter it below to complete your registration.
            </p>
            <div className="input-group">
              <label>Enter OTP</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                required
              />
            </div>
            <button type="submit" className="register-btn" disabled={loading || otpCode.length !== 6}>
              {loading ? "Verifying..." : "Verify & Create Account"}
            </button>
            <button 
              type="button" 
              className="back-btn" 
              onClick={() => setStep(1)}
              style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid #ddd', color: '#666' }}
            >
              Back to Details
            </button>
          </form>
        )}

        {step === 1 && (
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
        )}
      </div>
    </div>
  );
}

export default Register;
