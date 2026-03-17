import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Places.css";
import API_URL from "../api";

function Transportation() {
  const location = useLocation();
  const navigate = useNavigate();

  const [tripData] = useState(() => {
    if (location.state?.tripData) {
      try {
        localStorage.setItem("tripData", JSON.stringify(location.state.tripData));
      } catch (_) {}
      return location.state.tripData;
    }
    try {
      const stored = localStorage.getItem("tripData");
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return null;
  });

  const [selectedTransport, setSelectedTransport] = useState(
    tripData?.transportMode === "car" ? null : (tripData?.transportMode || null)
  );
  const [travelOptions, setTravelOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeReturn, setIncludeReturn] = useState(true);
  const [returnOptions, setReturnOptions] = useState([]);
  const [selectedReturnOptionId, setSelectedReturnOptionId] = useState(null);
  const [loadingReturn, setLoadingReturn] = useState(false);
  const [errorReturn, setErrorReturn] = useState("");

  const API_KEY = process.env.REACT_APP_AVIATION_API_KEY;
  

  const cityIataMap = {
    "new delhi": "DEL",
    "delhi": "DEL",
    "mumbai": "BOM",
    "bombay": "BOM",
    "hyderabad": "HYD",
    "hyd": "HYD",
    "goa": "GOI",
    "panaji": "GOI",
    "bengaluru": "BLR",
    "bangalore": "BLR",
    "banglore": "BLR",
    "chennai": "MAA",
    "kolkata": "CCU",
    "calcutta": "CCU",
    "pune": "PNQ",
    "ahmedabad": "AMD",
    "jaipur": "JAI",
    "lucknow": "LKO",
    "kochi": "COK",
    "thiruvananthapuram": "TRV",
    "varanasi": "VNS",
    "patna": "PAT"
  };

  const inferIata = (city) => {
    const key = (city || "").toLowerCase().trim();
    return cityIataMap[key] || null;
  };

 

  const fetchFlights = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!API_KEY || API_KEY.trim().length === 0) {
        setError("Missing Aviation API key. Please configure REACT_APP_AVIATION_API_KEY.");
        setLoading(false);
        return;
      }
      const depIata = inferIata(tripData?.source);
      const arrIata = inferIata(tripData?.destination);
      const d = tripData?.distance || 0;
      const nearThreshold = 150;
      const hasDepIata = !!depIata;
      const hasArrIata = !!arrIata;
      if (!hasDepIata || !hasArrIata || d < nearThreshold) {
        setTravelOptions([]);
        setError("No flights between places");
        setLoading(false);
        return;
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const useDate = tripData?.startDate && tripData.startDate <= todayStr ? tripData.startDate : undefined;

      const params = {
        access_key: API_KEY,
        limit: 50
      };
      if (depIata) params.dep_iata = depIata;
      if (arrIata) params.arr_iata = arrIata;
      if (useDate) params.flight_date = useDate;

      const { data } = await axios.get("https://api.aviationstack.com/v1/flights", { params });

      let items = (data?.data || []);

      if (items.length === 0) {
        setTravelOptions([]);
        setError("No flights between places");
        setLoading(false);
        return;
      }
      setTravelOptions(
        items.map((f, idx) => ({
          id: `flight-${idx}-${f?.flight?.iata || f?.flight?.number || idx}`,
          type: "flight",
          airline: f?.airline?.name || "Unknown Airline",
          flightCode: f?.flight?.iata || f?.flight?.number || "",
          depAirport: f?.departure?.airport || "",
          depIata: f?.departure?.iata || "",
          depTime: f?.departure?.scheduled || f?.departure?.estimated || "",
          arrAirport: f?.arrival?.airport || "",
          arrIata: f?.arrival?.iata || "",
          arrTime: f?.arrival?.scheduled || f?.arrival?.estimated || "",
          status: f?.flight_status || "",
          estimatedCost: Math.max(1500, Math.round((tripData?.distance || 200) * 4.5)),
          timeRequired: "",
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.error?.message || e?.message || "Failed to load flights.";
      setTravelOptions([]);
      setError("No flights between places");
    } finally {
      setLoading(false);
    }
  }, [API_KEY, tripData]);

  const fetchTrains = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const src = (tripData?.sourceStation || tripData?.source || "").trim();
      const dst = (tripData?.destinationStation || tripData?.destination || "").trim();
      const date = tripData?.travelDate || tripData?.startDate;
      if (!src || !dst || !date) {
        setError("Missing source/destination or start date");
        setLoading(false);
        return;
      }
      const { data } = await axios.get(`${API_URL}/transport/local-trains`, {
        params: { sourceStation: src, destinationStation: dst, startDate: date, endDate: tripData?.endDate || date },
      });
      const dateEntry = (data?.dates || []).find(d => d.date === (new Date(date)).toISOString().slice(0,10));
      const trains = dateEntry?.trains || [];
      if (trains.length === 0) {
        // Fallback for trains if no direct trains found
        const d = tripData?.distance || 0;
        const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
        const estCostFromDistance = Math.max(200, Math.round(d * 1.5));
        
        setTravelOptions([
          {
            id: "train-fallback-1",
            type: "train",
            trainName: "Express Special",
            trainNumber: "12345",
            trainType: "Express",
            depTime: "08:00",
            arrTime: "20:00",
            status: "Available",
            estimatedCost: estCostFromDistance,
            timeRequired: `${hoursBy(55)} hr`,
            boardingDate: date,
            distanceKm: d
          },
          {
            id: "train-fallback-2",
            type: "train",
            trainName: "Superfast SF",
            trainNumber: "54321",
            trainType: "Superfast",
            depTime: "22:00",
            arrTime: "10:00 (+1 day)",
            status: "Available",
            estimatedCost: Math.round(estCostFromDistance * 1.2),
            timeRequired: `${hoursBy(65)} hr`,
            boardingDate: date,
            distanceKm: d
          }
        ]);
        setError("");
        setLoading(false);
        return;
      }
      const d = tripData?.distance || 0;
      const estCostFromDistance = Math.max(200, Math.round(d * 1.5));
      setTravelOptions(
        trains.map((t, idx) => ({
          id: `train-${idx}-${t.train_number || idx}`,
          type: "train",
          depTime: t.departure_time || "",
          arrTime: t.arrival_time || "",
          status: "Available",
          estimatedCost: t.price || estCostFromDistance,
          price: t.price || undefined,
          timeRequired: t.travel_duration || "",
          trainName: t.train_name || "",
          trainNumber: t.train_number || "",
          runningDays: t.running_days || [],
          trainType: t.train_type || "",
          distanceKm: t.distance_km || undefined,
          boardingDate: t.boarding_date || date,
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.message || e?.message || "Failed to load trains from dataset.";
      setError(apiErr);
      setTravelOptions([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, tripData]);

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const src = (tripData?.source || "").trim();
      const dst = (tripData?.destination || "").trim();
      const date = tripData?.travelDate || tripData?.startDate;
      const d = tripData?.distance || 0;
      if (!src || !dst || !date) {
        setError("Missing source/destination or travel date");
        setLoading(false);
        return;
      }
      const { data } = await axios.get(`${API_URL}/transport/buses`, {
        params: {
          sourceCity: src,
          destinationCity: dst,
          travelDate: date,
        },
      });
      const buses = data?.buses || [];
      if (buses.length === 0) {
        const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
        setTravelOptions([
          {
            id: "bus-fallback-empty-1",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(150, Math.round(d * 3)),
            timeRequired: `${hoursBy(45)} hr`,
            busOperator: "Express Travels",
            busType: "AC Seater",
            depTime: `${date}T20:00:00`,
            arrTime: `${date}T${20 + Math.floor(hoursBy(45)) >= 24 ? '0' + (20 + Math.floor(hoursBy(45)) - 24) : 20 + Math.floor(hoursBy(45))}:00:00`,
            price: Math.max(300, Math.round(d * 2.8)),
          },
          {
            id: "bus-fallback-empty-2",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(180, Math.round(d * 3.5)),
            timeRequired: `${hoursBy(40)} hr`,
            busOperator: "Comfort Lines",
            busType: "Sleeper AC",
            depTime: `${date}T22:00:00`,
            arrTime: `${date}T${22 + Math.floor(hoursBy(40)) >= 24 ? '0' + (22 + Math.floor(hoursBy(40)) - 24) : 22 + Math.floor(hoursBy(40))}:00:00`,
            price: Math.max(350, Math.round(d * 3.2)),
          },
        ]);
        setError("");
        setLoading(false);
        return;
      }
      setTravelOptions(
        buses.map((b, idx) => ({
          id: b.id || `bus-${idx}`,
          type: "bus",
          airline: "",
          flightCode: "",
          depAirport: src,
          arrAirport: dst,
          status: "Available",
          estimatedCost: Math.max(150, Math.round(d * 3)),
          timeRequired: "",
          busOperator: b.operator || "",
          busType: b.busType || "",
          depTime: b.departureTime || "",
          arrTime: b.arrivalTime || "",
          price: b.price || 0,
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.message || e?.message || "Failed to load buses.";
      const d = tripData?.distance || 0;
      const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
      if (apiErr.toLowerCase().includes("network")) {
        const src = (tripData?.source || "").trim();
        const dst = (tripData?.destination || "").trim();
        const date = tripData?.travelDate || tripData?.startDate;
        setTravelOptions([
          {
            id: "bus-fallback-1",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(150, Math.round(d * 3)),
            timeRequired: `${hoursBy(45)} hr`,
            busOperator: "Express Travels",
            busType: "AC Seater",
            depTime: `${date}T20:00:00`,
            arrTime: `${date}T${20 + Math.floor(hoursBy(45)) >= 24 ? '0' + (20 + Math.floor(hoursBy(45)) - 24) : 20 + Math.floor(hoursBy(45))}:00:00`,
            price: Math.max(300, Math.round(d * 2.8)),
          },
          {
            id: "bus-fallback-2",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(180, Math.round(d * 3.5)),
            timeRequired: `${hoursBy(40)} hr`,
            busOperator: "Comfort Lines",
            busType: "Sleeper AC",
            depTime: `${date}T22:00:00`,
            arrTime: `${date}T${22 + Math.floor(hoursBy(40)) >= 24 ? '0' + (22 + Math.floor(hoursBy(40)) - 24) : 22 + Math.floor(hoursBy(40))}:00:00`,
            price: Math.max(350, Math.round(d * 3.2)),
          },
        ]);
        setError("");
      } else {
        setError(apiErr);
      }
    } finally {
      setLoading(false);
    }
  }, [API_URL, tripData]);

  /* generateGroundOptions removed */

  /* trains return removed */

  const fetchFlightsReturn = useCallback(async () => {
    setLoadingReturn(true);
    setErrorReturn("");
    try {
      if (!API_KEY || API_KEY.trim().length === 0) {
        setErrorReturn("Missing Aviation API key.");
        setLoadingReturn(false);
        return;
      }
      const depIata = inferIata(tripData?.destination);
      const arrIata = inferIata(tripData?.source);
      const d = tripData?.distance || 0;
      const nearThreshold = 150;
      const hasDepIata = !!depIata;
      const hasArrIata = !!arrIata;
      if (!hasDepIata || !hasArrIata || d < nearThreshold) {
        setReturnOptions([]);
        setErrorReturn("No flights between places");
        setLoadingReturn(false);
        return;
      }
      const todayStr = new Date().toISOString().split("T")[0];
      const useDate = tripData?.endDate && tripData.endDate <= todayStr ? tripData.endDate : undefined;
      const params = {
        access_key: API_KEY,
        limit: 50,
      };
      if (depIata) params.dep_iata = depIata;
      if (arrIata) params.arr_iata = arrIata;
      if (useDate) params.flight_date = useDate;
      const { data } = await axios.get("https://api.aviationstack.com/v1/flights", { params });
      let items = data?.data || [];
      if (items.length === 0) {
        setReturnOptions([]);
        setErrorReturn("No flights between places");
        setLoadingReturn(false);
        return;
      }
      setReturnOptions(
        items.map((f, idx) => ({
          id: `flight-ret-${idx}-${f?.flight?.iata || f?.flight?.number || idx}`,
          type: "flight",
          airline: f?.airline?.name || "Unknown Airline",
          flightCode: f?.flight?.iata || f?.flight?.number || "",
          depAirport: f?.departure?.airport || "",
          depIata: f?.departure?.iata || "",
          depTime: f?.departure?.scheduled || f?.departure?.estimated || "",
          arrAirport: f?.arrival?.airport || "",
          arrIata: f?.arrival?.iata || "",
          arrTime: f?.arrival?.scheduled || f?.arrival?.estimated || "",
          status: f?.flight_status || "",
          estimatedCost: Math.max(1500, Math.round((tripData?.distance || 200) * 4.5)),
          timeRequired: "",
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.error?.message || e?.message || "Failed to load return flights.";
      setReturnOptions([]);
      setErrorReturn("No flights between places");
    } finally {
      setLoadingReturn(false);
    }
  }, [API_KEY, tripData]);

  const fetchTrainsReturn = useCallback(async () => {
    setLoadingReturn(true);
    setErrorReturn("");
    try {
      const src = (tripData?.destinationStation || tripData?.destination || "").trim();
      const dst = (tripData?.sourceStation || tripData?.source || "").trim();
      const date = tripData?.endDate;
      if (!src || !dst || !date) {
        setErrorReturn("Missing destination/source or end date");
        setLoadingReturn(false);
        return;
      }
      const { data } = await axios.get(`${API_URL}/transport/local-trains`, {
        params: { sourceStation: src, destinationStation: dst, startDate: date, endDate: date },
      });
      const dateEntry = (data?.dates || []).find(d => d.date === (new Date(date)).toISOString().slice(0,10));
      const trains = dateEntry?.trains || [];
      if (trains.length === 0) {
        // Fallback for return trains
        const d = tripData?.distance || 0;
        const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
        const estCostFromDistance = Math.max(200, Math.round(d * 1.5));
        
        setReturnOptions([
          {
            id: "train-ret-fallback-1",
            type: "train",
            trainName: "Return Express",
            trainNumber: "12346",
            trainType: "Express",
            depTime: "09:00",
            arrTime: "21:00",
            status: "Available",
            estimatedCost: estCostFromDistance,
            timeRequired: `${hoursBy(55)} hr`,
            boardingDate: date,
            distanceKm: d
          },
          {
            id: "train-ret-fallback-2",
            type: "train",
            trainName: "Return Superfast",
            trainNumber: "54322",
            trainType: "Superfast",
            depTime: "23:00",
            arrTime: "11:00 (+1 day)",
            status: "Available",
            estimatedCost: Math.round(estCostFromDistance * 1.2),
            timeRequired: `${hoursBy(65)} hr`,
            boardingDate: date,
            distanceKm: d
          }
        ]);
        setErrorReturn("");
        setLoadingReturn(false);
        return;
      }
      const d = tripData?.distance || 0;
      const estCostFromDistance = Math.max(200, Math.round(d * 1.5));
      setReturnOptions(
        trains.map((t, idx) => ({
          id: `train-ret-${idx}-${t.train_number || idx}`,
          type: "train",
          depTime: t.departure_time || "",
          arrTime: t.arrival_time || "",
          status: "Available",
          estimatedCost: t.price || estCostFromDistance,
          price: t.price || undefined,
          timeRequired: t.travel_duration || "",
          trainName: t.train_name || "",
          trainNumber: t.train_number || "",
          runningDays: t.running_days || [],
          trainType: t.train_type || "",
          distanceKm: t.distance_km || undefined,
          boardingDate: t.boarding_date || date,
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.message || e?.message || "Failed to load return trains from dataset.";
      setErrorReturn(apiErr);
      setReturnOptions([]);
    } finally {
      setLoadingReturn(false);
    }
  }, [API_URL, tripData]);

  const fetchBusesReturn = useCallback(async () => {
    setLoadingReturn(true);
    setErrorReturn("");
    try {
      const src = (tripData?.destination || "").trim();
      const dst = (tripData?.source || "").trim();
      const date = tripData?.endDate;
      if (!src || !dst || !date) {
        setErrorReturn("Missing destination/source or end date");
        setLoadingReturn(false);
        return;
      }
      const { data } = await axios.get(`${API_URL}/transport/buses`, {
        params: {
          sourceCity: src,
          destinationCity: dst,
          travelDate: date,
        },
      });
      const buses = data?.buses || [];
      const d = tripData?.distance || 0;
      if (buses.length === 0) {
        const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
        setReturnOptions([
          {
            id: "bus-ret-fallback-empty-1",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(150, Math.round(d * 3)),
            timeRequired: `${hoursBy(45)} hr`,
            busOperator: "Express Travels",
            busType: "AC Seater",
            depTime: `${date}T20:00:00`,
            arrTime: `${date}T${20 + Math.floor(hoursBy(45)) >= 24 ? '0' + (20 + Math.floor(hoursBy(45)) - 24) : 20 + Math.floor(hoursBy(45))}:00:00`,
            price: Math.max(300, Math.round(d * 2.8)),
          },
          {
            id: "bus-ret-fallback-empty-2",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(180, Math.round(d * 3.5)),
            timeRequired: `${hoursBy(40)} hr`,
            busOperator: "Comfort Lines",
            busType: "Sleeper AC",
            depTime: `${date}T22:00:00`,
            arrTime: `${date}T${22 + Math.floor(hoursBy(40)) >= 24 ? '0' + (22 + Math.floor(hoursBy(40)) - 24) : 22 + Math.floor(hoursBy(40))}:00:00`,
            price: Math.max(350, Math.round(d * 3.2)),
          },
        ]);
        setErrorReturn("");
        setLoadingReturn(false);
        return;
      }
      setReturnOptions(
        buses.map((b, idx) => ({
          id: b.id || `bus-ret-${idx}`,
          type: "bus",
          airline: "",
          flightCode: "",
          depAirport: src,
          arrAirport: dst,
          status: "Available",
          estimatedCost: Math.max(150, Math.round(d * 3)),
          timeRequired: "",
          busOperator: b.operator || "",
          busType: b.busType || "",
          depTime: b.departureTime || "",
          arrTime: b.arrivalTime || "",
          price: b.price || 0,
        }))
      );
    } catch (e) {
      const apiErr = e?.response?.data?.message || e?.message || "Failed to load return buses.";
      const d = tripData?.distance || 0;
      const hoursBy = (speed) => (d > 0 ? Math.max(1, Math.round((d / speed) * 10) / 10) : 0);
      if (apiErr.toLowerCase().includes("network")) {
        const src = (tripData?.destination || "").trim();
        const dst = (tripData?.source || "").trim();
        const date = tripData?.endDate;
        setReturnOptions([
          {
            id: "bus-ret-fallback-1",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(150, Math.round(d * 3)),
            timeRequired: `${hoursBy(45)} hr`,
            busOperator: "Express Travels",
            busType: "AC Seater",
            depTime: `${date}T20:00:00`,
            arrTime: `${date}T${20 + Math.floor(hoursBy(45)) >= 24 ? '0' + (20 + Math.floor(hoursBy(45)) - 24) : 20 + Math.floor(hoursBy(45))}:00:00`,
            price: Math.max(300, Math.round(d * 2.8)),
          },
          {
            id: "bus-ret-fallback-2",
            type: "bus",
            airline: "",
            flightCode: "",
            depAirport: src,
            arrAirport: dst,
            status: "Available",
            estimatedCost: Math.max(180, Math.round(d * 3.5)),
            timeRequired: `${hoursBy(40)} hr`,
            busOperator: "Comfort Lines",
            busType: "Sleeper AC",
            depTime: `${date}T22:00:00`,
            arrTime: `${date}T${22 + Math.floor(hoursBy(40)) >= 24 ? '0' + (22 + Math.floor(hoursBy(40)) - 24) : 22 + Math.floor(hoursBy(40))}:00:00`,
            price: Math.max(350, Math.round(d * 3.2)),
          },
        ]);
        setErrorReturn("");
      } else {
        setErrorReturn(apiErr);
      }
    } finally {
      setLoadingReturn(false);
    }
  }, [API_URL, tripData]);

  /* generateGroundReturnOptions removed */

  useEffect(() => {
    if (!tripData) return;
    if (!selectedTransport) {
        setTravelOptions([]);
        setLoading(false);
        return;
    }
    if (selectedTransport === "flight") {
      fetchFlights();
    } else if (selectedTransport === "train") {
      fetchTrains();
    } else if (selectedTransport === "bus") {
      fetchBuses();
    }
  }, [tripData, selectedTransport, fetchFlights, fetchTrains, fetchBuses]);

  useEffect(() => {
    if (!tripData || !includeReturn) {
      setReturnOptions([]);
      return;
    }
    if (!selectedTransport) {
      setReturnOptions([]);
      return;
    }
    if (selectedTransport === "flight") {
      fetchFlightsReturn();
    } else if (selectedTransport === "train") {
      fetchTrainsReturn();
    } else if (selectedTransport === "bus") {
      fetchBusesReturn();
    }
  }, [tripData, selectedTransport, includeReturn, fetchFlightsReturn, fetchTrainsReturn, fetchBusesReturn]);

  const handleBack = () => navigate("/");

  const handleSelect = (id) => setSelectedOptionId(id);
  const handleSelectReturn = (id) => setSelectedReturnOptionId(id);

  const handleContinue = () => {
    if (!tripData) return;
    const chosen = travelOptions.find((o) => o.id === selectedOptionId) || null;
    const chosenReturn = includeReturn ? (returnOptions.find((o) => o.id === selectedReturnOptionId) || null) : null;
    const travelersCount = Number(tripData?.travelers || 1);
    const outboundCostPerPerson = chosen ? (chosen.price || chosen.estimatedCost || 0) : 0;
    const returnCostPerPerson = chosenReturn ? (chosenReturn.price || chosenReturn.estimatedCost || 0) : 0;
    const totalPrimaryTransportCost = (outboundCostPerPerson + returnCostPerPerson) * travelersCount;
    const updated = {
      ...tripData,
      transportMode: selectedTransport,
      chosenTransportOption: chosen,
      chosenReturnTransportOption: chosenReturn,
      includeReturn,
      primaryTransportCost: totalPrimaryTransportCost,
    };
    try {
      localStorage.setItem("tripData", JSON.stringify(updated));
    } catch (_) {}
    navigate("/places", { state: { tripData: updated } });
  };

  if (!tripData) {
    return (
      <div className="places-container">
        <div className="error-message">
          <h2>No Trip Data Found</h2>
          <p>Please plan your trip first from the Home page.</p>
          <button onClick={handleBack} className="back-button">
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="places-container">
      <header className="places-header">
        <h1>🚌 Select Transportation</h1>
        <p>Choose how you want to travel</p>
        <div className="trip-summary">
          <span>📍 {tripData.source} → {tripData.destination}</span>
          <span>👥 {tripData.travelers} traveler(s)</span>
          <span>📅 {new Date(tripData.startDate).toLocaleDateString()} - {new Date(tripData.endDate).toLocaleDateString()}</span>
        </div>
      </header>

      <main className="places-main">
        <div className="places-content">
          <div className="popular-places-section">
            <h2>🛞 Primary Mode of Transport</h2>
            <p className="section-subtitle">Select your preferred transport mode</p>

            <div className="transport-options">
              {["flight","train","bus"].map((mode) => (
                <label key={mode} className="transport-option">
                  <input
                    type="radio"
                    name="transportMode"
                    value={mode}
                    checked={selectedTransport === mode}
                    onChange={(e) => setSelectedTransport(e.target.value)}
                  />
                  <span className="transport-label">
                    {mode === "flight" ? "✈️ Flight" :
                     mode === "train" ? "🚆 Train" : "🚌 Bus"}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="transport-option">
                <input
                  type="checkbox"
                  checked={includeReturn}
                  onChange={(e) => setIncludeReturn(e.target.checked)}
                />
                <span className="transport-label">
                  Include return trip on {tripData?.endDate ? new Date(tripData.endDate).toLocaleDateString() : "end date"}
                </span>
              </label>
            </div>
          </div>

          {selectedTransport && (
            <div className="popular-places-section">
              <h2>🎟️ Available Options</h2>
              <p className="section-subtitle">
                Options for {tripData.source} → {tripData.destination} on {new Date(tripData.startDate).toLocaleDateString()}
              </p>
  
              {error && <div className="error">{error}</div>}
  
              {loading ? (
                <div className="skeleton-grid">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-image"></div>
                      <div>
                        <div className="skeleton-line sm"></div>
                        <div className="skeleton-line md"></div>
                        <div className="skeleton-line lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : travelOptions.length === 0 ? (
                <div className="no-places">No options found for the selected mode and date.</div>
              ) : (
                <div className="places-grid">
                  {travelOptions.map((opt) => (
                    <div
                      key={opt.id}
                      className={`place-card ${selectedOptionId === opt.id ? "selected" : ""}`}
                      onClick={() => handleSelect(opt.id)}
                    >
                      <div className="place-image">
                        <span className="image-badge">
                          {opt.type === "flight" ? "✈️ Flight" :
                           opt.type === "train" ? "🚆 Train" : "🚌 Bus"}
                        </span>
                      </div>
                      <div className="place-details">
                        <h3>
                          {opt.type === "flight"
                            ? `${opt.airline} ${opt.flightCode || ""}`.trim()
                            : opt.type === "bus"
                              ? `${opt.busOperator || "Bus"} ${opt.busType ? `• ${opt.busType}` : ""}`.trim()
                              : opt.type === "train"
                                ? `${opt.trainName || "Train"} ${opt.trainNumber ? `(${opt.trainNumber})` : ""}`.trim()
                                : `${opt.type.toUpperCase()} Option`}
                        </h3>
                        <div className="place-info">
                          <span className="place-cost">₹{opt.price || opt.estimatedCost}</span>
                          <span className="place-time">
                            ⏱ {opt.timeRequired || "Time varies"}
                          </span>
                        </div>
                        <div className="place-time">
                          {opt.type === "flight" && (
                            <>
                              Departure: {opt.depAirport} {opt.depIata && `(${opt.depIata})`} {opt.depTime ? `• ${new Date(opt.depTime).toLocaleString()}` : ""}
                              <br />
                              Arrival: {opt.arrAirport} {opt.arrIata && `(${opt.arrIata})`} {opt.arrTime ? `• ${new Date(opt.arrTime).toLocaleString()}` : ""}
                            </>
                          )}
                          
                          {opt.type === "bus" && (
                            <>
                              {opt.busOperator || "Bus"} {opt.busType ? `• ${opt.busType}` : ""}
                              <br />
                              Departure: {opt.depTime || ""}
                              <br />
                              Arrival: {opt.arrTime || ""}
                            </>
                          )}
                          {opt.type === "train" && (
                            <>
                              {opt.trainName || "Train"} {opt.trainNumber ? `(${opt.trainNumber})` : ""}
                              <br />
                              Type: {opt.trainType || "N/A"} {typeof opt.distanceKm === "number" ? `• ${opt.distanceKm} km` : ""}
                              <br />
                              Departure: {opt.depTime || ""}
                              <br />
                              Arrival: {opt.arrTime || ""}
                              <br />
                              Date: {new Date(opt.boardingDate || tripData?.startDate).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {includeReturn && selectedTransport && (
            <div className="popular-places-section">
              <h2>↩️ Return Options</h2>
              <p className="section-subtitle">
                Options for {tripData.destination} → {tripData.source} on {new Date(tripData.endDate).toLocaleDateString()}
              </p>
              {errorReturn && <div className="error">{errorReturn}</div>}
              {loadingReturn ? (
                <div className="skeleton-grid">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton-card">
                      <div className="skeleton-image"></div>
                      <div>
                        <div className="skeleton-line sm"></div>
                        <div className="skeleton-line md"></div>
                        <div className="skeleton-line lg"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : returnOptions.length === 0 ? (
                <div className="no-places">No return options found for the selected mode and end date.</div>
              ) : (
                <div className="places-grid">
                  {returnOptions.map((opt) => (
                    <div
                      key={opt.id}
                      className={`place-card ${selectedReturnOptionId === opt.id ? "selected" : ""}`}
                      onClick={() => handleSelectReturn(opt.id)}
                    >
                      <div className="place-image">
                        <span className="image-badge">
                          {opt.type === "flight" ? "✈️ Flight" :
                           opt.type === "train" ? "🚆 Train" : "🚌 Bus"}
                        </span>
                      </div>
                      <div className="place-details">
                        <h3>
                          {opt.type === "flight"
                            ? `${opt.airline} ${opt.flightCode || ""}`.trim()
                            : opt.type === "bus"
                              ? `${opt.busOperator || "Bus"} ${opt.busType ? `• ${opt.busType}` : ""}`.trim()
                              : opt.type === "train"
                                ? `${opt.trainName || "Train"} ${opt.trainNumber ? `(${opt.trainNumber})` : ""}`.trim()
                                : `${opt.type.toUpperCase()} Option`}
                        </h3>
                        <div className="place-info">
                          <span className="place-cost">₹{opt.price || opt.estimatedCost}</span>
                          <span className="place-time">
                            ⏱ {opt.timeRequired || "Time varies"}
                          </span>
                        </div>
                        <div className="place-time">
                          {opt.type === "flight" && (
                            <>
                              Departure: {opt.depAirport} {opt.depIata && `(${opt.depIata})`} {opt.depTime ? `• ${new Date(opt.depTime).toLocaleString()}` : ""}
                              <br />
                              Arrival: {opt.arrAirport} {opt.arrIata && `(${opt.arrIata})`} {opt.arrTime ? `• ${new Date(opt.arrTime).toLocaleString()}` : ""}
                            </>
                          )}
                          
                          {opt.type === "bus" && (
                            <>
                              {opt.busOperator || "Bus"} {opt.busType ? `• ${opt.busType}` : ""}
                              <br />
                              Departure: {opt.depTime || ""}
                              <br />
                              Arrival: {opt.arrTime || ""}
                            </>
                          )}
                          {opt.type === "train" && (
                            <>
                              {opt.trainName || "Train"} {opt.trainNumber ? `(${opt.trainNumber})` : ""}
                              <br />
                              Type: {opt.trainType || "N/A"} {typeof opt.distanceKm === "number" ? `• ${opt.distanceKm} km` : ""}
                              <br />
                              Departure: {opt.depTime || ""}
                              <br />
                              Arrival: {opt.arrTime || ""}
                              <br />
                              Date: {new Date(opt.boardingDate || tripData?.endDate).toLocaleDateString()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="action-buttons">
            <button className="back-btn" onClick={handleBack}>← Back</button>
            <button
              className="continue-btn"
              onClick={handleContinue}
              disabled={
                !selectedTransport ||
                (!selectedOptionId && (selectedTransport === "flight" || selectedTransport === "bus" || selectedTransport === "train")) ||
                (includeReturn && (selectedTransport === "flight" || selectedTransport === "bus" || selectedTransport === "train") && !selectedReturnOptionId)
              }
            >
              Continue to Places →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Transportation;
