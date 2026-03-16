// src/components/Navbar.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { googleLogout } from '@react-oauth/google';
import "../styles/Navbar.css";

function Navbar() {
  const location = useLocation();
  const userInfoString = sessionStorage.getItem("userInfo");
  const userInfo = userInfoString ? JSON.parse(userInfoString) : null;
  const isAuthenticated = !!userInfo;
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  const handleLogout = () => {
    googleLogout();
    sessionStorage.removeItem("userInfo");
    try { localStorage.removeItem("userInfo"); } catch (_) {}
    window.location.href = "/login";
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
           Smart Travelling Assistant
        </Link>
        {!isAuthPage && (
          <div className="nav-links">
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>Home</Link>
            {isAuthenticated ? (
              <>
                <Link to="/profile" className={location.pathname === "/profile" ? "active" : ""}>
                  👤 {userInfo?.firstName}
                </Link>
                <button className="nav-logout" onClick={handleLogout} style={{ border: 'none', cursor: 'pointer', padding: '10px 18px', borderRadius: '12px', fontWeight: 600, fontSize: '0.95rem' }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={location.pathname === "/login" ? "active" : ""}>Login</Link>
                <Link to="/register" className={location.pathname === "/register" ? "active" : ""}>Register</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
