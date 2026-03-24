export interface NearbyDriver {
  connectionId: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  driverName: string;
  vehicleModel: string;
}

export interface DriverLocation {
  connectionId: string;
  driverName: string;
  vehicleModel: string;
  latitude: number;
  longitude: number;
  isBusy: boolean;
}