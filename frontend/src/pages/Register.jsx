import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from '@react-oauth/google';
import axios from "axios";
import "../styles/Register.css";

function Register() {
  const navigate = useNavigate();
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

    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const response = await axios.post(`${backendUrl}/api/auth/register`, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        mobile: formData.mobile,
        address: formData.address,
        email: formData.email,
        password: formData.password,
        dob: formData.dob,
      });

      console.log("Registration success:", response.data);
      localStorage.setItem("userInfo", JSON.stringify(response.data));
      window.location.href = "/";
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const response = await axios.post(`${backendUrl}/api/auth/google`, {
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
        <h2>Create Account</h2>
        {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
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
          <button type="submit" className="register-btn">
            Create Account
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
      </div>
    </div>
  );
}

export default Register;
