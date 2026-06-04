import { useState, useEffect } from "react";
import {
  Zap,
  MapPin,
  BatteryCharging,
  CheckCircle2,
  XCircle,
  Navigation,
  RefreshCw,
  Sun,
  Moon,
  TrendingUp,
  Cpu,
  Layers,
} from "lucide-react";
import {
  subscribeToDashboardData,
  writeRecommendationToFirebase,
  DEFAULT_DASHBOARD_DATA,
  type DashboardData,
} from "@/services/stationService";
import { getRecommendation } from "@/lib/decisionLogic";
import { calculateDistanceKm, calculateRangeKm } from "@/lib/distance";
import { bangaloreLocations } from "@/lib/bangaloreLocations";
import { BangaloreMap, STATIONS_METADATA } from "@/components/BangaloreMap";
import logo from "@/assets/dyanocharge-logo.png";

type StationId = "A" | "B" | "C";

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  const [firebaseData, setFirebaseData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [batteryInput, setBatteryInput] = useState<string>("60");
  const [userLatInput, setUserLatInput] = useState<string>("12.9250");
  const [userLngInput, setUserLngInput] = useState<string>("77.5120");
  const [userLocationName, setUserLocationName] =
    useState<string>("Custom Coordinate");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showSearchDropdown, setShowSearchDropdown] =
    useState<boolean>(false);

  const [bookedSlots, setBookedSlots] = useState<Record<StationId, number>>({
    A: 0,
    B: 0,
    C: 0,
  });

  const [bookingConfirmation, setBookingConfirmation] = useState<{
    stationId: StationId;
    stationName: string;
    bookingId: string;
    remainingSlots: number;
  } | null>(null);

  const hasUserBooked = bookingConfirmation !== null;

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = subscribeToDashboardData((data) => {
      setFirebaseData(data);
      setLoading(false);

      if (
        data?.vehicle?.battery &&
        !localStorage.getItem("custom_battery_edited")
      ) {
        setBatteryInput(String(data.vehicle.battery));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSelectLocation = (name: string, lat: number, lng: number) => {
    setUserLocationName(name);
    setUserLatInput(lat.toFixed(4));
    setUserLngInput(lng.toFixed(4));
    setSearchQuery("");
    setShowSearchDropdown(false);
  };

  const batteryNum = Math.min(100, Math.max(1, Number(batteryInput) || 60));
  const latNum = Number(userLatInput) || 12.925;
  const lngNum = Number(userLngInput) || 77.512;

  const estimatedRange = calculateRangeKm(batteryNum);
  const baseData = firebaseData || DEFAULT_DASHBOARD_DATA;

  const liveData: DashboardData = {
    ...baseData,
    vehicle: {
      battery: batteryNum,
    },
    stations: {
      A: {
        ...baseData.stations.A,
        distance: calculateDistanceKm(
          latNum,
          lngNum,
          STATIONS_METADATA.A.lat,
          STATIONS_METADATA.A.lng
        ),
      },
      B: {
        ...baseData.stations.B,
        distance: calculateDistanceKm(
          latNum,
          lngNum,
          STATIONS_METADATA.B.lat,
          STATIONS_METADATA.B.lng
        ),
      },
      C: {
        ...baseData.stations.C,
        distance: calculateDistanceKm(
          latNum,
          lngNum,
          STATIONS_METADATA.C.lat,
          STATIONS_METADATA.C.lng
        ),
      },
    },
  };

  const recommendation = getRecommendation(liveData);

  const getSlotMetrics = (
    station?: DashboardData["stations"]["A"],
    stationId?: StationId
  ) => {
    const totalSlots = Number(station?.totalSlots ?? 3);
    const liveOccupancy = Number(station?.occupancy ?? 0);
    const localBookedSlots = stationId ? Number(bookedSlots[stationId] ?? 0) : 0;

    const effectiveOccupancy = Math.min(
      totalSlots,
      liveOccupancy + localBookedSlots
    );

    const availableSlots = Math.max(0, totalSlots - effectiveOccupancy);

    return {
      totalSlots,
      liveOccupancy,
      localBookedSlots,
      occupancy: effectiveOccupancy,
      availableSlots,
      availableSlotsText: `${availableSlots} ${
        availableSlots === 1 ? "slot" : "slots"
      }`,
      bookedSlotsText: `${localBookedSlots} ${
        localBookedSlots === 1 ? "booking" : "bookings"
      }`,
    };
  };

  const handleBookSlot = (stationId: StationId) => {
    if (hasUserBooked) {
      alert(
        `You have already booked a slot at Station ${bookingConfirmation?.stationId}. Only one booking is allowed.`
      );
      return;
    }

    const station = liveData.stations[stationId];
    const slotMetrics = getSlotMetrics(station, stationId);

    if (slotMetrics.availableSlots <= 0) {
      alert(`Station ${stationId} is fully booked. No slots are available.`);
      return;
    }

    const bookingId = `DYN-${stationId}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const remainingSlots = slotMetrics.availableSlots - 1;

    setBookedSlots((prev) => ({
      ...prev,
      [stationId]: prev[stationId] + 1,
    }));

    setBookingConfirmation({
      stationId,
      stationName: STATIONS_METADATA[stationId].name,
      bookingId,
      remainingSlots,
    });
  };

  const recommendedStationData =
    recommendation.station === "AVOID"
      ? null
      : liveData.stations[recommendation.station];

  const recommendedStationId =
    recommendation.station === "AVOID"
      ? undefined
      : (recommendation.station as StationId);

  const recommendedSlots = getSlotMetrics(
    recommendedStationData ?? undefined,
    recommendedStationId
  );

  useEffect(() => {
    if (!firebaseData) return;

    const currentFirebaseRec = firebaseData.recommendation;

    const needsSync =
      !currentFirebaseRec ||
      currentFirebaseRec.station !== recommendation.station ||
      currentFirebaseRec.reason !== recommendation.reason;

    if (needsSync) {
      writeRecommendationToFirebase(
        recommendation.station,
        recommendation.reason
      ).catch((err) => {
        console.error("Failed to sync recommendation to Firebase:", err);
      });
    }
  }, [recommendation.station, recommendation.reason, firebaseData]);

  const getStationSafetyDiagnostics = (stationId: StationId) => {
    const station = liveData.stations[stationId];
    const slotMetrics = getSlotMetrics(station, stationId);

    const isSafe =
      station.load < 90 &&
      station.loadStatus !== "RED" &&
      slotMetrics.occupancy < slotMetrics.totalSlots &&
      station.waitingTime <= 45 &&
      station.distance <= estimatedRange;

    const reasons: string[] = [];

    if (station.load >= 90) {
      reasons.push("Station load is extremely high (≥ 90%)");
    }

    if (station.loadStatus === "RED") {
      reasons.push("Grid load status is RED (overloaded)");
    }

    if (slotMetrics.occupancy >= slotMetrics.totalSlots) {
      reasons.push(
        `All slots are occupied (${slotMetrics.totalSlots}/${slotMetrics.totalSlots} slots full)`
      );
    }

    if (station.waitingTime > 45) {
      reasons.push("Queue delay exceeds tolerable limit (> 45 min)");
    }

    if (station.distance > estimatedRange) {
      reasons.push("Station out of vehicle battery range");
    }

    return {
      isSafe,
      reason:
        reasons.length > 0
          ? reasons.join(", ")
          : "Station metrics are within green parameters.",
    };
  };

  const safeStationsList = (["A", "B", "C"] as const).filter((id) =>
    getStationSafetyDiagnostics(id).isSafe
  );

  const filteredLocations = searchQuery
    ? bangaloreLocations.filter((loc) =>
        loc.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div className="min-h-screen transition-colors duration-300 bg-zinc-50 dark:bg-obsidian-900 glow-backdrop-teal pb-12">
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-zinc-200/60 dark:border-slate-800/80 shadow-sm py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="DyanoCharge Logo"
              className="w-10 h-10 md:w-11 md:h-11 object-contain transition-transform hover:scale-105"
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg md:text-xl tracking-tight text-zinc-900 dark:text-white">
                  DYANOCHARGE
                </span>

                <span className="bg-electric-500/10 text-electric-600 dark:text-electric-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-electric-500/20">
                  ML + IoT
                </span>
              </div>

              <p className="text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Smart EV Charging Recommendation System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-zinc-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-full border border-zinc-200/50 dark:border-slate-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-electric-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-electric-500"></span>
              </span>

              <span className="text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
                {loading ? "Connecting..." : "Live Firebase RTDB"}
              </span>
            </div>

            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="p-2.5 rounded-full bg-zinc-100 dark:bg-obsidian-850 hover:bg-zinc-200 dark:hover:bg-slate-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-slate-800/80 shadow-sm transition-all"
              aria-label="Toggle Theme"
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 mt-6">
        {loading && (
          <div className="mb-4 flex items-center justify-center gap-2 p-3 bg-zinc-100 dark:bg-slate-800/50 border border-zinc-200/50 dark:border-slate-800 rounded-xl animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-electric-500" />
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Connecting to live database telemetry...
            </span>
          </div>
        )}

        {bookingConfirmation && (
          <div className="mb-4 rounded-2xl border border-electric-500/30 bg-electric-500/10 px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-electric-500" />

                  <h3 className="text-sm font-black text-electric-700 dark:text-electric-400">
                    Slot booked successfully!
                  </h3>
                </div>

                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Station {bookingConfirmation.stationId} -{" "}
                  {bookingConfirmation.stationName}
                </p>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Booking ID:{" "}
                  <span className="font-bold text-zinc-900 dark:text-white">
                    {bookingConfirmation.bookingId}
                  </span>
                </p>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Remaining booking slots:{" "}
                  <span className="font-bold text-electric-600 dark:text-electric-400">
                    {bookingConfirmation.remainingSlots}
                  </span>
                </p>

                <p className="text-[11px] mt-2 font-semibold text-zinc-500 dark:text-zinc-400">
                  One active booking is allowed per user in this demo.
                </p>
              </div>

              <button
                onClick={() => setBookingConfirmation(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-panel rounded-2xl p-5 shadow-sm border">
              <div className="flex items-center gap-2.5 mb-4 border-b border-zinc-200/40 dark:border-slate-800/60 pb-3">
                <Navigation className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
                  Trip Route Configuration
                </h2>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                    Vehicle Position (Bangalore Region)
                  </label>

                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowSearchDropdown(true);
                      }}
                      onFocus={() => setShowSearchDropdown(true)}
                      placeholder={
                        userLocationName ||
                        "Type location (e.g. Koramangala)..."
                      }
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 text-zinc-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-zinc-400"
                    />
                  </div>

                  {showSearchDropdown && searchQuery && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-obsidian-850 border border-zinc-200 dark:border-slate-850 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {filteredLocations.length > 0 ? (
                        filteredLocations.map((loc) => (
                          <button
                            key={loc.name}
                            onClick={() =>
                              handleSelectLocation(loc.name, loc.lat, loc.lng)
                            }
                            className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-slate-800 border-b border-zinc-100 dark:border-slate-800/50 last:border-b-0"
                          >
                            {loc.name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                          No pre-set location found. Enter coordinates manually
                          below.
                        </div>
                      )}
                    </div>
                  )}

                  {userLocationName && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                      <span>Active Location: {userLocationName}</span>

                      <button
                        onClick={() => {
                          setUserLocationName("Custom Coordinate");
                          setSearchQuery("");
                        }}
                        className="text-[9px] underline uppercase tracking-widest text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      Latitude
                    </label>

                    <input
                      type="number"
                      step="0.0001"
                      value={userLatInput}
                      onChange={(e) => {
                        setUserLatInput(e.target.value);
                        setUserLocationName("Custom Coordinate");
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      Longitude
                    </label>

                    <input
                      type="number"
                      step="0.0001"
                      value={userLngInput}
                      onChange={(e) => {
                        setUserLngInput(e.target.value);
                        setUserLocationName("Custom Coordinate");
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 text-zinc-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Vehicle Battery Charge (%)
                    </label>

                    <BatteryCharging className="w-4 h-4 text-blue-500" />
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={batteryInput}
                      onChange={(e) => {
                        localStorage.setItem("custom_battery_edited", "true");
                        setBatteryInput(e.target.value);
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Battery % (1 - 100)"
                    />

                    <span className="absolute right-3.5 top-3 text-xs font-bold text-zinc-400">
                      %
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-100/50 dark:bg-obsidian-850 p-3 rounded-xl border border-zinc-200/30 dark:border-slate-850 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Est. Range Remaining
                    </span>

                    <p className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                      {estimatedRange} km
                    </p>
                  </div>

                  <div className="h-8 w-[1.5px] bg-zinc-200 dark:bg-slate-800" />

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Vehicle Range Base
                    </span>

                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      335 km (100%)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 shadow-md border recommended-border-glow transition-all duration-300 relative overflow-hidden">
              {recommendation.station !== "AVOID" && (
                <div className="absolute right-[-10px] bottom-[-20px] text-electric-500/5 pointer-events-none transform rotate-[15deg]">
                  <Zap className="w-48 h-48" />
                </div>
              )}

              <div className="flex items-center justify-between mb-4 border-b border-zinc-200/40 dark:border-slate-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-electric-500" />

                  <h2 className="font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                    Smart Recommendation
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                    LED Status
                  </span>

                  <div
                    className={`h-3.5 w-3.5 rounded-full border shadow-sm animate-pulse ${
                      recommendation.station === "AVOID"
                        ? "bg-coral-500 border-coral-400"
                        : "bg-electric-500 border-electric-400"
                    }`}
                  />
                </div>
              </div>

              {recommendation.station === "AVOID" ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-coral-500/10 p-3.5 rounded-xl border border-coral-500/20 text-coral-600 dark:text-coral-400">
                    <XCircle className="w-6 h-6 shrink-0 mt-0.5" />

                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wide">
                        Grid Constrained / Stop Charging
                      </h3>

                      <p className="text-xs font-semibold leading-relaxed mt-1">
                        {recommendation.reason}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex justify-between text-xs py-1 border-b border-zinc-200/30 dark:border-slate-800/45">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        Grid Headroom
                      </span>

                      <span className="font-bold text-coral-500">
                        {liveData.grid.headroom} kW (CRITICAL)
                      </span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        Grid Status
                      </span>

                      <span className="font-bold text-coral-500 uppercase">
                        {liveData.grid.status}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Optimal Choice
                    </span>

                    <h3 className="text-lg font-black text-zinc-950 dark:text-white mt-1">
                      Station {recommendation.station}
                    </h3>

                    <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {STATIONS_METADATA[recommendation.station].name}
                    </p>
                  </div>

                  <div className="bg-electric-500/10 p-3 rounded-xl border border-electric-500/20 text-electric-700 dark:text-electric-400">
                    <div className="flex gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />

                      <p className="text-xs font-semibold leading-normal">
                        {recommendation.reason}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Station Load
                      </span>

                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {recommendedStationData?.load ?? 0}%
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Occupied Slots
                      </span>

                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {recommendedSlots.occupancy} /{" "}
                        {recommendedSlots.totalSlots} slots
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Booking Slots
                      </span>

                      <span className="font-bold text-electric-500">
                        {recommendedSlots.availableSlotsText}
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Your Booking
                      </span>

                      <span className="font-bold text-blue-500">
                        {bookingConfirmation
                          ? `Station ${bookingConfirmation.stationId}`
                          : "None"}
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Waiting Queue
                      </span>

                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {recommendedStationData?.waitingTime ?? 0} mins
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Distance
                      </span>

                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {recommendedStationData?.distance ?? 0} km
                      </span>
                    </div>

                    <div className="bg-zinc-100/30 dark:bg-obsidian-850 p-2.5 rounded-lg border border-zinc-100 dark:border-slate-850">
                      <span className="text-zinc-400 font-semibold text-[9px] uppercase tracking-wider block">
                        Grid Headroom
                      </span>

                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {liveData.grid.headroom} kW
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      recommendedStationId &&
                      handleBookSlot(recommendedStationId)
                    }
                    disabled={
                      hasUserBooked ||
                      !recommendedStationId ||
                      recommendedSlots.availableSlots <= 0
                    }
                    className={`w-full py-2.5 rounded-xl text-xs font-black tracking-widest uppercase border transition-all ${
                      !hasUserBooked && recommendedSlots.availableSlots > 0
                        ? "bg-electric-500 text-white hover:bg-electric-600 border-electric-500"
                        : "bg-zinc-200 dark:bg-slate-800 text-zinc-400 border-zinc-200 dark:border-slate-800 cursor-not-allowed"
                    }`}
                  >
                    {hasUserBooked
                      ? "Slot Already Booked"
                      : recommendedSlots.availableSlots > 0
                      ? "Book Recommended Slot"
                      : "No Booking Slots Available"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />

                  <span className="font-extrabold text-base tracking-tight text-zinc-900 dark:text-white">
                    Live map · Pattanagere / RR Nagar
                  </span>
                </div>

                {recommendation.station !== "AVOID" && (
                  <div className="text-[11px] font-bold text-electric-600 dark:text-electric-400 flex items-center gap-1.5 animate-pulse bg-electric-500/10 px-2.5 py-0.5 rounded-full border border-electric-500/20">
                    <Zap className="w-3.5 h-3.5 fill-current" />

                    <span>Routing to Station {recommendation.station}</span>
                  </div>
                )}
              </div>

              <BangaloreMap
                userLat={latNum}
                userLng={lngNum}
                onSelectLocation={(name, lat, lng) =>
                  handleSelectLocation(name, lat, lng)
                }
                liveData={liveData}
                recommendedStationId={recommendation.station}
                safeStations={safeStationsList}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-200/40 dark:border-slate-800/60 pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />

                  <h2 className="font-bold text-base tracking-tight text-zinc-900 dark:text-white">
                    Alternative Charging Stations Diagnostics
                  </h2>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Total Stations: 3
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["A", "B", "C"] as const).map((id) => {
                  const s = STATIONS_METADATA[id];
                  const liveStation = liveData.stations[id];
                  const diagnostic = getStationSafetyDiagnostics(id);
                  const isRecommended = recommendation.station === id;
                  const slotMetrics = getSlotMetrics(liveStation, id);

                  const cardBorderClass = isRecommended
                    ? "recommended-border-glow border-electric-500"
                    : diagnostic.isSafe
                    ? "border-zinc-200/70 dark:border-slate-800/80 hover:border-electric-500/50"
                    : "border-zinc-200/70 dark:border-slate-800/80 hover:border-coral-500/50";

                  const tagBgClass = diagnostic.isSafe
                    ? "bg-electric-500/10 text-electric-600 dark:text-electric-400 border-electric-500/25"
                    : "bg-coral-500/10 text-coral-600 dark:text-coral-400 border-coral-500/25";

                  return (
                    <div
                      key={id}
                      className={`glass-panel rounded-xl p-4 shadow-sm border transition-all duration-300 relative flex flex-col justify-between ${cardBorderClass}`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-base text-zinc-900 dark:text-white">
                            Station {id}
                          </span>

                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tagBgClass}`}
                          >
                            {diagnostic.isSafe ? "GREEN" : "RED"}
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 leading-tight">
                          {s.name}
                        </h4>

                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold mb-3">
                          {s.region}
                        </p>

                        {!diagnostic.isSafe && (
                          <div className="bg-coral-500/5 text-coral-600 dark:text-coral-400 text-[10px] p-2.5 rounded-lg border border-coral-500/10 mb-3 leading-relaxed font-semibold">
                            <span className="font-bold">Avoid Reason:</span>{" "}
                            {diagnostic.reason}
                          </div>
                        )}

                        {diagnostic.isSafe && (
                          <div className="bg-electric-500/5 text-electric-600 dark:text-electric-400 text-[10px] p-2.5 rounded-lg border border-electric-500/10 mb-3 leading-relaxed font-semibold">
                            Station is safe and ready to receive charging
                            requests.
                          </div>
                        )}

                        <div className="space-y-1.5 border-t border-zinc-150 dark:border-slate-800/40 pt-3 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          <div className="flex justify-between">
                            <span>Distance</span>

                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {liveStation.distance.toFixed(2)} km
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Station Load</span>

                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {liveStation.load}%
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Occupancy</span>

                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {slotMetrics.occupancy} /{" "}
                              {slotMetrics.totalSlots} slots
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Booking Slots</span>

                            <span
                              className={`font-black ${
                                slotMetrics.availableSlots <= 0
                                  ? "text-coral-500"
                                  : "text-electric-500"
                              }`}
                            >
                              {slotMetrics.availableSlotsText}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Your Booking</span>

                            <span className="font-bold text-blue-500">
                              {bookingConfirmation?.stationId === id
                                ? "Booked here"
                                : "None"}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span>Waiting Time</span>

                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {liveStation.waitingTime} min
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleBookSlot(id)}
                        disabled={
                          hasUserBooked ||
                          !diagnostic.isSafe ||
                          slotMetrics.availableSlots <= 0
                        }
                        className={`w-full mt-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase border transition-all ${
                          !hasUserBooked &&
                          diagnostic.isSafe &&
                          slotMetrics.availableSlots > 0
                            ? isRecommended
                              ? "bg-electric-500 text-white hover:bg-electric-600 border-electric-500"
                              : "bg-transparent text-electric-500 hover:bg-electric-500 hover:text-white border-electric-500/60"
                            : "bg-zinc-200 dark:bg-slate-800 text-zinc-400 border-zinc-200 dark:border-slate-850 cursor-not-allowed"
                        }`}
                      >
                        {hasUserBooked
                          ? bookingConfirmation?.stationId === id
                            ? "Booked"
                            : "Slot Already Booked"
                          : slotMetrics.availableSlots <= 0
                          ? "Fully Booked"
                          : diagnostic.isSafe
                          ? "Book Charging Slot"
                          : "Unavailable"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}