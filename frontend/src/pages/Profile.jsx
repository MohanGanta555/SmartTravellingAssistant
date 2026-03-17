import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Profile.css';
import API_URL from '../api';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [pwdOld, setPwdOld] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdNewConfirm, setPwdNewConfirm] = useState('');
  const [pwdOtp, setPwdOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdIssues, setPwdIssues] = useState([]);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdMethod, setPwdMethod] = useState(null); // 'current' | 'otp'
  const [pwdOldStatus, setPwdOldStatus] = useState(''); // 'matched' | 'incorrect' | ''
  const computePasswordIssues = (pwd) => {
    const issues = [];
    if (!pwd || pwd.length < 8) issues.push("Minimum 8 characters");
    if (!/[A-Z]/.test(pwd)) issues.push("At least one uppercase letter");
    if (!/[a-z]/.test(pwd)) issues.push("At least one lowercase letter");
    if (!/\d/.test(pwd)) issues.push("At least one number");
    if (!/[^\w\s]/.test(pwd)) issues.push("At least one special symbol");
    return issues;
  };
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    mobile: '',
    address: '',
    bio: '',
    profilePicture: '',
    privacySettings: {
      profileVisibility: 'public',
      showEmail: false
    }
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = React.useRef(null);

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo'));
      if (!userInfo || !userInfo.token) {
        navigate('/login');
        return;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
        },
      };

      const { data } = await axios.get(`${API_URL}/users/profile`, config);
      setUser(data);
      setFormData({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        username: data.username || '',
        email: data.email || '',
        mobile: data.mobile || '',
        address: data.address || '',
        bio: data.bio || '',
        profilePicture: data.profilePicture || '',
        privacySettings: {
            profileVisibility: data.privacySettings?.profileVisibility || 'public',
            showEmail: data.privacySettings?.showEmail || false
        }
      });
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile');
      setLoading(false);
      if (err.response?.status === 401) {
        sessionStorage.removeItem('userInfo');
        navigate('/login');
      }
    }
  };

  const validateForm = () => {
    let errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'First Name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last Name is required';
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.email.trim()) {
        errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        errors.email = 'Email is invalid';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('privacy_')) {
        const settingName = name.replace('privacy_', '');
        setFormData(prev => ({
            ...prev,
            privacySettings: {
                ...prev.privacySettings,
                [settingName]: type === 'checkbox' ? checked : value
            }
        }));
    } else {
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const userInfo = JSON.parse(sessionStorage.getItem('userInfo'));
      const config = {
        headers: {
          Authorization: `Bearer ${userInfo.token}`,
          // Let axios set Content-Type for FormData, but if we send JSON it should be application/json
          // We will decide based on payload
        },
      };

      let responseData;

      if (selectedFile) {
        const data = new FormData();
        data.append('firstName', formData.firstName);
        data.append('lastName', formData.lastName);
        data.append('username', formData.username);
        data.append('email', formData.email);
        data.append('mobile', formData.mobile);
        data.append('address', formData.address);
        data.append('bio', formData.bio);
        data.append('image', selectedFile);
        data.append('privacySettings', JSON.stringify(formData.privacySettings));
        
        const { data: res } = await axios.put(`${API_URL}/users/profile`, data, {
            headers: {
                Authorization: `Bearer ${userInfo.token}`,
                'Content-Type': 'multipart/form-data',
            }
        });
        responseData = res;
      } else {
        const { data: res } = await axios.put(`${API_URL}/users/profile`, formData, config);
        responseData = res;
      }
      
      setUser(responseData);
      // Update local storage if needed (e.g. name changed)
      const updatedUserInfo = { ...userInfo, ...responseData, token: userInfo.token };
      sessionStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
      
      setIsEditing(false);
      setSelectedFile(null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  // Mock Activity Feed
  const activities = [
    { id: 1, text: 'Created a new trip plan to Paris', date: '2 days ago' },
    { id: 2, text: 'Liked a review on "Eiffel Tower"', date: '3 days ago' },
    { id: 3, text: 'Updated profile picture', date: '1 week ago' },
  ];

  if (loading) return <div className="loading-spinner">Loading Profile...</div>;
  if (!user && !loading) return <div className="error-message">User not found</div>;

  return (
    <div className="profile-container">
      {error && <div className="error-message" style={{marginBottom: '20px'}}>{error}</div>}
      
      <div className="profile-header">
        <div className="profile-picture-container">
          {user.profilePicture ? (
            <img src={user.profilePicture} alt="Profile" className="profile-picture" />
          ) : (
            <div className="profile-picture-placeholder">
              {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
            </div>
          )}
          {isEditing && (
            <>
                <button 
                    className="profile-upload-overlay" 
                    onClick={() => fileInputRef.current.click()}
                    aria-label="Change profile picture"
                    style={{border: 'none', width: '100%', height: 'auto'}}
                >
                  Change Photo
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setSelectedFile(file);
                            // Preview
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                setFormData(prev => ({...prev, profilePicture: e.target.result}));
                            };
                            reader.readAsDataURL(file);
                        }
                    }}
                />
            </>
          )}
        </div>
        
        <div className="profile-info">
          <div className="profile-name-row">
            {isEditing ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <input 
                            type="text" 
                            name="firstName" 
                            value={formData.firstName} 
                            onChange={handleInputChange} 
                            className="edit-form-input" 
                            placeholder="First Name"
                            aria-label="First Name"
                            style={{width: '150px'}}
                        />
                        <input 
                            type="text" 
                            name="lastName" 
                            value={formData.lastName} 
                            onChange={handleInputChange} 
                            className="edit-form-input" 
                            placeholder="Last Name"
                            aria-label="Last Name"
                            style={{width: '150px'}}
                        />
                    </div>
                    {formErrors.firstName && <div className="error-message" style={{fontSize: '12px'}}>{formErrors.firstName}</div>}
                    {formErrors.lastName && <div className="error-message" style={{fontSize: '12px'}}>{formErrors.lastName}</div>}
                </div>
            ) : (
                <h1 className="profile-fullname">{user.firstName} {user.lastName}</h1>
            )}
            
            {!isEditing && <span className="profile-username">@{user.username}</span>}
            
            <div className="profile-actions">
              {isEditing ? (
                <>
                  <button className="btn-save-profile" onClick={handleSave}>Save Profile</button>
                  <button className="btn-cancel-profile" onClick={() => {
                      setIsEditing(false);
                      setFormData({
                        firstName: user.firstName,
                        lastName: user.lastName,
                        username: user.username,
                        email: user.email,
                        mobile: user.mobile,
                        address: user.address,
                        bio: user.bio,
                        profilePicture: user.profilePicture,
                        privacySettings: user.privacySettings
                      });
                      setFormErrors({});
                  }}>Cancel</button>
                </>
              ) : (
                <button className="btn-edit-profile" onClick={() => setIsEditing(true)}>Edit Profile</button>
              )}
            </div>
          </div>
          
          {!isEditing && <p className="profile-bio">{user.bio || 'No bio yet.'}</p>}
          {isEditing && (
              <textarea 
                  name="bio" 
                  value={formData.bio} 
                  onChange={handleInputChange} 
                  className="edit-form-textarea" 
                  placeholder="Write a short bio..."
              />
          )}

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-value">{user.followers || 0}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{user.following || 0}</span>
              <span className="stat-label">Following</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">0</span>
              <span className="stat-label">Posts</span>
            </div>
          </div>
          
          <div className="profile-meta">
            <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            {user.privacySettings?.showEmail && <span>{user.email}</span>}
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="main-content">
          {isEditing ? (
            <div className="edit-section">
              <h2 className="section-title">Edit Personal Information</h2>
              
              <div className="edit-form-group">
                <label className="edit-form-label">Username</label>
                <input 
                    type="text" 
                    name="username" 
                    value={formData.username} 
                    onChange={handleInputChange} 
                    className="edit-form-input" 
                />
                {formErrors.username && <div className="error-message">{formErrors.username}</div>}
              </div>

              <div className="edit-form-group">
                <label className="edit-form-label">Email</label>
                <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleInputChange} 
                    className="edit-form-input" 
                />
                {formErrors.email && <div className="error-message">{formErrors.email}</div>}
              </div>

              <div className="edit-form-group">
                <label className="edit-form-label">Mobile</label>
                <input 
                    type="text" 
                    name="mobile" 
                    value={formData.mobile} 
                    onChange={handleInputChange} 
                    className="edit-form-input" 
                />
              </div>

              <div className="edit-form-group">
                <label className="edit-form-label">Address</label>
                <input 
                    type="text" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    className="edit-form-input" 
                />
              </div>
              
              <h2 className="section-title" style={{marginTop: '30px'}}>Privacy Settings</h2>
              <div className="privacy-setting">
                  <div className="edit-form-checkbox-group">
                      <input 
                        type="checkbox" 
                        name="privacy_showEmail" 
                        checked={formData.privacySettings.showEmail} 
                        onChange={handleInputChange} 
                      />
                      <label>Show Email on Profile</label>
                  </div>
              </div>
              <div className="privacy-setting">
                  <label className="edit-form-label">Profile Visibility</label>
                  <select 
                    name="privacy_profileVisibility" 
                    value={formData.privacySettings.profileVisibility} 
                    onChange={handleInputChange}
                    className="edit-form-input"
                  >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                  </select>
              </div>

              <div style={{display:'flex', justifyContent:'flex-start', marginTop: '30px'}}>
                <button 
                  className="btn-edit-profile"
                  type="button"
                  onClick={() => { setChangePwdOpen(o => !o); setPwdMethod(null); setPwdErr(''); setPwdMsg(''); }}
                >
                  Change Password
                </button>
              </div>
              {changePwdOpen && (
                <div style={{ marginTop: 12, padding: '12px', border: '1px solid #eee', borderRadius: 8 }}>
                  <div className="edit-form-group" style={{ marginBottom: 12 }}>
                    <label className="edit-form-label">Choose Method</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <label><input type="radio" name="pwdMethod" checked={pwdMethod === 'current'} onChange={() => setPwdMethod('current')} /> Use Current Password</label>
                      <label><input type="radio" name="pwdMethod" checked={pwdMethod === 'otp'} onChange={() => { setPwdMethod('otp'); setOtpSent(false); setOtpVerified(false); setPwdOtp(''); }} /> Use OTP (Verify Email)</label>
                    </div>
                  </div>
                  {pwdMethod === 'current' && (
                    <>
                      <div className="edit-form-group">
                        <label className="edit-form-label">Current Password</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type={showOld ? "text" : "password"} 
                            value={pwdOld} 
                            onChange={(e) => { setPwdOld(e.target.value); setPwdOldStatus(''); }}
                            onBlur={async () => {
                              setPwdOldStatus('');
                              if (!pwdOld) return;
                              try {
                                const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
                                const { data } = await axios.post(`${API_URL}/users/verify-password`, { password: pwdOld }, {
                                  headers: { Authorization: `Bearer ${userInfo.token}` }
                                });
                                setPwdOldStatus(data?.ok ? 'matched' : 'incorrect');
                              } catch (_) {
                                setPwdOldStatus('incorrect');
                              }
                            }}
                            placeholder="Enter your current password"
                            className="edit-form-input"
                            style={{ paddingRight: 72 }}
                          />
                          <button type="button" onClick={() => setShowOld(s => !s)} aria-label={showOld ? "Hide password" : "Show password"} title={showOld ? "Hide" : "Show"} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', padding:0, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}>{showOld ? "🙈" : "👁"}</button>
                        </div>
                        {pwdOldStatus === 'matched' && <div style={{ color: 'green', fontSize: 12, marginTop: 4 }}>Current password matched</div>}
                        {pwdOldStatus === 'incorrect' && <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>Incorrect current password</div>}
                      </div>
                      <div className="edit-form-group">
                        <label className="edit-form-label">New Password</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type={showNew ? "text" : "password"} 
                            value={pwdNew} 
                            onChange={(e) => { setPwdNew(e.target.value); setPwdIssues(computePasswordIssues(e.target.value)); }} 
                            placeholder="Enter new password"
                            className="edit-form-input"
                            style={{ paddingRight: 72 }}
                          />
                          <button type="button" onClick={() => setShowNew(s => !s)} aria-label={showNew ? "Hide password" : "Show password"} title={showNew ? "Hide" : "Show"} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', padding:0, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}>{showNew ? "🙈" : "👁"}</button>
                        </div>
                        {pwdIssues.length > 0 ? (<div style={{ color:'red', fontSize:12, marginTop:6 }}>{pwdIssues.map((p,i)=>(<div key={i}>• {p}</div>))}</div>) : (pwdNew ? <div style={{ color:'green', fontSize:12, marginTop:6 }}>Strong password</div> : null)}
                      </div>
                      <div className="edit-form-group">
                        <label className="edit-form-label">Confirm New Password</label>
                        <div style={{ position: 'relative' }}>
                          <input 
                            type={showConfirm ? "text" : "password"} 
                            value={pwdNewConfirm} 
                            onChange={(e) => setPwdNewConfirm(e.target.value)} 
                            placeholder="Confirm new password"
                            className="edit-form-input"
                            style={{ paddingRight: 72 }}
                          />
                          <button type="button" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? "Hide password" : "Show password"} title={showConfirm ? "Hide" : "Show"} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', padding:0, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}>{showConfirm ? "🙈" : "👁"}</button>
                        </div>
                      </div>
                      {pwdErr && <div className="error-message" style={{marginTop: 6}}>{pwdErr}</div>}
                      {pwdMsg && <div className="success-message" style={{marginTop: 6, color: 'green'}}>{pwdMsg}</div>}
                      <button className="btn-edit-profile" type="button" onClick={async () => {
                        setPwdErr(''); setPwdMsg('');
                        if (pwdNew !== pwdNewConfirm) { setPwdErr('New password and confirm password must match'); return; }
                        const issues = computePasswordIssues(pwdNew);
                        if (issues.length > 0) { setPwdIssues(issues); setPwdErr(issues.join(', ')); return; }
                        try {
                            const userInfo = JSON.parse(sessionStorage.getItem('userInfo') || '{}');
                            await axios.post(`${API_URL}/users/change-password`, { oldPassword: pwdOld, newPassword: pwdNew }, { headers: { Authorization: `Bearer ${userInfo.token}` } });
                            setPwdMsg('Password updated successfully');
                          setPwdOld(''); setPwdNew(''); setPwdNewConfirm(''); setPwdIssues([]);
                          setChangePwdOpen(false); setPwdMethod(null);
                        } catch (e) { setPwdErr(e.response?.data?.message || 'Failed to change password'); }
                      }}>Update Password</button>
                    </>
                  )}
                  {pwdMethod === 'otp' && (
                    <>
                      {!otpSent && (
                        <div className="edit-form-group">
                          <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                            We will send a 6-digit OTP to your registered email: <strong>{user?.email}</strong>
                          </p>
                          <button 
                            className="btn-edit-profile" 
                            type="button" 
                            disabled={otpLoading}
                            onClick={async () => {
                              setOtpLoading(true);
                              setPwdErr('');
                              try {
                                await axios.post(`${API_URL}/auth/forgot-password`, { email: user?.email });
                                setOtpSent(true);
                                setPwdMsg('OTP sent successfully');
                              } catch (e) {
                                setPwdErr(e.response?.data?.message || 'Failed to send OTP');
                              } finally {
                                setOtpLoading(false);
                              }
                            }}
                          >
                            {otpLoading ? 'Sending...' : 'Send OTP'}
                          </button>
                        </div>
                      )}

                      {otpSent && !otpVerified && (
                        <div className="edit-form-group">
                          <label className="edit-form-label">Enter 6-digit OTP</label>
                          <input 
                            type="text" 
                            value={pwdOtp} 
                            onChange={(e) => setPwdOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                            placeholder="000000"
                            className="edit-form-input"
                            style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px' }}
                          />
                          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button 
                              className="btn-edit-profile" 
                              type="button" 
                              disabled={otpLoading || pwdOtp.length !== 6}
                              onClick={async () => {
                                setOtpLoading(true);
                                setPwdErr('');
                                try {
                                  await axios.post(`${API_URL}/auth/verify-otp`, { email: user?.email, otp: pwdOtp });
                                  setOtpVerified(true);
                                  setPwdMsg('OTP verified successfully');
                                } catch (e) {
                                  setPwdErr(e.response?.data?.message || 'Invalid OTP');
                                } finally {
                                  setOtpLoading(false);
                                }
                              }}
                            >
                              {otpLoading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                            <button 
                              className="btn-cancel-profile" 
                              type="button" 
                              onClick={() => { setOtpSent(false); setPwdOtp(''); setPwdErr(''); }}
                            >
                              Resend
                            </button>
                          </div>
                        </div>
                      )}

                      {otpVerified && (
                        <>
                          <div className="edit-form-group">
                            <label className="edit-form-label">New Password</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showNew ? "text" : "password"} 
                                value={pwdNew} 
                                onChange={(e) => { setPwdNew(e.target.value); setPwdIssues(computePasswordIssues(e.target.value)); }} 
                                placeholder="Enter new password"
                                className="edit-form-input"
                                style={{ paddingRight: 72 }}
                              />
                              <button type="button" onClick={() => setShowNew(s => !s)} aria-label={showNew ? "Hide password" : "Show password"} title={showNew ? "Hide" : "Show"} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', padding:0, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}>{showNew ? "🙈" : "👁"}</button>
                            </div>
                            {pwdIssues.length > 0 ? (<div style={{ color:'red', fontSize:12, marginTop:6 }}>{pwdIssues.map((p,i)=>(<div key={i}>• {p}</div>))}</div>) : (pwdNew ? <div style={{ color:'green', fontSize:12, marginTop:6 }}>Strong password</div> : null)}
                          </div>
                          <div className="edit-form-group">
                            <label className="edit-form-label">Confirm New Password</label>
                            <div style={{ position: 'relative' }}>
                              <input 
                                type={showConfirm ? "text" : "password"} 
                                value={pwdNewConfirm} 
                                onChange={(e) => setPwdNewConfirm(e.target.value)} 
                                placeholder="Confirm new password"
                                className="edit-form-input"
                                style={{ paddingRight: 72 }}
                              />
                              <button type="button" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? "Hide password" : "Show password"} title={showConfirm ? "Hide" : "Show"} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', padding:0, border:'none', background:'transparent', cursor:'pointer', fontSize:18, lineHeight:1 }}>{showConfirm ? "🙈" : "👁"}</button>
                            </div>
                          </div>
                          <button className="btn-edit-profile" type="button" onClick={async () => {
                            setPwdErr(''); setPwdMsg('');
                            if (pwdNew !== pwdNewConfirm) { setPwdErr('New password and confirm password must match'); return; }
                            const issues = computePasswordIssues(pwdNew);
                            if (issues.length > 0) { setPwdIssues(issues); setPwdErr(issues.join(', ')); return; }
                            try {
                              await axios.post(`${API_URL}/auth/reset-password`, { email: user?.email, otp: pwdOtp, newPassword: pwdNew });
                              setPwdMsg('Password updated successfully');
                              setPwdNew(''); setPwdNewConfirm(''); setPwdIssues([]); setPwdOtp('');
                              setOtpSent(false); setOtpVerified(false);
                              setChangePwdOpen(false); setPwdMethod(null);
                            } catch (e) { setPwdErr(e.response?.data?.message || 'Failed to reset password'); }
                          }}>Update Password</button>
                        </>
                      )}
                      {pwdErr && <div className="error-message" style={{marginTop: 6}}>{pwdErr}</div>}
                      {pwdMsg && <div className="success-message" style={{marginTop: 6, color: 'green'}}>{pwdMsg}</div>}
                    </>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div className="activity-feed">
              <h2 className="section-title">🕒 Your Travel History</h2>
              {Array.isArray(user.plans) && user.plans.length > 0 ? (
                user.plans.map((p, idx) => (
                  <div key={idx} className="activity-item">
                    <div className="activity-date">
                      📅 Planned on {new Date(p.createdAt || Date.now()).toLocaleDateString()}
                    </div>
                    <div className="activity-text">
                      📍 {p.source} → {p.destination}
                      <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                        🗓️ {new Date(p.startDate).toLocaleDateString()} to {new Date(p.endDate).toLocaleDateString()} • 👥 {p.travelers} traveler(s)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button
                        className="btn-edit-profile"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                          navigate('/itinerary', { state: { tripData: { ...p, viewOnly: true } } });
                        }}
                      >
                        🔍 View Itinerary
                      </button>
                      <button
                        className="btn-cancel-profile"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={async () => {
                          if (window.confirm("Are you sure you want to delete this trip?")) {
                            try {
                              const userInfo = JSON.parse(sessionStorage.getItem('userInfo'));
                              await axios.delete(`${API_URL}/users/plans/${idx}`, {
                                headers: { Authorization: `Bearer ${userInfo.token}` }
                              });
                              fetchUserProfile();
                            } catch (e) {
                              setError(e.response?.data?.message || 'Failed to delete plan');
                            }
                          }
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="activity-item" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="activity-text" style={{ color: '#94a3b8' }}>No planned trips yet. Start your first adventure!</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sidebar">
            <h2 className="section-title">About</h2>
            <div className="sidebar-item">
                <strong>Email:</strong> {user.email}
            </div>
            <div className="sidebar-item" style={{marginTop: '10px'}}>
                <strong>Location:</strong> {user.address}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
