// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/Home.css";

function Home() {
  const navigate = useNavigate();

  // State for form fields
  const [formData, setFormData] = useState({
    source: "",
    destination: "",
    travelers: 1,
    startDate: "",
    endDate: "",
  });

  // State for location coordinates
  const [locationCoords, setLocationCoords] = useState({
    source: { lat: null, lon: null, display_name: "" },
    destination: { lat: null, lon: null, display_name: "" },
  });

  // State for loading and errors
  const [loading, setLoading] = useState({
    source: false,
    destination: false,
  });
  const [errors, setErrors] = useState({
    source: "",
    destination: "",
  });

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Geocode location using Nominatim API
  const geocodeLocation = async (location, type) => {
    if (!location || location.length < 3) {
      // Clear coordinates if location is empty
      setLocationCoords((prev) => ({
        ...prev,
        [type]: { lat: null, lon: null, display_name: "" },
      }));
      return;
    }

    setLoading((prev) => ({ ...prev, [type]: true }));
    setErrors((prev) => ({ ...prev, [type]: "" }));

    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: location,
            format: "json",
            limit: 1,
            addressdetails: 1,
            countrycodes: "in", // Limit to India
          },
          headers: {
            "Accept-Language": "en",
          },
        },
      );

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        setLocationCoords((prev) => ({
          ...prev,
          [type]: {
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            display_name: result.display_name,
          },
        }));
        setErrors((prev) => ({ ...prev, [type]: "" }));
      } else {
        setLocationCoords((prev) => ({
          ...prev,
          [type]: { lat: null, lon: null, display_name: "" },
        }));
        setErrors((prev) => ({
          ...prev,
          [type]: "Location not found. Please try a different name.",
        }));
      }
    } catch (error) {
      console.error(`Error geocoding ${type}:`, error);
      setLocationCoords((prev) => ({
        ...prev,
        [type]: { lat: null, lon: null, display_name: "" },
      }));
      setErrors((prev) => ({
        ...prev,
        [type]: "Failed to geocode location. Please try again.",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  // Handle location search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.source && formData.source.length >= 3) {
        geocodeLocation(formData.source, "source");
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData.source]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.destination && formData.destination.length >= 3) {
        geocodeLocation(formData.destination, "destination");
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData.destination]);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return 0;
    }

    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance);
  };

  // Get current distance between source and destination
  const getCurrentDistance = () => {
    const { source, destination } = locationCoords;
    if (source.lat && source.lon && destination.lat && destination.lon) {
      return calculateDistance(
        source.lat,
        source.lon,
        destination.lat,
        destination.lon,
      );
    }
    return 0;
  };


  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = [];

    if (!formData.source.trim())
      validationErrors.push("Please enter source location");
    if (!formData.destination.trim())
      validationErrors.push("Please enter destination");
    if (!formData.startDate) validationErrors.push("Please select start date");
    if (!formData.endDate) validationErrors.push("Please select end date");

    // Validate that locations were found
    if (!locationCoords.source.lat || !locationCoords.source.lon) {
      validationErrors.push("Please enter a valid source location");
    }
    if (!locationCoords.destination.lat || !locationCoords.destination.lon) {
      validationErrors.push("Please enter a valid destination location");
    }


    if (validationErrors.length > 0) {
      alert(validationErrors.join("\n"));
      return;
    }

    const distance = getCurrentDistance();

    // Prepare trip data to pass to next page
    const tripData = {
      ...formData,
      locationCoords,
      distance,
      calculatedAt: new Date().toISOString(),
    };

    console.log("Trip planning data:", tripData);

    // Redirect to Transportation page with trip data
    navigate("/transportation", { state: { tripData } });
  };

  // Format location display
  const formatLocationDisplay = (type) => {
    const coords = locationCoords[type];
    if (coords.lat && coords.lon) {
      const nameParts = coords.display_name.split(",");
      return `${nameParts[0]}, ${nameParts[1] || ""}`.trim();
    }
    return "";
  };

  return (
    <div className="home-container">
      {/* Header */}
      <header className="header">
        <h1> Smart Trip Planner</h1>
        <p>Design your perfect journey with our intelligent travel companion</p>
      </header>

      <main className="main-content">
        {/* Trip Planning Form */}
        <div className="trip-form-container">
          <h2>Plan Your Next Adventure</h2>
          <p className="form-subtitle">
            Enter your trip details and let us handle the rest
          </p>

          <form onSubmit={handleSubmit} className="trip-form">
            {/* Source and Destination */}
            <div className="form-section">
              <h3>📍 Route Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Starting From</label>
                  <div className="input-with-status">
                    <input
                      type="text"
                      name="source"
                      value={formData.source}
                      onChange={handleChange}
                      placeholder="e.g. Mumbai, Delhi..."
                      required
                      className="form-input"
                      disabled={loading.source}
                    />
                    {loading.source && (
                      <span className="status-indicator status-loading">Searching...</span>
                    )}
                    {locationCoords.source.lat && !loading.source && (
                      <span className="status-indicator status-success">✓ Found</span>
                    )}
                  </div>
                  {errors.source && (
                    <p className="error-text">{errors.source}</p>
                  )}
                  {locationCoords.source.lat && !loading.source && (
                    <p className="status-indicator status-success" style={{ position: 'static', marginTop: 8, fontSize: '0.8rem' }}>
                      📍 {formatLocationDisplay("source")}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Going To</label>
                  <div className="input-with-status">
                    <input
                      type="text"
                      name="destination"
                      value={formData.destination}
                      onChange={handleChange}
                      placeholder="e.g. Goa, Jaipur..."
                      required
                      className="form-input"
                      disabled={loading.destination}
                    />
                    {loading.destination && (
                      <span className="status-indicator status-loading">Searching...</span>
                    )}
                    {locationCoords.destination.lat && !loading.destination && (
                      <span className="status-indicator status-success">✓ Found</span>
                    )}
                  </div>
                  {errors.destination && (
                  <p className="error-text">{errors.destination}</p>
                )}
                {locationCoords.destination.lat && !loading.destination && (
                  <p className="status-indicator status-success" style={{ position: 'static', marginTop: 8, fontSize: '0.8rem' }}>
                    📍 {formatLocationDisplay("destination")}
                  </p>
                )}
              </div>
            </div>
            {locationCoords.source.lat && locationCoords.destination.lat && !loading.source && !loading.destination && (
              <div className="distance-info" style={{ marginTop: '20px', textAlign: 'center', padding: '15px', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                <p style={{ margin: 0, color: '#0369a1', fontWeight: '600', fontSize: '1.1rem' }}>
                  📏 Estimated Distance: <span style={{ color: '#2563eb', fontSize: '1.3rem', fontWeight: '800' }}>{getCurrentDistance()} km</span>
                </p>
              </div>
            )}
          </div>

            {/* Travel Dates */}
            <div className="form-section">
              <h3>📅 Travel Schedule</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Departure Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                    className="form-input"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Return Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    required
                    className="form-input"
                    min={
                      formData.startDate ||
                      new Date().toISOString().split("T")[0]
                    }
                  />
                </div>
              </div>
            </div>

            {/* Travelers */}
            <div className="form-section">
              <h3>👥 Travel Details</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Number of Travelers</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                      type="button"
                      style={{ padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          travelers: Math.max(1, prev.travelers - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', minWidth: '30px', textAlign: 'center' }}>{formData.travelers}</span>
                    <button
                      type="button"
                      style={{ padding: '10px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          travelers: Math.min(20, prev.travelers + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" className="submit-btn">
              🚀 Start Planning Your Trip
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Home;
