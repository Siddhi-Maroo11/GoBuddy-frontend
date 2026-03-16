export const API_BASE = 'https://localhost:44338';

export const API = {
  auth: {
    login: `${API_BASE}/api/Auth/login`,
    register: `${API_BASE}/api/Auth/register`,
  },
  drivers: {
    nearby: (lat: number, lng: number, radius = 2) =>
      `${API_BASE}/api/drivers/nearby?latitude=${lat}&longitude=${lng}&radiusKm=${radius}`,
    all: `${API_BASE}/api/drivers/all`,
  },
  signalR: {
    hub: `${API_BASE}/hubs/driver`,
  },
  nominatim: {
    search: (query: string) =>
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&countrycodes=in&accept-language=en`,
    reverse: (lat: number, lng: number) =>
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`,
  },
  osrm: {
    route: (lng1: number, lat1: number, lng2: number, lat2: number) =>
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`,
  },
};

export const JWT_KEYS = {
  USER_ID: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  NAME: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  VEHICLE: 'VehicleModel',
  ROLE: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  PIN: 'UserPin',
  AVAILABLE_SEATS: 'AvailableSeats',
  RATE_PER_KM: 'RatePerKm',
};

export const DEFAULT_CITY = 'Jaipur';
export const DEFAULT_MAP_CENTER: [number, number] = [26.9124, 75.7873];
export const DEFAULT_MAP_ZOOM = 13;
export const NEARBY_RADIUS_KM = 2;
export const REQUEST_TIMEOUT_MS = 21000;