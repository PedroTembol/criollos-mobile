import type { RoutePoint } from './transportTypes';
import { haversineMeters, type LatLng } from './transportGeo';

type EdgeMode = 'walk' | 'trolley' | 'transfer';

type GraphEdge = {
  to: string;
  weight: number;
  mode: EdgeMode;
  routeId?: number;
  distanceMeters: number;
};

type GraphNode = {
  id: string;
  point?: RoutePoint;
  latlng: LatLng;
};

type Graph = Map<string, { node: GraphNode; edges: GraphEdge[] }>;

export type PlanStep = {
  mode: EdgeMode;
  from: LatLng;
  to: LatLng;
  routeId?: number;
  distanceMeters: number;
  durationSec: number;
};

export type RoutePlan = {
  steps: PlanStep[];
  totalDurationSec: number;
  totalDistanceMeters: number;
  nodeIds: string[];
};

const WALKING_SPEED_MPS = 1.3;
const TRANSFER_PENALTY_SEC = 90;

function routePointNodeId(point: RoutePoint) {
  return `rp:${point.id}`;
}

function buildGraph(routePoints: RoutePoint[]) {
  const graph: Graph = new Map();

  const ensureNode = (id: string, latlng: LatLng, point?: RoutePoint) => {
    if (!graph.has(id)) {
      graph.set(id, { node: { id, latlng, point }, edges: [] });
    }
  };

  routePoints.forEach((point) => {
    ensureNode(routePointNodeId(point), { lat: point.lat, lng: point.lng }, point);
  });

  const byRouteDirection = new Map<string, RoutePoint[]>();
  routePoints.forEach((point) => {
    if (point.routeId === undefined || point.direction === undefined) return;
    const key = `${point.routeId}:${point.direction}`;
    const group = byRouteDirection.get(key) ?? [];
    group.push(point);
    byRouteDirection.set(key, group);
  });

  for (const group of byRouteDirection.values()) {
    group.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let i = 0; i < group.length - 1; i += 1) {
      const current = group[i];
      const next = group[i + 1];
      const fromId = routePointNodeId(current);
      const toId = routePointNodeId(next);
      const distanceMeters =
        typeof next.distance === 'number' && next.distance > 0
          ? next.distance
          : haversineMeters(
              { lat: current.lat, lng: current.lng },
              { lat: next.lat, lng: next.lng },
            );
      const durationSec =
        typeof next.seconds === 'number' && next.seconds > 0
          ? next.seconds
          : Math.max(1, distanceMeters / WALKING_SPEED_MPS);
      graph.get(fromId)?.edges.push({
        to: toId,
        weight: durationSec,
        mode: 'trolley',
        routeId: current.routeId,
        distanceMeters,
      });
    }
  }

  const byMarker = new Map<number, RoutePoint[]>();
  routePoints.forEach((point) => {
    if (point.markerId == null) return;
    const group = byMarker.get(point.markerId) ?? [];
    group.push(point);
    byMarker.set(point.markerId, group);
  });

  for (const group of byMarker.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        const distanceMeters = haversineMeters(
          { lat: a.lat, lng: a.lng },
          { lat: b.lat, lng: b.lng },
        );
        const weight = TRANSFER_PENALTY_SEC + distanceMeters / WALKING_SPEED_MPS;
        const fromId = routePointNodeId(a);
        const toId = routePointNodeId(b);
        graph.get(fromId)?.edges.push({
          to: toId,
          weight,
          mode: 'transfer',
          routeId: b.routeId,
          distanceMeters,
        });
        graph.get(toId)?.edges.push({
          to: fromId,
          weight,
          mode: 'transfer',
          routeId: a.routeId,
          distanceMeters,
        });
      }
    }
  }

  return graph;
}

type DijkstraResult = {
  distance: Map<string, number>;
  previous: Map<string, { from: string; edge: GraphEdge }>;
};

function dijkstra(graph: Graph, startId: string): DijkstraResult {
  const distance = new Map<string, number>();
  const previous = new Map<string, { from: string; edge: GraphEdge }>();
  const visited = new Set<string>();

  for (const nodeId of graph.keys()) {
    distance.set(nodeId, Number.POSITIVE_INFINITY);
  }
  distance.set(startId, 0);

  while (visited.size < graph.size) {
    let currentId: string | null = null;
    let smallest = Number.POSITIVE_INFINITY;
    for (const [nodeId, dist] of distance.entries()) {
      if (!visited.has(nodeId) && dist < smallest) {
        smallest = dist;
        currentId = nodeId;
      }
    }

    if (currentId == null) break;
    visited.add(currentId);

    const node = graph.get(currentId);
    if (!node) continue;
    for (const edge of node.edges) {
      const nextDistance = smallest + edge.weight;
      if (nextDistance < (distance.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distance.set(edge.to, nextDistance);
        previous.set(edge.to, { from: currentId, edge });
      }
    }
  }

  return { distance, previous };
}

function reconstructPath(
  graph: Graph,
  previous: Map<string, { from: string; edge: GraphEdge }>,
  startId: string,
  endId: string,
): RoutePlan | null {
  if (!graph.has(endId) || !graph.has(startId)) return null;

  const steps: PlanStep[] = [];
  const nodeIds: string[] = [];
  let currentId = endId;
  while (currentId !== startId) {
    const previousEntry = previous.get(currentId);
    if (!previousEntry) return null;
    const fromNode = graph.get(previousEntry.from)?.node;
    const toNode = graph.get(currentId)?.node;
    if (!fromNode || !toNode) return null;

    steps.push({
      mode: previousEntry.edge.mode,
      from: fromNode.latlng,
      to: toNode.latlng,
      routeId: previousEntry.edge.routeId,
      distanceMeters: previousEntry.edge.distanceMeters,
      durationSec: previousEntry.edge.weight,
    });
    nodeIds.push(currentId);
    currentId = previousEntry.from;
  }

  nodeIds.push(startId);
  steps.reverse();
  nodeIds.reverse();

  const totalDurationSec = steps.reduce((acc, step) => acc + step.durationSec, 0);
  const totalDistanceMeters = steps.reduce((acc, step) => acc + step.distanceMeters, 0);

  return { steps, totalDurationSec, totalDistanceMeters, nodeIds };
}

export type PlanOptions = {
  maxWalkMeters?: number;
};

export function planRoute(
  origin: LatLng,
  destination: LatLng,
  routePoints: RoutePoint[],
  options: PlanOptions = {},
): RoutePlan | null {
  const maxWalkMeters = options.maxWalkMeters ?? 650;
  const graph = buildGraph(routePoints);

  const originId = 'origin';
  const destinationId = 'destination';

  graph.set(originId, { node: { id: originId, latlng: origin }, edges: [] });
  graph.set(destinationId, { node: { id: destinationId, latlng: destination }, edges: [] });

  const connectWalk = (fromId: string, fromLatLng: LatLng, toPoint: RoutePoint) => {
    const distanceMeters = haversineMeters(fromLatLng, { lat: toPoint.lat, lng: toPoint.lng });
    if (distanceMeters > maxWalkMeters) return;
    const durationSec = Math.max(1, distanceMeters / WALKING_SPEED_MPS);
    graph.get(fromId)?.edges.push({
      to: routePointNodeId(toPoint),
      weight: durationSec,
      mode: 'walk',
      distanceMeters,
    });
  };

  const connectWalkReverse = (toId: string, toLatLng: LatLng, fromPoint: RoutePoint) => {
    const distanceMeters = haversineMeters(toLatLng, { lat: fromPoint.lat, lng: fromPoint.lng });
    if (distanceMeters > maxWalkMeters) return;
    const durationSec = Math.max(1, distanceMeters / WALKING_SPEED_MPS);
    graph.get(routePointNodeId(fromPoint))?.edges.push({
      to: toId,
      weight: durationSec,
      mode: 'walk',
      distanceMeters,
    });
  };

  routePoints.forEach((point) => {
    connectWalk(originId, origin, point);
    connectWalkReverse(destinationId, destination, point);
  });

  const { previous } = dijkstra(graph, originId);
  return reconstructPath(graph, previous, originId, destinationId);
}
