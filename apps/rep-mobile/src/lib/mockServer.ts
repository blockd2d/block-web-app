import type {
  Cluster,
  Me,
  Stop,
  KnockLog,
  Quote,
  QuoteLineItem,
  ClusterMapData,
  LatLng
} from "../types";

const org = { id: "org_mock", name: "Nova Services" };
const user = { id: "user_mock", email: "rep@mock.test" };

export const mockMe: Me = {
  user,
  org,
  role: "rep",
  fullName: "Mock Rep"
};

function plusDaysAt(daysFromToday: number, hour: number, minute: number) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString();
}

const clusters: Cluster[] = [
  {
    id: "cl_1001",
    name: "Brownsburg South",
    status: "assigned",
    stopCount: 14,
    completedCount: 3,
    walkingDistanceMiles: 1.6,
    estDurationMins: 55,
    scheduledStart: plusDaysAt(0, 9, 0),
    scheduledEnd: plusDaysAt(0, 10, 0),
    startLat: 39.8436,
    startLng: -86.3947
  },
  {
    id: "cl_1002",
    name: "Avon West",
    status: "active",
    stopCount: 22,
    completedCount: 12,
    walkingDistanceMiles: 2.4,
    estDurationMins: 80,
    scheduledStart: plusDaysAt(1, 13, 30),
    scheduledEnd: plusDaysAt(1, 15, 0),
    startLat: 39.7647,
    startLng: -86.3993
  },
  {
    id: "cl_1003",
    name: "Plainfield North",
    status: "assigned",
    stopCount: 18,
    completedCount: 0,
    walkingDistanceMiles: 2.1,
    estDurationMins: 70,
    scheduledStart: null,
    scheduledEnd: null,
    startLat: 39.7194,
    startLng: -86.3997
  }
];

function makeStops(clusterId: string, baseAddr: string, n: number, baseLat: number, baseLng: number): Stop[] {
  return Array.from({ length: n }).map((_, i) => {
    const seq = i + 1;
    const row = Math.floor(i / 5);
    const col = i % 5;
    const serpCol = row % 2 === 0 ? col : 4 - col;

    const lat = baseLat + row * 0.00045;
    const lng = baseLng + serpCol * 0.00045;

    return {
      id: `${clusterId}_stop_${seq}`,
      clusterId,
      sequence: seq,
      address1: `${100 + seq} ${baseAddr}`,
      city: "Hendricks County",
      state: "IN",
      zip: "46112",
      lat,
      lng,
      leadName: null,
      propertyNotes: null,
      completed: seq % 5 === 0
    };
  });
}

const stopsByCluster: Record<string, Stop[]> = {
  cl_1001: makeStops("cl_1001", "W Maple St", 14, 39.8436, -86.3947),
  cl_1002: makeStops("cl_1002", "N County Rd", 22, 39.7647, -86.3993),
  cl_1003: makeStops("cl_1003", "E Main St", 18, 39.7194, -86.3997)
};

function toLatLng(s: Stop): LatLng {
  return { latitude: s.lat ?? 0, longitude: s.lng ?? 0 };
}

function boundaryFromStops(stops: Stop[]): LatLng[] {
  const pts = stops.filter((s) => typeof s.lat === "number" && typeof s.lng === "number");
  if (!pts.length) return [];
  let minLat = pts[0].lat as number;
  let maxLat = pts[0].lat as number;
  let minLng = pts[0].lng as number;
  let maxLng = pts[0].lng as number;
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat as number);
    maxLat = Math.max(maxLat, p.lat as number);
    minLng = Math.min(minLng, p.lng as number);
    maxLng = Math.max(maxLng, p.lng as number);
  }
  const pad = 0.0006;
  return [
    { latitude: minLat - pad, longitude: minLng - pad },
    { latitude: minLat - pad, longitude: maxLng + pad },
    { latitude: maxLat + pad, longitude: maxLng + pad },
    { latitude: maxLat + pad, longitude: minLng - pad }
  ];
}

const mapDataByCluster: Record<string, ClusterMapData> = {
  cl_1001: {
    boundary: boundaryFromStops(stopsByCluster.cl_1001),
    route: stopsByCluster.cl_1001.slice().sort((a, b) => a.sequence - b.sequence).map(toLatLng)
  },
  cl_1002: {
    boundary: boundaryFromStops(stopsByCluster.cl_1002),
    route: stopsByCluster.cl_1002.slice().sort((a, b) => a.sequence - b.sequence).map(toLatLng)
  },
  cl_1003: {
    boundary: boundaryFromStops(stopsByCluster.cl_1003),
    route: stopsByCluster.cl_1003.slice().sort((a, b) => a.sequence - b.sequence).map(toLatLng)
  }
};

const knockLogs: KnockLog[] = [];
const quotes: Quote[] = [];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockServer = {
  async signIn(email: string, _password: string) {
    await sleep(450);
    if (!email.includes("@")) throw new Error("Invalid email");
    return { token: "mock_token", me: { ...mockMe, user: { ...mockMe.user, email } } };
  },

  async me(token: string | null) {
    await sleep(250);
    if (!token) throw new Error("401 Unauthorized");
    return mockMe;
  },

  async listAssignedClusters(_userId: string) {
    await sleep(350);
    return clusters;
  },

  async getClusterStops(clusterId: string) {
    await sleep(250);
    const stops = stopsByCluster[clusterId];
    if (!stops) throw new Error("404 Cluster not found");
    return stops.slice().sort((a, b) => a.sequence - b.sequence);
  },

  async getClusterMapData(clusterId: string): Promise<ClusterMapData> {
    await sleep(180);
    return mapDataByCluster[clusterId] ?? { boundary: null, route: null };
  },

  async createKnockLog(payload: Omit<KnockLog, "id" | "createdAt">) {
    await sleep(220);
    const item: KnockLog = {
      id: `kn_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...payload
    };
    knockLogs.unshift(item);
    return item;
  },

  async upsertQuote(payload: Omit<Quote, "id" | "updatedAt" | "totalCents"> & { totalCents?: number }) {
    await sleep(260);
    const total = payload.totalCents ?? payload.basePriceCents + payload.lineItems.reduce((a, it) => a + it.amountCents, 0);
    const existingIdx = quotes.findIndex((q) => q.clientWriteId === payload.clientWriteId);
    const updated: Quote = {
      id: existingIdx >= 0 ? quotes[existingIdx].id : `qt_${Math.random().toString(16).slice(2)}`,
      updatedAt: new Date().toISOString(),
      totalCents: total,
      ...payload,
      lineItems: payload.lineItems as QuoteLineItem[]
    };
    if (existingIdx >= 0) quotes[existingIdx] = updated;
    else quotes.unshift(updated);
    return updated;
  },

  async listQuotesForStop(stopId: string) {
    await sleep(180);
    return quotes.filter((q) => q.stopId === stopId).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
};
