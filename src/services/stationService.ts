import { ref, onValue, set } from "firebase/database";
import { database } from "@/lib/firebase";

export type StationData = {
  load: number;
  totalSlots: number;
  loadStatus: "GREEN" | "RED";
  occupancy: number;
  occupied: boolean;
  distance: number;
  waitingTime: number;
  sensorDistanceCm?: number;
  lat: number;
  lng: number;
};

export type DashboardData = {
  stations: {
    A: StationData;
    B: StationData;
    C: StationData;
  };
  grid: {
    headroom: number;
    status: "GREEN" | "RED";
  };
  vehicle: {
    battery: number;
  };
  recommendation?: {
    station: "A" | "B" | "C" | "AVOID";
    ledStatus: "GREEN" | "RED";
    reason: string;
    updatedAt?: string;
  };
};

export const DEFAULT_DASHBOARD_DATA: DashboardData = {
  stations: {
    A: {
      load: 42,
      loadStatus: "GREEN",
      occupancy: 1,
      totalSlots: 3,
      occupied: true,
      distance: 0.5,
      waitingTime: 3,
      sensorDistanceCm: 20,
      lat: 12.9249,
      lng: 77.5106,
    },
    B: {
      load: 68,
      loadStatus: "GREEN",
      occupancy: 2,
      totalSlots: 3,
      occupied: true,
      distance: 1.2,
      waitingTime: 10,
      sensorDistanceCm: 25,
      lat: 12.9304,
      lng: 77.5199,
    },
    C: {
      load: 91,
      loadStatus: "RED",
      occupancy: 3,
      totalSlots: 3,
      occupied: true,
      distance: 2.1,
      waitingTime: 25,
      sensorDistanceCm: 30,
      lat: 12.9182,
      lng: 77.5051,
    },
  },
  grid: {
    headroom: 32,
    status: "GREEN",
  },
  vehicle: {
    battery: 45,
  },
};

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toStatus = (value: unknown, fallback: "GREEN" | "RED") =>
  value === "RED" || value === "GREEN" ? value : fallback;

const normalizeDashboardData = (raw: Partial<DashboardData> | null): DashboardData => ({
  stations: {
    A: normalizeStation(raw?.stations?.A, DEFAULT_DASHBOARD_DATA.stations.A),
    B: normalizeStation(raw?.stations?.B, DEFAULT_DASHBOARD_DATA.stations.B),
    C: normalizeStation(raw?.stations?.C, DEFAULT_DASHBOARD_DATA.stations.C),
  },
  grid: {
    headroom: toNumber(raw?.grid?.headroom, DEFAULT_DASHBOARD_DATA.grid.headroom),
    status: toStatus(raw?.grid?.status, DEFAULT_DASHBOARD_DATA.grid.status),
  },
  vehicle: {
    battery: toNumber(raw?.vehicle?.battery, DEFAULT_DASHBOARD_DATA.vehicle.battery),
  },
  recommendation: raw?.recommendation,
});

const normalizeStation = (
  station: Partial<StationData> | undefined,
  fallback: StationData
): StationData => ({
  load: toNumber(station?.load, fallback.load),
  loadStatus: toStatus(station?.loadStatus, fallback.loadStatus),
  occupancy: toNumber(station?.occupancy, fallback.occupancy),
  totalSlots: toNumber(station?.totalSlots, fallback.totalSlots ?? 3),
  occupied:
    typeof station?.occupied === "boolean"
      ? station.occupied
      : fallback.occupied,
  distance: toNumber(station?.distance, fallback.distance),
  waitingTime: toNumber(station?.waitingTime, fallback.waitingTime),
  sensorDistanceCm: toNumber(
    station?.sensorDistanceCm,
    fallback.sensorDistanceCm ?? 0
  ),
  lat: toNumber(station?.lat, fallback.lat),
  lng: toNumber(station?.lng, fallback.lng),
});

export function subscribeToDashboardData(
  callback: (data: DashboardData) => void
) {
  const rootRef = ref(database, "/");

  callback(DEFAULT_DASHBOARD_DATA);

  return onValue(
    rootRef,
    (snapshot) => callback(normalizeDashboardData(snapshot.val() as Partial<DashboardData> | null)),
    () => callback(DEFAULT_DASHBOARD_DATA)
  );
}

export async function writeRecommendationToFirebase(
  station: "A" | "B" | "C" | "AVOID",
  reason: string
) {
  const ledStatus = station === "AVOID" ? "RED" : "GREEN";

  await set(ref(database, "/recommendation"), {
    station,
    ledStatus,
    reason,
    updatedAt: new Date().toISOString(),
  });
}