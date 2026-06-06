export type Asset = {
  id: number;
  groupId?: number;
  description?: string;
};

export type Marker = {
  id: number;
  groupId?: number;
  description?: string;
  lat?: number | null;
  lng?: number | null;
};

export type Route = {
  id: number;
  clientId?: number;
  description?: string;
  lineColor?: string;
  assetColorCode?: string;
  directionStartName?: string;
  directionEndName?: string;
  svgFillColor1?: string;
  svgFillColor2?: string;
  isOpen?: boolean;
  departureTimes?: string;
};

export type RoutePoint = {
  id: number;
  routeId?: number;
  direction?: number;
  order?: number;
  markerId?: number | null;
  lat: number;
  lng: number;
  type?: string;
  distance?: number;
  angle?: number;
  seconds?: number;
};

export type Position = {
  assetId?: number;
  driverId?: number;
  when?: string;
  speed?: number;
  inputX?: number;
  trail?: string;
  status?: number;
  msg?: string;
  extendedDescription?: string;
  routeId?: number;
  routePointNextId?: number;
  routePointPrevId?: number;
  lat?: number | null;
  lng?: number | null;
};

export type BootstrapResponse = {
  assets?: Asset[];
  markers?: Marker[];
  routes?: Route[];
  routePoints?: RoutePoint[];
  stops?: RoutePoint[];
  config?: Record<string, string>;
  positions?: Position[];
  fetchedAt?: string;
};

export type PositionsResponse = {
  positions?: Position[];
  fetchedAt?: string;
};

export type RoutesResponse = {
  routes?: Route[];
  fetchedAt?: string;
};

export type StopsResponse = {
  stops?: RoutePoint[];
  fetchedAt?: string;
};

export type EtaResponse = Record<string, unknown>;

export type TrackingStopSummary = {
  routePointId: number;
  markerId: number | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  order: number;
  seconds: number;
};

export type TrackingVehicleSnapshot = {
  assetId: number;
  label: string;
  driverId: number;
  routeId: number;
  routeName: string | null;
  routeColor: string | null;
  directionStartName: string | null;
  directionEndName: string | null;
  status: number;
  statusLabel: 'moving' | 'stopped' | 'idle' | 'unknown';
  message: string;
  speed: number;
  when: string;
  freshnessSeconds: number | null;
  freshnessLabel: 'live' | 'stale' | 'unknown';
  lat: number | null;
  lng: number | null;
  nextStop: TrackingStopSummary | null;
  previousStop: TrackingStopSummary | null;
};

export type TrackingBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type TrackingRouteHealthLabel = 'operational' | 'delayed' | 'offline' | 'no-signal';

export type TrackingServiceHealth = {
  status: 'healthy' | 'degraded' | 'offline';
  coveragePercent: number;
  liveCoveragePercent: number;
  routeHealth: Record<TrackingRouteHealthLabel, number>;
};

export type TrackingRouteSummary = {
  routeId: number;
  routeName: string | null;
  routeColor: string | null;
  directionStartName: string | null;
  directionEndName: string | null;
  totalVehicles: number;
  liveVehicles: number;
  staleVehicles: number;
  unknownVehicles: number;
  movingVehicles: number;
  stoppedVehicles: number;
  idleVehicles: number;
  vehicleLabels: string[];
  nextStops: string[];
  lastReportedAt: string | null;
  healthLabel: TrackingRouteHealthLabel;
  coveragePercent: number;
};

export type TrackingFreshnessBuckets = {
  live: number;
  delayed: number;
  offline: number;
  unknown: number;
};

export type TrackingUpcomingStopVehicle = {
  assetId: number;
  label: string;
  routeId: number;
  routeName: string | null;
  routeColor: string | null;
  freshnessLabel: string;
  nextStopEtaSeconds: number | null;
};

export type TrackingUpcomingStopSummary = {
  stopKey: string;
  routePointId: number;
  markerId: number | null;
  name: string;
  lat: number | null;
  lng: number | null;
  arrivalCount: number;
  liveVehicleCount: number;
  routeIds: number[];
  routeNames: string[];
  nextArrivalEtaSeconds: number | null;
  vehicles: TrackingUpcomingStopVehicle[];
};

export type TrackingSummary = {
  totalVehicles: number;
  filteredVehicles: number;
  liveVehicles: number;
  staleVehicles: number;
  unknownVehicles: number;
  movingVehicles: number;
  stoppedVehicles: number;
  idleVehicles: number;
  unknownStatusVehicles: number;
  routeIds: number[];
  routes: TrackingRouteSummary[];
  upcomingStops?: TrackingUpcomingStopSummary[];
  bounds: TrackingBounds | null;
  freshnessBuckets: TrackingFreshnessBuckets;
  serviceHealth: TrackingServiceHealth;
};

export type NearbyStopRoute = {
  routeId: number;
  routeName: string | null;
  routeColor: string | null;
  directionStartName: string | null;
  directionEndName: string | null;
  routePointIds: number[];
  directions: number[];
};

export type NearbyStop = {
  markerId: number;
  name: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  distanceLabel: string;
  routeCount: number;
  routes: NearbyStopRoute[];
};

export type NearbyStopsResponse = {
  status: string;
  source: string;
  fetchedAt: string;
  generatedAt: string;
  count: number;
  summary: {
    origin: { lat: number; lng: number };
    totalStops: number;
    returnedStops: number;
    maxDistanceMeters: number | null;
    nearestDistanceMeters: number | null;
    routeIds: number[];
  };
  data: NearbyStop[];
};

export type NearbyVehicle = {
  assetId: number;
  description: string;
  routeId: number;
  routeName: string | null;
  routeColor: string | null;
  lat: number;
  lng: number;
  distanceMeters: number;
  distanceLabel: string;
  speed: number;
  status: number;
  msg: string;
  lastReportedAt: string;
};

export type NearbyVehiclesResponse = {
  generatedAt: string;
  count: number;
  summary: {
    origin: { lat: number; lng: number };
    totalVehicles: number;
    returnedVehicles: number;
    nearestDistanceMeters: number | null;
    routeIds: number[];
  };
  data: NearbyVehicle[];
};

export type TrackingSnapshot = {
  vehicles: TrackingVehicleSnapshot[];
  fetchedAt: string;
  summary: TrackingSummary;
};

export type TrackingFilters = {
  assetId?: string | string[];
  routeId?: string | string[];
  status?: string | string[];
  freshness?: string | string[];
  limit?: number;
};

export type FeedbackRequest = {
  message?: string;
  msg?: string;
  rating?: number;
  source?: string;
};

export type FeedbackResponse = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

export type GastronomiaPlace = {
  id: string;
  title: string;
  category: string;
  categories: string[];
  summary: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  sourceUrl: string | null;
};

export type GastronomiaCategorySpotlight = {
  id: string;
  category: string;
  title: string;
  description: string;
  count: number;
  withImageCount: number;
  leadingPlaceId: string;
  leadingPlaceTitle: string;
  leadingPlaceSummary: string;
  leadingPlaceImageUrl: string | null;
  leadingPlaceImageAlt: string | null;
  categories: string[];
  actionLabel: string;
  actionHref: string;
};

export type GastronomiaSummaryAlert = {
  id: string;
  dedupeKey: string;
  scope: 'category' | 'combo' | 'visual';
  severity: 'info' | 'warning';
  title: string;
  message: string;
  count: number;
  categories: string[];
  withImageCount: number;
};

export type GastronomiaFeaturedPlace = {
  id: string;
  title: string;
  category: string;
  categories: string[];
  summary: string;
  imageUrl: string | null;
  imageAlt: string | null;
  sourceUrl: string | null;
  reason: string;
  actionLabel: string;
  actionHref: string;
};

export type GastronomiaSuggestedRoute = {
  id: string;
  title: string;
  description: string;
  categories: string[];
  placeIds: string[];
  placeTitles: string[];
  count: number;
  withImageCount: number;
  actionLabel: string;
  actionHref: string;
};

export type GastronomiaSummary = {
  categories: string[];
  categoryBreakdown: Array<{ category: string; count: number }>;
  withImageCount: number;
  sourceDomains: string[];
  categorySpotlights?: GastronomiaCategorySpotlight[];
  featuredPlaces?: GastronomiaFeaturedPlace[];
  suggestedRoutes?: GastronomiaSuggestedRoute[];
  alerts?: GastronomiaSummaryAlert[];
};

export type GastronomiaResponse = {
  status: 'success' | 'error';
  source: 'live' | 'cache';
  count: number;
  summary?: GastronomiaSummary;
  data: GastronomiaPlace[];
};

export type Evento = {
  id: string;
  title: string;
  category: string;
  categories: string[];
  summary: string;
  description: string;
  venue: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sourceUrl: string;
  publishedAt: string | null;
  rawDate: string | null;
};

export type EventosFeaturedPlan = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  eventIds: string[];
  primaryEventId: string;
  primaryEventTitle: string;
  primaryEventHref: string | null;
  categoryLabels: string[];
};

export type EventosSummaryAlert = {
  id: string;
  dedupeKey: string;
  scope: 'day' | 'weekend';
  severity: 'info' | 'warning';
  title: string;
  message: string;
  date: string | null;
  count: number;
  categories: string[];
  venue: string | null;
};

export type EventosSummary = {
  categories: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  upcomingCount: number;
  featuredPlans?: EventosFeaturedPlan[];
  alerts?: EventosSummaryAlert[];
};

export type EventosResponse = {
  status: 'success' | 'error';
  source: 'live' | 'cache';
  count: number;
  summary?: EventosSummary;
  data: Evento[];
};

export type DiscoveryFeedItem = {
  type: 'evento' | 'gastronomia' | 'info';
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string | null;
  imageAlt: string | null;
  link: string | null;
  date?: string;
  eventDate?: string | null;
  category: string;
  tag?: string;
  lat?: number | null;
  lng?: number | null;
  markerId?: number | null;
};

export type DiscoverySummaryAlert = {
  id: string;
  dedupeKey: string;
  scope: 'day' | 'mix' | 'food';
  severity: 'info' | 'warning';
  title: string;
  message: string;
  date: string | null;
  count: number;
  eventCount: number;
  foodCount: number;
  categories: string[];
};

export type DiscoverySummary = {
  types: Array<{ type: string; count: number }>;
  categories: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  withImageCount: number;
  sourceDomains: string[];
  alerts?: DiscoverySummaryAlert[];
};

export type DiscoveryResponse = {
  status: 'success' | 'error';
  source: 'live' | 'cache';
  count: number;
  summary?: DiscoverySummary;
  data: DiscoveryFeedItem[];
  generatedAt: string;
};

export type RecommendationType = 'mobility' | 'plan' | 'food' | 'service';
export type RecommendationPriority = 'high' | 'medium' | 'low';

export type CriolloRecommendation = {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  evidence: string[];
  tags: string[];
  sourceIds: string[];
};

export type CriolloRecommendationsSummary = {
  total: number;
  byType: Array<{ type: RecommendationType; count: number }>;
  priorities: Record<RecommendationPriority, number>;
  generatedFrom: {
    trackingFetchedAt: string | null;
    discoveryGeneratedAt: string | null;
  };
};

export type DiscoveryFilters = {
  q?: string;
  type?: string | string[];
  category?: string | string[];
  from?: string;
  to?: string;
  limit?: number;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
};

export type RecommendationsFeed = {
  generatedAt: string;
  count: number;
  summary: CriolloRecommendationsSummary;
  data: CriolloRecommendation[];
};

export type RecommendationsFilters = {
  type?: RecommendationType | RecommendationType[];
  limit?: number;
};

export type SearchResult = {
  type: 'route' | 'stop' | 'evento' | 'gastronomia';
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  imageUrl?: string | null;
  link?: string | null;
  metadata?: Record<string, any>;
};

export type SearchResponse = {
  status: 'success' | 'error';
  query: string;
  count: number;
  results: SearchResult[];
  suggestions: string[];
};
