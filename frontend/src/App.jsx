// src/App.jsx
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './App.css';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Places from './pages/Places';
import Hotels from './pages/Hotels';
import Profile from './pages/Profile';
import Transportation from './pages/Transportation';
import Budget from './pages/Budget';
import Itinerary from './pages/Itinerary';

function App() {
  const isAuthenticated = !!sessionStorage.getItem('userInfo');

  useEffect(() => {
    const url = `${process.env.PUBLIC_URL || ""}/home_page1.jpg`;
    document.body.style.backgroundImage = `url('${url}')`;
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "top center";
    document.body.style.backgroundAttachment = "scroll";
    document.body.style.backgroundRepeat = "no-repeat";
    return () => {
      document.body.style.backgroundImage = "";
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "370403775632-ekl0knt2d7ukm2uk94qde5sqr3gho6ck.apps.googleusercontent.com"}>
      <div className="App">
        <Navbar />
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
          />
          <Route
            path="/forgot"
            element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/" replace /> : <Register />}
          />
          <Route
            path="/transportation"
            element={isAuthenticated ? <Transportation /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/places"
            element={isAuthenticated ? <Places /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/hotels"
            element={isAuthenticated ? <Hotels /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/budget"
            element={isAuthenticated ? <Budget /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/itinerary"
            element={isAuthenticated ? <Itinerary /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/profile"
            element={isAuthenticated ? <Profile /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <Home /> : <Landing />}
          />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;
