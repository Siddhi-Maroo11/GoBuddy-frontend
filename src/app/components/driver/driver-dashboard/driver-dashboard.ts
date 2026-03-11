import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../../services/auth.service';
import {
  API,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_CITY,
} from '../../../constants/api.constants';
import { LocationSuggestion } from '../../../models/location.model';
import {
  createPickupIcon,
  createSelfDriverIcon,
  appendCityIfNeeded,
} from '../../../utils/map.utils';
import { STRINGS } from '../../../constants/shared.constants';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-dashboard.html',
  styleUrl: './driver-dashboard.scss',
})
export class DriverDashboard implements AfterViewInit, OnDestroy {
  public isOnline: boolean = false;
  public isConnecting: boolean = false;
  public locationError: string | null = null;
  public currentLocation: { lat: number; lng: number } | null = null;
  public incomingRequest: any = null;
  public timeLeft: number = 20;
  public confirmedRide: any = null;
  public locationQuery: string = STRINGS.empty;
  public locationSuggestions: LocationSuggestion[] = [];

  private timerInterval: any = null;
  private routeLayer: L.GeoJSON | null = null;
  private locationDebounce: any;
  private manualLocationSet: boolean = false;
  private map!: L.Map;
  private driverMarker!: L.Marker;
  private watchId: number | null = null;
  private hubConnection!: signalR.HubConnection;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  public ngAfterViewInit(): void {
    this.initMap();
    this.initSignalR();
  }

  public ngOnDestroy(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.hubConnection) this.hubConnection.stop();
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  private initMap(): void {
    this.map = L.map('driver-map', { zoomControl: false }).setView(
      DEFAULT_MAP_CENTER,
      DEFAULT_MAP_ZOOM,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.isOnline) {
        const { lat, lng } = e.latlng;
        this.currentLocation = { lat, lng };
        this.manualLocationSet = true;
        this.placeDriverMarker(lat, lng);
        fetch(API.nominatim.reverse(lat, lng))
          .then((r) => r.json())
          .then((result) => {
            this.locationQuery = result.display_name?.split(',')[0] || STRINGS.empty;
            this.cdr.detectChanges();
          });
        this.cdr.detectChanges();
      }
    });

    setTimeout(() => this.map.invalidateSize(), 0);
  }

  private placeDriverMarker(lat: number, lng: number): void {
    if (this.driverMarker) this.map.removeLayer(this.driverMarker);
    this.driverMarker = L.marker([lat, lng], { icon: createSelfDriverIcon() }).addTo(this.map);
    this.map.setView([lat, lng], 16);
  }

  private async drawRideRoute(ride: any): Promise<void> {
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (!this.currentLocation) return;

    try {
      const res = await fetch(
        API.osrm.route(
          this.currentLocation.lng,
          this.currentLocation.lat,
          ride.pickupLng,
          ride.pickupLat,
        ),
      );
      const data = await res.json();
      if (!data.routes?.length) return;

      this.routeLayer = L.geoJSON(data.routes[0].geometry, {
        style: { color: '#4285F4', weight: 5, opacity: 0.9, lineCap: 'round' },
      }).addTo(this.map);

      L.marker([ride.pickupLat, ride.pickupLng], { icon: createPickupIcon() })
        .addTo(this.map)
        .bindPopup(`Pickup: ${ride.pickupName}`);

      setTimeout(() => {
        this.map.invalidateSize();
        this.map.fitBounds(this.routeLayer!.getBounds(), { padding: [60, 60], maxZoom: 15 });
      }, 100);
    } catch (err) {
      console.error('Route error:', err);
    }
  }

  private initSignalR(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(API.signalR.hub, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('IncomingRideRequest', (data) => {
      this.incomingRequest = data;
      this.startRequestTimer();
      this.cdr.detectChanges();
    });

    this.hubConnection.on('RequestExpired', () => {
      this.incomingRequest = null;
      this.stopTimer();
      this.cdr.detectChanges();
    });

    this.hubConnection.on('RideConfirmed', (data) => {
      this.confirmedRide = data;
      this.incomingRequest = null;
      this.stopTimer();
      this.drawRideRoute(data);
      this.cdr.detectChanges();
    });

    this.hubConnection.on('RideAlreadyAccepted', () => {
      this.confirmedRide = null;
      this.incomingRequest = null;
      this.stopTimer();
      this.cdr.detectChanges();
    });

    this.hubConnection.start().catch((err) => console.error('SignalR error:', err));
  }

  private startRequestTimer(): void {
    this.timeLeft = 20;
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.cdr.detectChanges();
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.incomingRequest = null;
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startWatching(): void {
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.currentLocation = { lat, lng };
        this.placeDriverMarker(lat, lng);
        this.cdr.detectChanges();
        if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
          this.hubConnection.invoke('UpdateLocation', lat, lng).catch((err) => console.error(err));
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  public toggleOnline(): void {
    this.isOnline ? this.goOffline() : this.goOnline();
  }

  public goOnline(): void {
    this.isConnecting = true;
    this.locationError = null;
    this.cdr.detectChanges();

    const driverName: string = this.authService.getUserName() ?? 'Driver';
    const vehicleModel: string = this.authService.getVehicleModel() ?? STRINGS.empty;

    const sendOnline = (lat: number, lng: number): void => {
      if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
        this.hubConnection
          .invoke('DriverGoOnline', lat, lng, driverName, vehicleModel)
          .catch((err) => console.error(err));
      } else {
        this.hubConnection.start().then(() => {
          this.hubConnection
            .invoke('DriverGoOnline', lat, lng, driverName, vehicleModel)
            .catch((err) => console.error(err));
        });
      }
    };

    if (this.manualLocationSet && this.currentLocation) {
      this.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
      this.isOnline = true;
      this.isConnecting = false;
      this.cdr.detectChanges();
      sendOnline(this.currentLocation.lat, this.currentLocation.lng);
      return;
    }

    if (!navigator.geolocation) {
      this.locationError = 'Geolocation not supported.';
      this.isConnecting = false;
      this.cdr.detectChanges();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
        this.isOnline = true;
        this.isConnecting = false;
        this.cdr.detectChanges();
        this.startWatching();
        sendOnline(this.currentLocation.lat, this.currentLocation.lng);
      },
      () => {
        this.locationError = 'Location access denied.';
        this.isConnecting = false;
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  public goOffline(): void {
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('DriverGoOffline').catch((err) => console.error(err));
    }
    this.isOnline = false;
    this.currentLocation = null;
    this.confirmedRide = null;
    this.incomingRequest = null;
    this.manualLocationSet = false;
    this.locationQuery = STRINGS.empty;
    this.stopTimer();
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.driverMarker) this.map.removeLayer(this.driverMarker);
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.cdr.detectChanges();
  }

  public acceptRequest(): void {
    this.hubConnection.invoke('AcceptRideRequest').catch((err) => console.error(err));
    this.stopTimer();
    this.incomingRequest = null;
    this.cdr.detectChanges();
  }

  public rejectRequest(): void {
    this.hubConnection.invoke('RejectRideRequest').catch((err) => console.error(err));
    this.stopTimer();
    this.incomingRequest = null;
    this.cdr.detectChanges();
  }

  public onLocationInput(): void {
    clearTimeout(this.locationDebounce);
    if (this.locationQuery.length < 2) {
      this.locationSuggestions = [];
      return;
    }
    this.locationDebounce = setTimeout(() => {
      fetch(API.nominatim.search(appendCityIfNeeded(this.locationQuery, DEFAULT_CITY)))
        .then((r) => r.json())
        .then((results) => {
          this.locationSuggestions = results;
          this.cdr.detectChanges();
        });
    }, 400);
  }

  public selectManualLocation(s: LocationSuggestion): void {
    const lat: number = parseFloat(s.lat);
    const lng: number = parseFloat(s.lon);
    this.currentLocation = { lat, lng };
    this.locationQuery = s.display_name.split(',')[0];
    this.locationSuggestions = [];
    this.manualLocationSet = true;
    this.placeDriverMarker(lat, lng);
    this.map.setView([lat, lng], 15);
    this.cdr.detectChanges();
  }

  public getTimerColor(): string {
    if (this.timeLeft > 10) return '#22c55e';
    if (this.timeLeft > 5) return '#f59e0b';
    return '#ef4444';
  }

  public logout(): void {
    if (this.isOnline) this.goOffline();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
