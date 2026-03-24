import { Injectable } from '@angular/core';
import * as Leaflet from 'leaflet';
import { API } from '../constants/api.constants';
import { SelectedLocation } from '../models/location.model';
import { createPickupIcon, createDropIcon, createSelfDriverIcon } from '../utils/map.utils';
import { Subject } from 'rxjs';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '../constants/api.constants';

export interface MapClickEvent {
  lat: number;
  lng: number;
}

export interface MarkerDragEvent {
  lat: number;
  lng: number;
  type: 'pickup' | 'drop';
}

@Injectable({ providedIn: 'root' })
export class PassengerMapService {
  private map!: Leaflet.Map;
  private pickupMarker: Leaflet.Marker | null = null;
  private dropMarker: Leaflet.Marker | null = null;
  private driverMarkers: Map<string, Leaflet.Marker> = new Map();
  private routeLayer: Leaflet.GeoJSON | null = null;
  private driverRouteCoords: [number, number][] = [];
  private driverRouteLayer: Leaflet.Polyline | null = null;
  private passengerMarker: Leaflet.Marker | null = null;

  public mapClick$ = new Subject<MapClickEvent>();
  public markerDrag$ = new Subject<MarkerDragEvent>();

  public initMap(elementId: string, center: [number, number], zoom: number): void {
    this.map = Leaflet.map(elementId, { zoomControl: false }).setView(center, zoom);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    Leaflet.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      this.mapClick$.next({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    setTimeout(() => this.map.invalidateSize(), 0);
  }

  public invalidateSize(): void {
    this.map?.invalidateSize({ animate: false });
  }

  public setView(lat: number, lng: number, zoom: number): void {
    this.map.setView([lat, lng], zoom);
  }

  public fitBounds(bounds: Leaflet.LatLngBounds, options?: any): void {
    this.map.fitBounds(bounds, options);
  }

  public placePickupMarker(lat: number, lng: number): void {
    if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
    this.pickupMarker = Leaflet.marker([lat, lng], { icon: createPickupIcon(), draggable: true }).addTo(
      this.map,
    );
    this.pickupMarker.on('dragend', (e) => {
      const pos = (e.target as Leaflet.Marker).getLatLng();
      this.markerDrag$.next({ lat: pos.lat, lng: pos.lng, type: 'pickup' });
    });
  }

  public placeDropMarker(lat: number, lng: number): void {
    if (this.dropMarker) this.map.removeLayer(this.dropMarker);
    this.dropMarker = Leaflet.marker([lat, lng], { icon: createDropIcon(), draggable: true }).addTo(
      this.map,
    );
    this.dropMarker.on('dragend', (e) => {
      const pos = (e.target as Leaflet.Marker).getLatLng();
      this.markerDrag$.next({ lat: pos.lat, lng: pos.lng, type: 'drop' });
    });
  }

  public placePassengerMarker(lat: number, lng: number): void {
    if (this.passengerMarker) {
      this.passengerMarker.setLatLng([lat, lng]);
    } else {
      this.passengerMarker = Leaflet.marker([lat, lng], { icon: createPickupIcon() }).addTo(this.map);
    }
  }

  public removePassengerMarker(): void {
    if (this.passengerMarker) {
      this.map.removeLayer(this.passengerMarker);
      this.passengerMarker = null;
    }
  }

  public addDriverMarker(driverId: string, lat: number, lng: number): void {
    if (this.driverMarkers.has(driverId)) {
      this.driverMarkers.get(driverId)!.setLatLng([lat, lng]);
      return;
    }
    const marker = Leaflet.marker([lat, lng], { icon: createSelfDriverIcon() }).addTo(this.map);
    this.driverMarkers.set(driverId, marker);
  }

  public updateDriverMarker(driverId: string, lat: number, lng: number): void {
    if (this.driverMarkers.has(driverId)) {
      this.driverMarkers.get(driverId)!.setLatLng([lat, lng]);
      this.trimDriverRoute(lat, lng);
    } else {
      this.addDriverMarker(driverId, lat, lng);
    }
  }

  public removeDriverMarker(driverId: string): void {
    if (this.driverMarkers.has(driverId)) {
      this.map.removeLayer(this.driverMarkers.get(driverId)!);
      this.driverMarkers.delete(driverId);
    }
  }

  public async drawPickupDropRoute(
    pickup: SelectedLocation,
    drop: SelectedLocation,
  ): Promise<number> {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    try {
      const res = await fetch(API.osrm.route(pickup.lng, pickup.lat, drop.lng, drop.lat));
      const data = await res.json();
      if (!data.routes?.length) return 0;

      const distanceKm = Math.round((data.routes[0].distance / 1000) * 100) / 100;

      this.routeLayer = Leaflet.geoJSON(data.routes[0].geometry, {
        style: { color: '#4285F4', weight: 5, opacity: 0.9, lineCap: 'round', lineJoin: 'round' },
      }).addTo(this.map);

      setTimeout(() => {
        this.map.invalidateSize();
        this.map.fitBounds(this.routeLayer!.getBounds(), {
          padding: [80, 80],
          maxZoom: 15,
          animate: true,
        });
      }, 100);

      return distanceKm; 
    } catch (err) {
      console.error('Route error:', err);
      return 0;
    }
  }

  public async drawDriverRoute(
    driverLat: number,
    driverLng: number,
    pickup: SelectedLocation,
  ): Promise<void> {
    this.clearDriverRoute();

    try {
      const res = await fetch(API.osrm.route(driverLng, driverLat, pickup.lng, pickup.lat));
      const data = await res.json();
      if (!data.routes?.length) return;

      this.driverRouteCoords = data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );

      this.driverRouteLayer = Leaflet.polyline(this.driverRouteCoords, {
        color: '#7c3aed',
        weight: 4,
        opacity: 0.8,
        dashArray: '8,6',
      }).addTo(this.map);

      setTimeout(() => {
        this.map.invalidateSize();
        if (this.driverRouteLayer)
          this.map.fitBounds(this.driverRouteLayer.getBounds(), { padding: [60, 60], maxZoom: 15 });
      }, 100);
    } catch (err) {
      console.error('Driver route error:', err);
    }
  }

  public async drawDropRoute(pickup: SelectedLocation, drop: SelectedLocation): Promise<void> {
    this.clearDriverRoute();

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }

    if (this.pickupMarker) {
      this.map.removeLayer(this.pickupMarker);
      this.pickupMarker = null;
    }

    try {
      const res = await fetch(API.osrm.route(pickup.lng, pickup.lat, drop.lng, drop.lat));
      const data = await res.json();
      if (!data.routes?.length) return;

      this.driverRouteCoords = data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );

      this.driverRouteLayer = Leaflet.polyline(this.driverRouteCoords, {
        color: '#4285F4',
        weight: 5,
        opacity: 0.9,
      }).addTo(this.map);

      setTimeout(() => {
        this.map.invalidateSize();
        if (this.driverRouteLayer)
          this.map.fitBounds(this.driverRouteLayer.getBounds(), { padding: [60, 60], maxZoom: 15 });
      }, 100);
    } catch (err) {
      console.error('Drop route error:', err);
    }
  }

  private trimDriverRoute(driverLat: number, driverLng: number): void {
    if (!this.driverRouteLayer || this.driverRouteCoords.length < 2) return;

    let closestIndex = 0;
    let minDist = Infinity;

    this.driverRouteCoords.forEach(([lat, lng], i) => {
      const d = Math.hypot(lat - driverLat, lng - driverLng);
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    });

    this.driverRouteCoords = this.driverRouteCoords.slice(closestIndex);

    if (this.driverRouteCoords.length < 2) {
      this.clearDriverRoute();
      return;
    }

    this.driverRouteLayer.setLatLngs(this.driverRouteCoords);
    this.map.panTo([driverLat, driverLng], { animate: true, duration: 0.5 });
  }

  public clearDriverRoute(): void {
    if (this.driverRouteLayer) {
      this.map.removeLayer(this.driverRouteLayer);
      this.driverRouteLayer = null;
    }
    this.driverRouteCoords = [];
  }

  public clearRoutes(): void {
    this.clearDriverRoute();
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }
  public resetMap(): void {
    this.driverMarkers.forEach((marker) => this.map.removeLayer(marker));
    this.driverMarkers.clear();

    if (this.pickupMarker) {
      this.map.removeLayer(this.pickupMarker);
      this.pickupMarker = null;
    }

    if (this.dropMarker) {
      this.map.removeLayer(this.dropMarker);
      this.dropMarker = null;
    }

    if (this.passengerMarker) {
      this.map.removeLayer(this.passengerMarker);
      this.passengerMarker = null;
    }

    this.clearRoutes();

    this.map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  }
}
