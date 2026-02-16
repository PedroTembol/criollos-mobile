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
