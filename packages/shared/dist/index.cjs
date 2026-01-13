"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ClusterSetCreateSchema: () => ClusterSetCreateSchema,
  FollowupCreateSchema: () => FollowupCreateSchema,
  InteractionCreateSchema: () => InteractionCreateSchema,
  InviteAcceptSchema: () => InviteAcceptSchema,
  InviteCreateSchema: () => InviteCreateSchema,
  LoginSchema: () => LoginSchema,
  MessageSendSchema: () => MessageSendSchema,
  PaymentCreateIntentSchema: () => PaymentCreateIntentSchema,
  PosthogEvents: () => PosthogEvents,
  RepUpsertSchema: () => RepUpsertSchema,
  RoleSchema: () => RoleSchema,
  SaleCreateSchema: () => SaleCreateSchema,
  centroid: () => centroid,
  convexHull: () => convexHull,
  dbscanCluster: () => dbscanCluster,
  metersToMiles: () => metersToMiles
});
module.exports = __toCommonJS(index_exports);

// src/schemas.ts
var import_zod = require("zod");
var RoleSchema = import_zod.z.enum(["admin", "manager", "rep", "labor"]);
var LoginSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  password: import_zod.z.string().min(6),
  turnstileToken: import_zod.z.string().optional().nullable()
});
var InviteCreateSchema = import_zod.z.object({
  email: import_zod.z.string().email(),
  role: RoleSchema.refine((r) => r === "admin" || r === "manager", { message: "invite role must be admin/manager" })
});
var InviteAcceptSchema = import_zod.z.object({
  token: import_zod.z.string().min(10),
  name: import_zod.z.string().min(1),
  password: import_zod.z.string().min(8)
});
var RepUpsertSchema = import_zod.z.object({
  name: import_zod.z.string().min(1),
  home_lat: import_zod.z.number(),
  home_lng: import_zod.z.number(),
  active: import_zod.z.boolean().default(true)
});
var ClusterSetCreateSchema = import_zod.z.object({
  // Optional friendly name shown in the web UI
  name: import_zod.z.string().min(1).optional(),
  county_id: import_zod.z.string().uuid(),
  filters: import_zod.z.object({
    radius_m: import_zod.z.number().min(50).max(5e3).default(500),
    min_houses: import_zod.z.number().min(3).max(500).default(12),
    value_min: import_zod.z.number().optional(),
    value_max: import_zod.z.number().optional(),
    exclude_dnk: import_zod.z.boolean().optional(),
    only_unworked: import_zod.z.boolean().optional()
  })
});
var InteractionCreateSchema = import_zod.z.object({
  property_id: import_zod.z.string().uuid(),
  outcome: import_zod.z.enum(["not_home", "talked_not_interested", "lead", "quote", "sold", "followup", "do_not_knock"]),
  notes: import_zod.z.string().optional(),
  followup_at: import_zod.z.string().datetime().optional()
});
var SaleCreateSchema = import_zod.z.object({
  property_id: import_zod.z.string().uuid(),
  status: import_zod.z.enum(["lead", "quote", "sold", "cancelled"]).default("lead"),
  price: import_zod.z.number().optional(),
  service_type: import_zod.z.string().optional(),
  notes: import_zod.z.string().optional(),
  customer_name: import_zod.z.string().optional(),
  customer_phone: import_zod.z.string().optional(),
  customer_email: import_zod.z.string().optional()
});
var FollowupCreateSchema = import_zod.z.object({
  property_id: import_zod.z.string().uuid(),
  due_at: import_zod.z.string().datetime(),
  notes: import_zod.z.string().optional()
});
var MessageSendSchema = import_zod.z.object({
  to: import_zod.z.string().min(7),
  body: import_zod.z.string().min(1),
  property_id: import_zod.z.string().uuid().optional()
});
var PaymentCreateIntentSchema = import_zod.z.object({
  job_id: import_zod.z.string().uuid(),
  amount: import_zod.z.number().int().min(1),
  currency: import_zod.z.string().default("usd"),
  customer_phone: import_zod.z.string().optional()
});

// src/posthog.ts
var PosthogEvents = {
  ORG_LOGIN: "org_login",
  ORG_LOGOUT: "org_logout",
  INVITE_CREATED: "invite_created",
  INVITE_ACCEPTED: "invite_accepted",
  CLUSTERSET_CREATED: "clusterset_created",
  CLUSTERSET_COMPLETED: "clusterset_completed",
  CLUSTER_ASSIGNED: "cluster_assigned",
  CONTRACT_SIGNED: "contract_signed",
  INTERACTION_LOGGED: "interaction_logged",
  SALE_CREATED: "sale_created",
  CONTRACT_GENERATED: "contract_generated",
  MESSAGE_SENT: "message_sent",
  JOB_STARTED: "job_started",
  JOB_COMPLETED: "job_completed",
  PAYMENT_LINK_CREATED: "payment_link_created",
  PAYMENT_CONFIRMED: "payment_confirmed"
};

// src/clustering/hull.ts
function cross(o, a, b) {
  return (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
}
function convexHull(points) {
  if (!points || points.length < 3) return points ? [...points] : [];
  let lowest = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].lat < points[lowest].lat || points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng) {
      lowest = i;
    }
  }
  const pivot = points[lowest];
  const rest = points.filter((_, i) => i !== lowest);
  rest.sort((a, b) => {
    const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
    const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
    if (angleA !== angleB) return angleA - angleB;
    const distA = (a.lat - pivot.lat) ** 2 + (a.lng - pivot.lng) ** 2;
    const distB = (b.lat - pivot.lat) ** 2 + (b.lng - pivot.lng) ** 2;
    return distA - distB;
  });
  const stack = [pivot];
  for (const p of rest) {
    while (stack.length > 1 && cross(stack[stack.length - 2], stack[stack.length - 1], p) <= 0) {
      stack.pop();
    }
    stack.push(p);
  }
  return stack;
}
function centroid(points) {
  if (!points || points.length === 0) return { lat: 0, lng: 0 };
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

// src/clustering/dbscan.ts
var EARTH_RADIUS_MILES = 3958.8;
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}
function haversineMiles(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}
function metersToMiles(m) {
  return m / 1609.344;
}
function buildSpatialIndex(points, epsMiles) {
  let avgLat = 0;
  for (const p of points) avgLat += p.lat;
  avgLat /= points.length;
  const latDegPerMile = 1 / 69;
  const lngDegPerMile = 1 / (69 * Math.cos(avgLat * Math.PI / 180));
  const cellSizeLat = epsMiles * latDegPerMile * 1.1;
  const cellSizeLng = epsMiles * lngDegPerMile * 1.1;
  const grid = /* @__PURE__ */ new Map();
  points.forEach((point, index) => {
    const cellX = Math.floor(point.lng / cellSizeLng);
    const cellY = Math.floor(point.lat / cellSizeLat);
    const key = `${cellX},${cellY}`;
    const arr = grid.get(key) || [];
    arr.push(index);
    grid.set(key, arr);
  });
  return { grid, cellSizeLat, cellSizeLng };
}
function rangeQuery(points, pointIndex, index, epsMiles) {
  const point = points[pointIndex];
  const { grid, cellSizeLat, cellSizeLng } = index;
  const cellX = Math.floor(point.lng / cellSizeLng);
  const cellY = Math.floor(point.lat / cellSizeLat);
  const neighbors = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = `${cellX + dx},${cellY + dy}`;
      const cell = grid.get(key);
      if (!cell) continue;
      for (const idx of cell) {
        if (idx === pointIndex) continue;
        const dist = haversineMiles(point.lat, point.lng, points[idx].lat, points[idx].lng);
        if (dist <= epsMiles) neighbors.push(idx);
      }
    }
  }
  neighbors.push(pointIndex);
  return neighbors;
}
function expandCluster(points, labels, pointIndex, neighbors, clusterId, epsMiles, minPts, index) {
  labels[pointIndex] = clusterId;
  const queue = [...neighbors];
  const processed = /* @__PURE__ */ new Set([pointIndex]);
  while (queue.length > 0) {
    const currentIdx = queue.shift();
    if (processed.has(currentIdx)) continue;
    processed.add(currentIdx);
    if (labels[currentIdx] === -1) labels[currentIdx] = clusterId;
    if (labels[currentIdx] !== -2) continue;
    labels[currentIdx] = clusterId;
    const currentNeighbors = rangeQuery(points, currentIdx, index, epsMiles);
    if (currentNeighbors.length >= minPts) {
      for (const idx of currentNeighbors) {
        if (!processed.has(idx)) queue.push(idx);
      }
    }
  }
}
function dbscanCluster(points, epsMeters, minPts, onProgress) {
  if (!points || points.length === 0) return [];
  const epsMiles = metersToMiles(epsMeters);
  const index = buildSpatialIndex(points, epsMiles);
  const labels = new Array(points.length).fill(-2);
  let clusterId = 0;
  for (let i = 0; i < points.length; i++) {
    if (labels[i] !== -2) continue;
    const neighbors = rangeQuery(points, i, index, epsMiles);
    if (neighbors.length < minPts) labels[i] = -1;
    else {
      expandCluster(points, labels, i, neighbors, clusterId, epsMiles, minPts, index);
      clusterId++;
    }
    if (onProgress && i % 2e3 === 0) onProgress(i / points.length);
  }
  if (onProgress) onProgress(1);
  const clusters = [];
  for (let c = 0; c < clusterId; c++) {
    const memberIdx = [];
    for (let i = 0; i < labels.length; i++) if (labels[i] === c) memberIdx.push(i);
    if (memberIdx.length < minPts) continue;
    const memberPoints = memberIdx.map((i) => points[i]);
    const memberIds = memberPoints.map((p) => p.id);
    const center = centroid(memberPoints);
    const hull = convexHull(memberPoints);
    clusters.push({ id: uid("cluster"), memberPropertyIds: memberIds, center, hull });
  }
  return clusters;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClusterSetCreateSchema,
  FollowupCreateSchema,
  InteractionCreateSchema,
  InviteAcceptSchema,
  InviteCreateSchema,
  LoginSchema,
  MessageSendSchema,
  PaymentCreateIntentSchema,
  PosthogEvents,
  RepUpsertSchema,
  RoleSchema,
  SaleCreateSchema,
  centroid,
  convexHull,
  dbscanCluster,
  metersToMiles
});
