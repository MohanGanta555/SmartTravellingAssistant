import React, { useState } from "react";
import axios from "axios";
import "../styles/Login.css";

function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordIssues, setPasswordIssues] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const computePasswordIssues = (pwd) => {
    const issues = [];
    if (!pwd || pwd.length < 8) issues.push("Minimum 8 characters");
    if (!/[A-Z]/.test(pwd)) issues.push("At least one uppercase letter");
    if (!/[a-z]/.test(pwd)) issues.push("At least one lowercase letter");
    if (!/\d/.test(pwd)) issues.push("At least one number");
    if (!/[^\w\s]/.test(pwd)) issues.push("At least one special symbol");
    return issues;
  };

  const handleSendOTP = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const { data } = await axios.post(`${backendUrl}/api/auth/forgot-password`, { email });
      setMessage(data?.message || "OTP sent to your email");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const { data } = await axios.post(`${backendUrl}/api/auth/verify-otp`, { email, otp });
      setMessage(data?.message || "OTP verified successfully");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setMessage("");
    const issues = computePasswordIssues(newPassword);
    if (issues.length > 0) {
      setPasswordIssues(issues);
      setError(issues.join(", "));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match");
      return;
    }
    setLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
      const { data } = await axios.post(`${backendUrl}/api/auth/reset-password`, { 
        email, 
        otp, 
        newPassword 
      });
      setMessage(data?.message || "Password reset successful");
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Forgot Password</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          {step === 1 && "Enter your email to receive a 6-digit OTP."}
          {step === 2 && "Enter the 6-digit OTP sent to your email."}
          {step === 3 && "Create a strong new password."}
        </p>

        {error && <div className="error-message" style={{color: 'red', marginBottom: '10px'}}>{error}</div>}
        {message && <div className="error-message" style={{color: 'green', marginBottom: '10px'}}>{message}</div>}

        {step === 1 && (
          <div>
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
            </div>
            <button 
              type="button" 
              className="login-btn" 
              onClick={handleSendOTP}
              disabled={loading || !email}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="input-group">
              <label>Enter 6-digit OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                required
              />
            </div>
            <button 
              type="button" 
              className="login-btn" 
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button 
              type="button" 
              className="back-btn" 
              onClick={() => setStep(1)}
              style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '1px solid #ddd', color: '#666' }}
            >
              Back
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="input-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordIssues(computePasswordIssues(e.target.value)); }}
                  placeholder="Enter new password"
                  required
                  style={{ paddingRight: 72 }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  title={showNew ? "Hide" : "Show"}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
                >
                  {showNew ? "🙈" : "👁"}
                </button>
              </div>
              {passwordIssues.length > 0 ? (
                <div style={{ color: 'red', fontSize: 12, marginTop: 6 }}>
                  {passwordIssues.map((p, i) => (
                    <div key={i}>• {p}</div>
                  ))}
                </div>
              ) : newPassword ? (
                <div style={{ color: 'green', fontSize: 12, marginTop: 6 }}>
                  Strong password
                </div>
              ) : null}
            </div>
            <div className="input-group">
              <label>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
            <button 
              type="button" 
              className="login-btn" 
              onClick={handleReset}
              disabled={loading || !newPassword || newPassword !== confirmPassword}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        )}

        {step === 4 && (
          <div style={{textAlign: 'center', marginTop: '20px'}}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
            <p>Password reset successful!</p>
            <button 
              type="button" 
              className="login-btn" 
              onClick={() => window.location.href = "/login"}
              style={{ marginTop: '20px' }}
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForgotPassword;
