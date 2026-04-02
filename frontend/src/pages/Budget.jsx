import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../styles/Hotels.css";

function Budget() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tripData, selectedHotels = [] } = location.state || {};

  const totals = useMemo(() => {
    if (!tripData) {
      return {
        diffDays: 1,
        accommodationCost: 0,
        localTransportCost: 0,
        foodCost: 0,
        minTotal: 0,
        primaryTransport: 0,
      };
    }
    const oneDay = 24 * 60 * 60 * 1000;
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    const diffDays = Math.round(Math.abs((startDate - endDate) / oneDay)) || 1;
    const travelers = Number(tripData.travelers || 1);
    const primaryTransport = Number(tripData.primaryTransportCost || 0);
    const hotelsCostPerNight = selectedHotels.reduce(
      (total, hotel) => total + Number(hotel.estimatedCost || 0),
      0
    );
    const accommodationCost = hotelsCostPerNight * diffDays;
    const destKey = (tripData.destination || "").toLowerCase();
    const tier1 = [
      "bengaluru",
      "bangalore",
      "banglore",
      "hyderabad",
      "mumbai",
      "delhi",
      "chennai",
      "kolkata",
      "pune",
      "ahmedabad",
      "jaipur",
    ];
    const localPerDay = tier1.includes(destKey) ? 400 : 250;
    const localTransportCost = localPerDay * diffDays * travelers;
    const foodPerDayPerTraveler = 500;
    const foodCost = foodPerDayPerTraveler * diffDays * travelers;
    const minTotal = primaryTransport + accommodationCost + localTransportCost + foodCost;
    return { diffDays, accommodationCost, localTransportCost, foodCost, minTotal, primaryTransport };
  }, [tripData, selectedHotels]);

  const [budgetInput, setBudgetInput] = useState("");
  const minBudget = totals.minTotal;
  const isValidBudget = Number(budgetInput || 0) >= minBudget;

  const currentAllocation = useMemo(() => {
    const finalBudget = Number(budgetInput || minBudget);
    const fixedCosts = totals.primaryTransport + totals.accommodationCost;
    const variableBudget = Math.max(0, finalBudget - fixedCosts);
    const totalMinVariable = totals.localTransportCost + totals.foodCost;
    
    let allocatedLocal = totals.localTransportCost;
    let allocatedFood = totals.foodCost;

    if (totalMinVariable > 0 && variableBudget > 0) {
      allocatedLocal = Math.round(variableBudget * (totals.localTransportCost / totalMinVariable));
      allocatedFood = variableBudget - allocatedLocal;
    }
    
    return {
      local: allocatedLocal,
      food: allocatedFood,
      total: finalBudget
    };
  }, [budgetInput, totals, minBudget]);

  const [budgetConfirmed, setBudgetConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [itineraryReady, setItineraryReady] = useState(() => {
    try { return localStorage.getItem("itineraryReady") === "true"; } catch (_) { return false; }
  });

  const buildSimpleItinerary = (td) => {
    try {
      const start = new Date(td.startDate);
      const end = new Date(td.endDate);
      const oneDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.max(1, Math.floor((end - start) / oneDay) + 1);
      const places = Array.isArray(td.selectedPlaces) ? td.selectedPlaces : [];
      const days = Array.from({ length: diffDays }, (_, i) => ({
        date: new Date(start.getTime() + i * oneDay),
        items: [],
        summary: { totalPlaceHours: 0, travelKm: 0, travelMin: 0 },
      }));
      if (places.length > 0) {
        const perDay = Math.max(1, Math.ceil(places.length / diffDays));
        let idx = 0;
        for (let d = 0; d < diffDays && idx < places.length; d++) {
          let used = 0;
          while (used < perDay && idx < places.length) {
            const p = places[idx++];
            const hrs = 2;
            days[d].items.push({
              name: p.name,
              category: p.category || p.type || "sightseeing",
              timeHours: hrs,
              coordinates: p.coordinates || {},
            });
            used += 1;
            days[d].summary.totalPlaceHours = Math.max(0, Math.round((days[d].summary.totalPlaceHours + hrs) * 10) / 10);
          }
        }
      }
      return {
        meta: { diffDays, outboundHours: 0, returnHours: 0, totalHours: diffDays * 8 },
        days,
      };
    } catch (_) {
      return null;
    }
  };

  if (!tripData) {
    return (
      <div className="hotels-container">
        <div className="error-message">
          <h2>No Trip Data Found</h2>
          <p>Please plan your trip first from the Home page.</p>
          <button onClick={() => navigate("/")} className="back-button">
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hotels-container">
      <header className="hotels-header">
        <h1>💰 Trip Budget</h1>
        <p>Minimum budget and allocation by category</p>
        <div className="trip-summary">
          <span>📍 {tripData.source} → {tripData.destination}</span>
          <span>👥 {tripData.travelers} traveler(s)</span>
          <span>📅 {new Date(tripData.startDate).toLocaleDateString()} - {new Date(tripData.endDate).toLocaleDateString()}</span>
        </div>
      </header>

      <main className="hotels-main">
        <div className="hotels-content">
          <div className="selected-hotel-section">
            <h2>Budget Breakdown</h2>
            <div className="cost-summary">
              <p><strong>Transport:</strong> ₹{totals.primaryTransport}</p>
              <p><strong>Accommodation:</strong> ₹{totals.accommodationCost}</p>
              <p><strong>Local Transport:</strong> ₹{currentAllocation.local}</p>
              <p><strong>Food:</strong> ₹{currentAllocation.food}</p>
              <p style={{ fontSize: "1.2rem", marginTop: "10px" }}>
                <strong>{isValidBudget ? "Total Planned Budget:" : "Minimum Budget Required:"}</strong> ₹{isValidBudget ? currentAllocation.total : totals.minTotal}
              </p>
            </div>

            <div className="custom-hotel-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Your Budget (₹)</label>
                  <input
                    type="number"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder={`Enter at least ₹${minBudget}`}
                    className="form-input"
                  />
                </div>
              </div>
              {!isValidBudget && (
                <p className="error">Please enter a budget of at least ₹{minBudget}</p>
              )}
            </div>

            <div className="continue-section">
              <button
                onClick={() => navigate("/hotels", { state: { tripData } })}
                className="back-button"
                style={{ marginRight: "auto" }}
              >
                ← Back to Hotels
              </button>
              <button
                className="continue-btn"
                disabled={!isValidBudget}
                onClick={() => {
                  const completeTripData = {
                    ...tripData,
                    selectedHotels,
                    totalHotelsCost: totals.accommodationCost,
                    finalMinBudget: totals.minTotal,
                    finalBudget: Number(budgetInput || 0),
                  };
                  try {
                    localStorage.setItem("tripData", JSON.stringify(completeTripData));
                    localStorage.setItem("itineraryReady", "false");
                  } catch (_) {}
                  setBudgetConfirmed(true);
                  setGenerating(true);
                  setTimeout(() => {
                    const plan = buildSimpleItinerary(completeTripData);
                    const withPlan = plan ? { ...completeTripData, itineraryDays: plan.days } : completeTripData;
                    try {
                      localStorage.setItem("tripData", JSON.stringify(withPlan));
                      localStorage.setItem("itineraryReady", "true");
                    } catch (_) {}
                    setGenerating(false);
                    setItineraryReady(true);
                  }, 10);
                }}
              >
                Confirm Budget ✅
              </button>
              <button
                className="continue-btn"
                disabled={!budgetConfirmed || !itineraryReady || generating}
                onClick={() => {
                  let stored = null;
                  try {
                    stored = JSON.parse(localStorage.getItem("tripData") || "null");
                  } catch (_) {}
                  const dataToUse = stored || {
                    ...tripData,
                    selectedHotels,
                    totalHotelsCost: totals.accommodationCost,
                    finalMinBudget: totals.minTotal,
                    finalBudget: Number(budgetInput || 0),
                  };
                  navigate("/itinerary", { state: { tripData: dataToUse } });
                }}
                style={{ marginLeft: 12 }}
              >
                {generating ? "Generating..." : "View Itinerary →"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Budget;
