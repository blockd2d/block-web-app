import { z } from 'zod';

type Role = 'admin' | 'manager' | 'rep' | 'labor';
type Profile = {
    id: string;
    org_id: string;
    role: Role;
    name: string;
    email: string;
    created_at?: string;
};
type Org = {
    id: string;
    name: string;
    created_at?: string;
};
type County = {
    id: string;
    org_id: string;
    name: string;
    fips?: string | null;
    bounds?: any | null;
    created_at?: string;
};
type ClusterSet = {
    id: string;
    org_id: string;
    county_id: string;
    filters_json: any;
    status: 'queued' | 'running' | 'complete' | 'failed';
    progress: number;
    created_at?: string;
    created_by?: string;
};
type Cluster = {
    id: string;
    org_id: string;
    cluster_set_id: string;
    center_lat: number;
    center_lng: number;
    hull_geojson: any;
    stats_json: any;
    assigned_rep_id?: string | null;
    color?: string | null;
    created_at?: string;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
};
type Rep = {
    id: string;
    org_id: string;
    profile_id?: string | null;
    name: string;
    home_lat: number;
    home_lng: number;
    active: boolean;
};
type InteractionOutcome = 'not_home' | 'talked_not_interested' | 'lead' | 'quote' | 'sold' | 'followup' | 'do_not_knock';
type Interaction = {
    id: string;
    org_id: string;
    rep_id: string;
    property_id: string;
    outcome: InteractionOutcome;
    notes?: string | null;
    followup_at?: string | null;
    created_at?: string;
};
type SaleStatus = 'lead' | 'quote' | 'sold' | 'cancelled';
type Sale = {
    id: string;
    org_id: string;
    rep_id: string;
    property_id: string;
    price?: number | null;
    service_type?: string | null;
    notes?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
    status: SaleStatus;
    created_at?: string;
    updated_at?: string;
};
type Laborer = {
    id: string;
    org_id: string;
    profile_id?: string | null;
    name: string;
    active: boolean;
};
type JobStatus = 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
type Job = {
    id: string;
    org_id: string;
    sale_id: string;
    laborer_id?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    status: JobStatus;
    created_at?: string;
};
type MessageThread = {
    id: string;
    org_id: string;
    rep_id?: string | null;
    customer_phone: string;
    property_id?: string | null;
    last_message_at?: string | null;
};
type Message = {
    id: string;
    org_id: string;
    thread_id: string;
    direction: 'inbound' | 'outbound';
    body: string;
    twilio_sid?: string | null;
    sent_at?: string | null;
    status?: string | null;
};
type ExportRecord = {
    id: string;
    org_id: string;
    type: 'sales' | 'assignments';
    status: 'queued' | 'running' | 'complete' | 'failed';
    storage_path?: string | null;
    created_at?: string;
};

declare const RoleSchema: z.ZodEnum<["admin", "manager", "rep", "labor"]>;
declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    turnstileToken: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    turnstileToken?: string | null | undefined;
}, {
    email: string;
    password: string;
    turnstileToken?: string | null | undefined;
}>;
declare const InviteCreateSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodEnum<["admin", "manager", "rep", "labor"]>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "admin" | "manager" | "rep" | "labor";
}, {
    email: string;
    role: "admin" | "manager" | "rep" | "labor";
}>;
declare const InviteAcceptSchema: z.ZodObject<{
    token: z.ZodString;
    name: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
    name: string;
}, {
    password: string;
    token: string;
    name: string;
}>;
declare const RepUpsertSchema: z.ZodObject<{
    name: z.ZodString;
    home_lat: z.ZodNumber;
    home_lng: z.ZodNumber;
    active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    home_lat: number;
    home_lng: number;
    active: boolean;
}, {
    name: string;
    home_lat: number;
    home_lng: number;
    active?: boolean | undefined;
}>;
declare const ClusterSetCreateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    county_id: z.ZodString;
    filters: z.ZodObject<{
        radius_m: z.ZodDefault<z.ZodNumber>;
        min_houses: z.ZodDefault<z.ZodNumber>;
        value_min: z.ZodOptional<z.ZodNumber>;
        value_max: z.ZodOptional<z.ZodNumber>;
        exclude_dnk: z.ZodOptional<z.ZodBoolean>;
        only_unworked: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        radius_m: number;
        min_houses: number;
        value_min?: number | undefined;
        value_max?: number | undefined;
        exclude_dnk?: boolean | undefined;
        only_unworked?: boolean | undefined;
    }, {
        radius_m?: number | undefined;
        min_houses?: number | undefined;
        value_min?: number | undefined;
        value_max?: number | undefined;
        exclude_dnk?: boolean | undefined;
        only_unworked?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    county_id: string;
    filters: {
        radius_m: number;
        min_houses: number;
        value_min?: number | undefined;
        value_max?: number | undefined;
        exclude_dnk?: boolean | undefined;
        only_unworked?: boolean | undefined;
    };
    name?: string | undefined;
}, {
    county_id: string;
    filters: {
        radius_m?: number | undefined;
        min_houses?: number | undefined;
        value_min?: number | undefined;
        value_max?: number | undefined;
        exclude_dnk?: boolean | undefined;
        only_unworked?: boolean | undefined;
    };
    name?: string | undefined;
}>;
declare const InteractionCreateSchema: z.ZodObject<{
    property_id: z.ZodString;
    outcome: z.ZodEnum<["not_home", "talked_not_interested", "lead", "quote", "sold", "followup", "do_not_knock"]>;
    notes: z.ZodOptional<z.ZodString>;
    followup_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    property_id: string;
    outcome: "not_home" | "talked_not_interested" | "lead" | "quote" | "sold" | "followup" | "do_not_knock";
    notes?: string | undefined;
    followup_at?: string | undefined;
}, {
    property_id: string;
    outcome: "not_home" | "talked_not_interested" | "lead" | "quote" | "sold" | "followup" | "do_not_knock";
    notes?: string | undefined;
    followup_at?: string | undefined;
}>;
declare const SaleCreateSchema: z.ZodObject<{
    property_id: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["lead", "quote", "sold", "cancelled"]>>;
    price: z.ZodOptional<z.ZodNumber>;
    service_type: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    customer_name: z.ZodOptional<z.ZodString>;
    customer_phone: z.ZodOptional<z.ZodString>;
    customer_email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "lead" | "quote" | "sold" | "cancelled";
    property_id: string;
    notes?: string | undefined;
    price?: number | undefined;
    service_type?: string | undefined;
    customer_name?: string | undefined;
    customer_phone?: string | undefined;
    customer_email?: string | undefined;
}, {
    property_id: string;
    status?: "lead" | "quote" | "sold" | "cancelled" | undefined;
    notes?: string | undefined;
    price?: number | undefined;
    service_type?: string | undefined;
    customer_name?: string | undefined;
    customer_phone?: string | undefined;
    customer_email?: string | undefined;
}>;
declare const FollowupCreateSchema: z.ZodObject<{
    property_id: z.ZodString;
    due_at: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    property_id: string;
    due_at: string;
    notes?: string | undefined;
}, {
    property_id: string;
    due_at: string;
    notes?: string | undefined;
}>;
declare const MessageSendSchema: z.ZodObject<{
    to: z.ZodString;
    body: z.ZodString;
    property_id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    to: string;
    body: string;
    property_id?: string | undefined;
}, {
    to: string;
    body: string;
    property_id?: string | undefined;
}>;
declare const PaymentCreateIntentSchema: z.ZodObject<{
    job_id: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    customer_phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    job_id: string;
    amount: number;
    currency: string;
    customer_phone?: string | undefined;
}, {
    job_id: string;
    amount: number;
    customer_phone?: string | undefined;
    currency?: string | undefined;
}>;

declare const PosthogEvents: {
    readonly ORG_LOGIN: "org_login";
    readonly ORG_LOGOUT: "org_logout";
    readonly INVITE_CREATED: "invite_created";
    readonly INVITE_ACCEPTED: "invite_accepted";
    readonly CLUSTERSET_CREATED: "clusterset_created";
    readonly CLUSTERSET_COMPLETED: "clusterset_completed";
    readonly CLUSTER_ASSIGNED: "cluster_assigned";
    readonly CONTRACT_SIGNED: "contract_signed";
    readonly INTERACTION_LOGGED: "interaction_logged";
    readonly SALE_CREATED: "sale_created";
    readonly CONTRACT_GENERATED: "contract_generated";
    readonly MESSAGE_SENT: "message_sent";
    readonly JOB_STARTED: "job_started";
    readonly JOB_COMPLETED: "job_completed";
    readonly PAYMENT_LINK_CREATED: "payment_link_created";
    readonly PAYMENT_CONFIRMED: "payment_confirmed";
};

type LatLng = {
    lat: number;
    lng: number;
};
/** Graham scan convex hull (returns counter-clockwise points). */
declare function convexHull(points: LatLng[]): LatLng[];
declare function centroid(points: LatLng[]): LatLng;

type DbPoint = LatLng & {
    id: string;
    value?: number | null;
};
type DbCluster = {
    id: string;
    memberPropertyIds: string[];
    center: LatLng;
    hull: LatLng[];
};
/** Convert meters to miles. */
declare function metersToMiles(m: number): number;
/** DBSCAN clustering adapted from Block V6 (grid index + haversine). */
declare function dbscanCluster(points: DbPoint[], epsMeters: number, minPts: number, onProgress?: (p: number) => void): DbCluster[];

export { type Cluster, type ClusterSet, ClusterSetCreateSchema, type County, type DbCluster, type DbPoint, type ExportRecord, FollowupCreateSchema, type Interaction, InteractionCreateSchema, type InteractionOutcome, InviteAcceptSchema, InviteCreateSchema, type Job, type JobStatus, type Laborer, type LatLng, LoginSchema, type Message, MessageSendSchema, type MessageThread, type Org, PaymentCreateIntentSchema, PosthogEvents, type Profile, type Rep, RepUpsertSchema, type Role, RoleSchema, type Sale, SaleCreateSchema, type SaleStatus, centroid, convexHull, dbscanCluster, metersToMiles };
