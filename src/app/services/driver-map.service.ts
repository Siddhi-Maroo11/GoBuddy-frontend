import { Injectable } from '@angular/core';
import * as Leaflet from 'leaflet';
import { Subject } from 'rxjs';
import { API } from '../constants/api.constants';
import { createPickupIcon } from '../utils/map.utils';

export interface MapClickEvent {
  lat: number;
  lng: number;
}
eaflet
@Injectable({ providedIn: 'root' })
export class DriverMapService {
  private map!: Leaflet.Map;
  private driverMarker!: Leaflet.Marker;
  private routeCoords: [number, number][] = [];
  private routeLayer: Leaflet.Polyline | null = null;
  private pickupMarker: Leaflet.Marker | null = null;

  public mapClick$ = new Subject<MapClickEvent>();

  public initMap(elementId: string, center: [number, number], zoom: number): void {
    this.map = Leaflet.map(elementId, { zoomControl: false }).setView(center, zoom);
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
    Leaflet.control.zoom({ position: 'bottomright' }).addTo(this.map);
    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      this.mapClick$.next({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    setTimeout(() => this.map.invalidateSize(), 0);
  }

  public placeDriverMarker(lat: number, lng: number): void {
    if (this.driverMarker) this.map.removeLayer(this.driverMarker);
    const icon = Leaflet.divIcon({
      className: '',
      html: `<div style="position:relative;width:40px;height:40px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(124,58,237,0.15);"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:#fff;border:2px solid #7c3aed;
             display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(124,58,237,0.4);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#7c3aed">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1
                     c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5
                     S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5
                     1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    this.driverMarker = Leaflet.marker([lat, lng], { icon }).addTo(this.map);
  }

  public removeDriverMarker(): void {
    if (this.driverMarker) this.map.removeLayer(this.driverMarker);
  }

  public setView(lat: number, lng: number, zoom: number): void {
    this.map.setView([lat, lng], zoom);
  }

  public invalidateSize(): void {
    this.map?.invalidateSize();
  }

  public panToDriver(lat: number, lng: number): void {
    this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }

  public async fetchAndDrawRoute(
    fromLng: number,
    fromLat: number,
    toLng: number,
    toLat: number,
    color: string,
    pickupLabel?: string,
    pickupLat?: number,
    pickupLng?: number,
  ): Promise<{ coords: [number, number][]; distanceKm: number }> {
    this.clearRoute();

    const res = await fetch(API.osrm.route(fromLng, fromLat, toLng, toLat));
    const data = await res.json();
    if (!data.routes?.length) return { coords: [], distanceKm: 0 };

    const rawCoords: [number, number][] = data.routes[0].geometry.coordinates;
    const distanceKm = Math.round((data.routes[0].distance / 1000) * 100) / 100;

    this.routeCoords = rawCoords.map(([lng, lat]) => [lat, lng] as [number, number]);

    this.routeLayer = Leaflet.polyline(this.routeCoords, {
      color,
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
    }).addTo(this.map);

    if (pickupLabel && pickupLat !== undefined && pickupLng !== undefined) {
      if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
      this.pickupMarker = Leaflet.marker([pickupLat, pickupLng], { icon: createPickupIcon() })
        .addTo(this.map)
        .bindPopup(pickupLabel);
    }

    setTimeout(() => {
      this.map.invalidateSize();
      if (this.routeLayer)
        this.map.fitBounds(this.routeLayer.getBounds(), { padding: [60, 60], maxZoom: 15 });
    }, 100);

    return { coords: rawCoords, distanceKm };
  }

  public trimRoute(driverLat: number, driverLng: number): void {
    if (!this.routeLayer || this.routeCoords.length < 2) return;

    let closestIndex = 0;
    let minDist = Infinity;

    this.routeCoords.forEach(([lat, lng], i) => {
      const d = Math.hypot(lat - driverLat, lng - driverLng);
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    });

    this.routeCoords = this.routeCoords.slice(closestIndex);

    if (this.routeCoords.length < 2) {
      this.clearRoute();
      return;
    }

    this.routeLayer.setLatLngs(this.routeCoords);
  }

  public clearRoute(): void {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.pickupMarker) {
      this.map.removeLayer(this.pickupMarker);
      this.pickupMarker = null;
    }
    this.routeCoords = [];
  }
}
 