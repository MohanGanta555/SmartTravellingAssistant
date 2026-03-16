// src/pages/Hotels.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Hotels.css";

function Hotels() {
  const location = useLocation();
  const navigate = useNavigate();

  // Get tripData from location state first, then try localStorage as fallback
  const [tripData, setTripData] = useState(() => {
    // First try to get from navigation state
    if (location.state?.tripData) {
      // Also save to localStorage as backup
      try {
        localStorage.setItem('tripData', JSON.stringify(location.state.tripData));
        return location.state.tripData;
      } catch (e) {
        console.error("Error saving to localStorage:", e);
        return location.state.tripData;
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('tripData');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse tripData from localStorage:", e);
    }

    return null;
  });

  // State for selected hotels
  const [selectedHotels, setSelectedHotels] = useState([]);

  // State for manually added hotel
  const [manualHotel, setManualHotel] = useState({
    name: "",
    type: "hotel",
    estimatedCost: "",
    rating: ""
  });

  // State for popular hotels near destination
  const [popularHotels, setPopularHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGooglePlaces = (apiKey) => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve(window.google);
        return;
      }
      const id = "google-maps-js";
      const existing = document.getElementById(id);
      const checkReady = () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          resolve(window.google);
        } else {
          setTimeout(checkReady, 100);
        }
      };
      if (existing) {
        checkReady();
        return;
      }
      const script = document.createElement("script");
      script.id = id;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => reject(new Error("Google Maps JS failed to load"));
      document.body.appendChild(script);
    });
  };

  // Fetch hotels near destination
  const fetchHotels = useCallback(async () => {
    if (!tripData) {
      setLoading(false);
      setError("Trip data is missing");
      return;
    }

    if (!tripData.locationCoords || !tripData.locationCoords.destination) {
      setLoading(false);
      setError("Destination coordinates not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { destination } = tripData.locationCoords;
      // Ensure we have coordinates
      const lat = destination?.lat;
      const lon = destination?.lon;
      
      if (!lat || !lon) {
        throw new Error("Invalid destination coordinates");
      }

      const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;

      if (!API_KEY) {
        setError("Google Places API key missing. Unable to load hotels.");
        setPopularHotels([]);
        setLoading(false);
        return;
      }

      const google = await loadGooglePlaces(API_KEY);
      const service = new google.maps.places.PlacesService(document.createElement("div"));
      const req = {
        location: new google.maps.LatLng(lat, lon),
        radius: 20000,
        type: "lodging",
        keyword: "hotel"
      };
      const { res: nearRes, status: nearStatus } = await new Promise((resolve) => {
        service.nearbySearch(req, (res, status) => resolve({ res, status }));
      });

      let results = Array.isArray(nearRes) ? nearRes : [];
      if (nearStatus !== google.maps.places.PlacesServiceStatus.OK) {
        if (nearStatus === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          const textReq = {
            query: "hotel",
            location: new google.maps.LatLng(lat, lon),
            radius: 20000
          };
          const { res: textRes } = await new Promise((resolve) => {
            service.textSearch(textReq, (r, s) => resolve({ res: r, status: s }));
          });
          results = Array.isArray(textRes) ? textRes : [];
        } else {
          throw new Error(`Google Places status: ${nearStatus}`);
        }
      }

      const toRad = (v) => (v * Math.PI) / 180;
      const distKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      if (Array.isArray(results)) {
        const mappedHotels = results.map((p, index) => {
          const name = p.name || "";
          const types = p.types || [];
          const isHotel = /hotel/i.test(name);
          const excluded = /(hostel|tiffin|dhaba|canteen|mess)/i.test(name) || types.includes('hostel');
          if (!isHotel || excluded) return null;
          let estimatedCost = Math.floor(Math.random() * 4000) + 2500;
          const rating = p.rating ? String(p.rating) : (4.0 + Math.random() * 1.0).toFixed(1);
          let photoUrl = "";
          if (p.photos && p.photos[0] && typeof p.photos[0].getUrl === "function") {
            photoUrl = p.photos[0].getUrl({ maxWidth: 640, maxHeight: 480 });
          }
          const hLat = p.geometry?.location?.lat ? p.geometry.location.lat() : undefined;
          const hLon = p.geometry?.location?.lng ? p.geometry.location.lng() : undefined;
          const dKm = hLat !== undefined && hLon !== undefined ? distKm(lat, lon, hLat, hLon) : null;
          return {
            id: p.place_id || index + 200,
            name,
            type: 'hotel',
            category: 'Hotel',
            estimatedCost,
            rating,
            coordinates: { lat: hLat || p.geometry?.location?.lat, lon: hLon || p.geometry?.location?.lng },
            address: p.vicinity || '',
            photoUrl,
            distanceKm: dKm
          };
        }).filter(Boolean);
        const deduped = [];
        const seen = new Set();
        for (const p of mappedHotels) {
          const key = p.name.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(p);
          }
        }
        if (deduped.length === 0) {
          setError("No hotels found near this location.");
        }
        setPopularHotels(deduped);
      } else {
        setPopularHotels([]);
        setError("No hotels found near this location.");
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching hotels:", error);
      setError("Failed to load hotels. Please try again.");
      setLoading(false);
    }
  }, [tripData]);

  // Update tripData if location.state changes
  useEffect(() => {
    if (location.state?.tripData) {
      setTripData(location.state.tripData);
      try {
        localStorage.setItem('tripData', JSON.stringify(location.state.tripData));
      } catch (e) {
        console.error("Error saving to localStorage:", e);
      }
    }
  }, [location.state]);

  // Load hotels when component mounts or tripData changes
  useEffect(() => {
    if (!tripData) {
      setLoading(false);
      return;
    }

    if (tripData?.locationCoords?.destination) {
      fetchHotels();
    } else {
      setLoading(false);
      setError("Destination coordinates not found. Please try again.");
    }
  }, [tripData, fetchHotels]);

  // Toggle hotel selection (Single selection mode for now, but keeping array structure)
  const toggleHotelSelection = (hotel) => {
    setSelectedHotels(prev => {
      // If already selected, remove it
      if (prev.some(h => h.id === hotel.id)) {
        return [];
      } else {
        // Select this one (replacing any previous selection)
        return [hotel];
      }
    });
  };

  // Handle manual hotel input change
  const handleManualInputChange = (e) => {
    const { name, value } = e.target;
    setManualHotel(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add manual hotel
  const addManualHotel = () => {
    if (!manualHotel.name.trim()) {
      alert("Please enter a hotel name");
      return;
    }

    if (!manualHotel.estimatedCost || isNaN(manualHotel.estimatedCost)) {
      alert("Please enter a valid estimated cost");
      return;
    }

    if (!tripData?.locationCoords?.destination) {
      alert("Trip data is missing");
      return;
    }

    const newHotel = {
      id: Date.now(),
      name: manualHotel.name,
      type: manualHotel.type,
      category: "Custom",
      estimatedCost: parseInt(manualHotel.estimatedCost),
      rating: manualHotel.rating || "N/A",
      coordinates: tripData.locationCoords.destination,
      isCustom: true
    };

    setSelectedHotels([newHotel]); // Replace existing selection

    // Reset form
    setManualHotel({
      name: "",
      type: "hotel",
      estimatedCost: "",
      rating: ""
    });
  };

  // Remove selected hotel
  const removeHotel = (hotelId) => {
    setSelectedHotels(prev => prev.filter(h => h.id !== hotelId));
  };

  // Calculate total cost (Hotel Cost * Days)
  const calculateTotals = () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const diffDays = Math.round(Math.abs((startDate - endDate) / oneDay)) || 1;
    const travelers = Number(tripData.travelers || 1);
    const primaryTransport = Number(tripData.primaryTransportCost || 0);
    const hotelsCostPerNight = selectedHotels.reduce((total, hotel) => total + Number(hotel.estimatedCost || 0), 0);
    const accommodationCost = hotelsCostPerNight * diffDays;
    const destKey = (tripData.destination || '').toLowerCase();
    const tier1 = ['bengaluru','bangalore','banglore','hyderabad','mumbai','delhi','chennai','kolkata','pune','ahmedabad','jaipur'];
    const localPerDay = tier1.includes(destKey) ? 400 : 250;
    const localTransportCost = localPerDay * diffDays * travelers;
    const foodPerDayPerTraveler = 500;
    const foodCost = foodPerDayPerTraveler * diffDays * travelers;
    const minTotal = primaryTransport + accommodationCost + localTransportCost + foodCost;
    return { diffDays, accommodationCost, localTransportCost, foodCost, minTotal, primaryTransport };
  };

  const goToBudget = () => {
    navigate('/budget', { state: { tripData, selectedHotels } });
  };

  // Go back to places
  const handleBack = () => {
    navigate('/places', { state: { tripData } });
  };

  // Hotel type icons
  const getHotelIcon = (type) => {
    switch (type) {
      case 'hotel': return '🏨';
      case 'hostel': return '🛏️';
      case 'motel': return '🏨';
      case 'resort': return '🏖️';
      case 'apartment': return '🏢';
      case 'guest_house': return '🏠';
      default: return '🏨';
    }
  };

  // Early return for no trip data
  if (!tripData) {
    return (
      <div className="hotels-container">
        <div className="error-message">
          <h2>No Trip Data Found</h2>
          <p>Please plan your trip first from the Home page.</p>
          <button onClick={() => navigate('/')} className="back-button">
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hotels-container">
      {/* Header */}
      <header className="hotels-header">
        <h1>🏨 Select Your Accommodation</h1>
        <p>Choose top-rated hotels near {tripData?.destination || 'your destination'}</p>
        {tripData && (
          <div className="trip-summary">
            <span>📍 {tripData.source} → {tripData.destination}</span>
            <span>👥 {tripData.travelers} traveler(s)</span>
            <span>📅 {new Date(tripData.startDate).toLocaleDateString()} - {new Date(tripData.endDate).toLocaleDateString()}</span>
          </div>
        )}
      </header>

      <main className="hotels-main">
        <div className="hotels-content">
          {/* Popular Hotels Section */}
          <div className="popular-hotels-section">
            <h2>🏆 Recommended Hotels</h2>
            <p className="section-subtitle">Select a place to stay (Cost per night)</p>

            {loading ? (
              <div className="skeleton-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-card">
                    <div className="skeleton-image"></div>
                    <div>
                      <div className="skeleton-line md"></div>
                      <div className="skeleton-line sm"></div>
                      <div className="skeleton-line lg"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="error">{error}</div>
            ) : (
              <div className="hotels-grid">
                {popularHotels.map(hotel => (
                  <div 
                    key={hotel.id} 
                    className={`hotel-card ${selectedHotels.some(h => h.id === hotel.id) ? 'selected' : ''}`}
                    onClick={() => toggleHotelSelection(hotel)}
                  >
                    <div className="hotel-image">
                      {hotel.photoUrl ? (
                        <img src={hotel.photoUrl} alt={hotel.name} />
                      ) : null}
                      <div className="image-badge">Hotel</div>
                    </div>
                    <div className="hotel-details">
                      <h3>{hotel.name}</h3>
                      <div className="hotel-meta">
                        <span className="rating-chip">⭐ {hotel.rating}</span>
                        {hotel.distanceKm ? (
                          <span className="distance-chip">{hotel.distanceKm.toFixed(1)} km away</span>
                        ) : null}
                        {hotel.address ? <span>{hotel.address}</span> : null}
                      </div>
                      <div className="hotel-info">
                        <span className="hotel-cost">₹{hotel.estimatedCost}/night</span>
                      </div>
                    </div>
                    <div className="hotel-checkbox">
                      <input 
                        type="radio" 
                        checked={selectedHotels.some(h => h.id === hotel.id)} 
                        onChange={() => {}} // Handled by div click
                        name="selectedHotel"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Hotel Section */}
          <div className="custom-hotel-section">
            <h2>➕ Add Custom Hotel</h2>
            <p className="section-subtitle">Staying somewhere else? Add it manually.</p>
            
            <div className="custom-hotel-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Hotel Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={manualHotel.name} 
                    onChange={handleManualInputChange}
                    placeholder="e.g. My Friend's House"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Accommodation Type</label>
                  <select 
                    name="type" 
                    value={manualHotel.type} 
                    onChange={handleManualInputChange}
                    className="form-select"
                  >
                    <option value="hotel">Hotel</option>
                    <option value="resort">Resort</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cost per Night (₹)</label>
                  <input 
                    type="number" 
                    name="estimatedCost" 
                    value={manualHotel.estimatedCost} 
                    onChange={handleManualInputChange}
                    placeholder="0"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Rating (Optional)</label>
                  <input 
                    type="text" 
                    name="rating" 
                    value={manualHotel.rating} 
                    onChange={handleManualInputChange}
                    placeholder="e.g. 4.5"
                    className="form-input"
                  />
                </div>
              </div>

              <button onClick={addManualHotel} className="add-hotel-btn">
                Add Accommodation
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="action-buttons">
            <button onClick={handleBack} className="back-btn">← Back to Places</button>
            <button
              onClick={goToBudget}
              className="continue-btn"
              disabled={selectedHotels.length === 0}
            >
              Proceed to Budget →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Hotels;
