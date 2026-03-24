import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as Leaflet from 'leaflet';
import * as signalR from '@microsoft/signalr';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import {
  API,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_CITY,
  REQUEST_TIMEOUT_MS,
} from '../../../constants/api.constants';
import { NearbyDriver } from '../../../models/driver.model';
import { LocationSuggestion, SelectedLocation } from '../../../models/location.model';
import {
  createPickupIcon,
  createDropIcon,
  createDriverMarkerIcon,
  calculateDistance,
  appendCityIfNeeded,
} from '../../../utils/map.utils';
import { STRINGS } from '../../../constants/shared.constants';
 
@Component({
  selector: 'app-passenger-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './passenger-dashboard.html',
  styleUrl: './passenger-dashboard.scss',
})
export class PassengerDashboard implements AfterViewInit, AfterViewChecked, OnDestroy {
  public pickupQuery: string = STRINGS.empty;
  public dropQuery: string = STRINGS.empty;
  public pickupSuggestions: LocationSuggestion[] = [];
  public dropSuggestions: LocationSuggestion[] = [];
  public selectedPickup: SelectedLocation | null = null;
  public selectedDrop: SelectedLocation | null = null;
 
  public requestError: string | null = null;
  public rideAccepted: boolean = false;
  public rideRejected: boolean = false;
  public rideTimeout: boolean = false;
  public acceptedDriver: any = null;
  public passengerPin: string | null = null;
  public requestingDriverIds: Set<string> = new Set();
  public pendingDriverId: string | null = null;
  public requestSent: boolean = false;
 
  public activeInput: 'pickup' | 'drop' | null = null;
  public nearbyDrivers: NearbyDriver[] = [];
  public selectedDriver: NearbyDriver | null = null;
  public isSearching: boolean = false;
 
  private routeLayer: Leaflet.GeoJSON | null = null;
  private driverRouteLayer: Leaflet.GeoJSON | null = null;
  private lastSidebarState: boolean = false;
  private map!: Leaflet.Map;
  private pickupMarker: Leaflet.Marker | null = null;
  private dropMarker: Leaflet.Marker | null = null;
  private driverMarkers: Map<string, Leaflet.Marker> = new Map();
  private hubConnection!: signalR.HubConnection;
  private pickupDebounce: any;
  private dropDebounce: any;
 
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}
 
  public ngAfterViewInit(): void {
    this.initMap();
    this.initSignalR();
  }
 
  public ngAfterViewChecked(): void {
    const currentState: boolean = !!(this.selectedPickup && this.selectedDrop);
    if (currentState !== this.lastSidebarState) {
      this.lastSidebarState = currentState;
      setTimeout(() => this.map.invalidateSize({ animate: false }), 310);
    }
  }
 
  public ngOnDestroy(): void {
    if (this.hubConnection) this.hubConnection.stop();
    clearTimeout(this.pickupDebounce);
    clearTimeout(this.dropDebounce);
  }
 
  private initMap(): void {
    this.map = Leaflet.map('passenger-map', { zoomControl: false }).setView(
      DEFAULT_MAP_CENTER,
      DEFAULT_MAP_ZOOM,
    );
    Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    Leaflet.control.zoom({ position: 'bottomright' }).addTo(this.map);
 
    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (this.activeInput === 'pickup') {
        this.setPickup(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        this.reverseGeocode(lat, lng, 'pickup');
      } else if (this.activeInput === 'drop') {
        this.setDrop(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        this.reverseGeocode(lat, lng, 'drop');
      }
      this.cdr.detectChanges();
    });
 
    setTimeout(() => this.map.invalidateSize(), 0);
  }
 
  private placePickupMarker(lat: number, lng: number): void {
    if (this.pickupMarker) this.map.removeLayer(this.pickupMarker);
    this.pickupMarker = Leaflet.marker([lat, lng], { icon: createPickupIcon(), draggable: true }).addTo(
      this.map,
    );
    this.pickupMarker.on('dragend', (e) => {
      const { lat, lng } = (e.target as Leaflet.Marker).getLatLng();
      this.selectedPickup = { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
      this.reverseGeocode(lat, lng, 'pickup');
    });
  }
 
  private placeDropMarker(lat: number, lng: number): void {
    if (this.dropMarker) this.map.removeLayer(this.dropMarker);
    this.dropMarker = Leaflet.marker([lat, lng], { icon: createDropIcon(), draggable: true }).addTo(
      this.map,
    );
    this.dropMarker.on('dragend', (e) => {
      const { lat, lng } = (e.target as Leaflet.Marker).getLatLng();
      this.selectedDrop = { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
      this.reverseGeocode(lat, lng, 'drop');
    });
  }
 
  private addDriverMarker(driverId: string, lat: number, lng: number): void {
    if (this.driverMarkers.has(driverId)) {
      this.driverMarkers.get(driverId)!.setLatLng([lat, lng]);
      return;
    }
    const marker: Leaflet.Marker = Leaflet.marker([lat, lng], { icon: createDriverMarkerIcon() }).addTo(
      this.map,
    );
    this.driverMarkers.set(driverId, marker);
  }
 
  private updateDriverMarker(driverId: string, lat: number, lng: number): void {
    if (this.driverMarkers.has(driverId)) this.driverMarkers.get(driverId)!.setLatLng([lat, lng]);
    else this.addDriverMarker(driverId, lat, lng);
  }
 
  private removeDriverMarker(driverId: string): void {
    if (this.driverMarkers.has(driverId)) {
      this.map.removeLayer(this.driverMarkers.get(driverId)!);
      this.driverMarkers.delete(driverId);
    }
  }
 
  private async drawRoute(): Promise<void> {
    if (!this.selectedPickup || !this.selectedDrop) return;
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    try {
      const res = await fetch(
        API.osrm.route(
          this.selectedPickup.lng,
          this.selectedPickup.lat,
          this.selectedDrop.lng,
          this.selectedDrop.lat,
        ),
      );
      const data = await res.json();
      if (!data.routes?.length) return;
 
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
 
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Route error:', err);
    }
  }
 
  private async drawDriverToPassengerRoute(driverLat: number, driverLng: number): Promise<void> {
    if (!this.selectedPickup) return;
    if (this.driverRouteLayer) {
      this.map.removeLayer(this.driverRouteLayer);
      this.driverRouteLayer = null;
    }
    try {
      const res = await fetch(
        API.osrm.route(driverLng, driverLat, this.selectedPickup.lng, this.selectedPickup.lat),
      );
      const data = await res.json();
      if (!data.routes?.length) return;
 
      this.driverRouteLayer = Leaflet.geoJSON(data.routes[0].geometry, {
        style: { color: '#7c3aed', weight: 4, opacity: 0.8, lineCap: 'round', dashArray: '8,6' },
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

  private initSignalR(): void {
  this.hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(API.signalR.hub, {
      skipNegotiation: true,
      transport: signalR.HttpTransportType.WebSockets,
    })
    .withAutomaticReconnect()
    .build();

  this.registerSignalRHandlers();

  this.hubConnection
    .start()
    .then(() => this.fetchExistingDrivers())
    .catch((err) => console.error('SignalR error:', err));
}

private registerSignalRHandlers(): void {
  this.registerPresenceHandlers();
  this.registerRideRequestHandlers();
}

private registerPresenceHandlers(): void {
  this.hubConnection.on('DriverOnline', (data) => {
    this.addDriverMarker(data.driverId, data.latitude, data.longitude);
    if (this.selectedPickup && this.selectedDrop) this.findDrivers();
    this.cdr.detectChanges();
  });

  this.hubConnection.on('LocationUpdated', (data) => {
    this.updateDriverMarker(data.driverId, data.latitude, data.longitude);
    const existing = this.nearbyDrivers.find((d) => d.connectionId === data.driverId);
    if (existing && this.selectedPickup) {
      existing.latitude = data.latitude;
      existing.longitude = data.longitude;
      existing.distanceKm = calculateDistance(
        this.selectedPickup.lat,
        this.selectedPickup.lng,
        data.latitude,
        data.longitude,
      );
    }
    this.cdr.detectChanges();
  });

  this.hubConnection.on('DriverOffline', (data) => {
    this.removeDriverMarker(data.driverId);
    this.nearbyDrivers = this.nearbyDrivers.filter((d) => d.connectionId !== data.driverId);
    if (this.selectedDriver?.connectionId === data.driverId) this.selectedDriver = null;
    this.cdr.detectChanges();
  });
}

private registerRideRequestHandlers(): void {
  this.hubConnection.on('RequestSent', () => {
    this.requestSent = true;
    this.cdr.detectChanges();
  });

  this.hubConnection.on('RequestFailed', (data) => {
    this.requestError = data.message;
    this.clearPendingDriver();
    this.cdr.detectChanges();
  });

  this.hubConnection.on('RideAccepted', (data) => {
    this.requestSent = false;
    this.rideAccepted = true;
    this.rideRejected = false;
    this.rideTimeout = false;
    this.acceptedDriver = data;
    this.passengerPin = this.authService.getUserPin();
    this.requestingDriverIds.clear();
    this.pendingDriverId = null;
    this.drawDriverToPassengerRoute(data.driverLat, data.driverLng);
    this.cdr.detectChanges();
  });

  this.hubConnection.on('RideRejected', () => {
    this.requestSent = false;
    this.rideRejected = true;
    this.rideAccepted = false;
    this.clearPendingDriver();
    this.cdr.detectChanges();
  });

  this.hubConnection.on('RequestTimeout', () => {
    this.requestSent = false;
    this.rideTimeout = true;
    this.clearPendingDriver();
    this.cdr.detectChanges();
  });
}

private clearPendingDriver(): void {
  if (this.pendingDriverId) {
    this.requestingDriverIds.delete(this.pendingDriverId);
    this.pendingDriverId = null;
  }
}

  private fetchExistingDrivers(): void {
    this.http.get<any[]>(API.drivers.all).subscribe({
      next: (drivers) => {
        drivers.forEach((d) => this.addDriverMarker(d.connectionId, d.latitude, d.longitude));
        this.cdr.detectChanges();
      },
    });
  }
 
  private searchLocation(query: string, type: 'pickup' | 'drop'): void {
    const url: string = API.nominatim.search(appendCityIfNeeded(query, DEFAULT_CITY));
    this.http.get<LocationSuggestion[]>(url).subscribe({
      next: (results) => {
        if (type === 'pickup') this.pickupSuggestions = results;
        else this.dropSuggestions = results;
        this.cdr.detectChanges();
      },
    });
  }
 
  private reverseGeocode(lat: number, lng: number, type: 'pickup' | 'drop'): void {
    this.http.get<any>(API.nominatim.reverse(lat, lng)).subscribe({
      next: (result) => {
        const name: string =
          result.display_name?.split(',')[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (type === 'pickup') {
          this.pickupQuery = name;
          this.selectedPickup!.name = name;
        } else {
          this.dropQuery = name;
          this.selectedDrop!.name = name;
        }
        this.cdr.detectChanges();
        this.drawRoute();
        this.checkAutoSearch();
      },
    });
  }
 
  private setPickup(lat: number, lng: number, name: string): void {
    this.selectedPickup = { lat, lng, name };
    this.pickupQuery = name;
    this.placePickupMarker(lat, lng);
    this.activeInput = 'drop';
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.selectedDrop) this.drawRoute();
  }
 
  private setDrop(lat: number, lng: number, name: string): void {
    this.selectedDrop = { lat, lng, name };
    this.dropQuery = name;
    this.placeDropMarker(lat, lng);
    this.activeInput = null;
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    if (this.selectedPickup) this.drawRoute();
  }
 
  private checkAutoSearch(): void {
    if (this.selectedPickup && this.selectedDrop) {
      this.findDrivers();
      setTimeout(() => this.map.invalidateSize({ animate: false }), 350);
    }
  }
 
  private findDrivers(): void {
    if (!this.selectedPickup) return;
    this.isSearching = true;
    this.cdr.detectChanges();
    this.http
      .get<NearbyDriver[]>(API.drivers.nearby(this.selectedPickup.lat, this.selectedPickup.lng))
      .subscribe({
        next: (drivers) => {
          this.nearbyDrivers = drivers;
          this.isSearching = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isSearching = false;
          this.cdr.detectChanges();
        },
      });
  }
 
  public setActiveInput(type: 'pickup' | 'drop'): void {
    this.activeInput = type;
  }
 
  public onPickupInput(): void {
    clearTimeout(this.pickupDebounce);
    this.selectedPickup = null;
    if (this.pickupQuery.length < 2) {
      this.pickupSuggestions = [];
      return;
    }
    this.pickupDebounce = setTimeout(() => this.searchLocation(this.pickupQuery, 'pickup'), 400);
  }
 
  public onDropInput(): void {
    clearTimeout(this.dropDebounce);
    this.selectedDrop = null;
    if (this.dropQuery.length < 2) {
      this.dropSuggestions = [];
      return;
    }
    this.dropDebounce = setTimeout(() => this.searchLocation(this.dropQuery, 'drop'), 400);
  }
 
  public selectPickup(s: LocationSuggestion): void {
    this.setPickup(parseFloat(s.lat), parseFloat(s.lon), s.display_name.split(',')[0]);
    this.pickupSuggestions = [];
    this.checkAutoSearch();
  }
 
  public selectDrop(s: LocationSuggestion): void {
    this.setDrop(parseFloat(s.lat), parseFloat(s.lon), s.display_name.split(',')[0]);
    this.dropSuggestions = [];
    this.checkAutoSearch();
  }
 
  public useCurrentLocation(): void {
    if (!navigator.geolocation) return;
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.setPickup(lat, lng, 'Current Location');
        this.pickupQuery = 'Current Location';
        this.map.setView([lat, lng], 15);
        this.reverseGeocode(lat, lng, 'pickup');
        this.cdr.detectChanges();
      },
      (err) => console.error(err),
      { enableHighAccuracy: true },
    );
  }
 
  public selectDriver(driver: NearbyDriver): void {
    this.selectedDriver = driver;
    this.map.setView([driver.latitude, driver.longitude], 15);
    this.cdr.detectChanges();
  }
 
  public sendRideRequest(driver: NearbyDriver): void {
    if (!this.selectedPickup || !this.selectedDrop) return;
    const passengerId: string | null = this.authService.getUserId();
    const passengerName: string | null = this.authService.getUserName();
    if (!passengerId || !passengerName) return;
 
    this.requestSent = false;
    this.requestingDriverIds.add(driver.connectionId);
    this.pendingDriverId = driver.connectionId;
    this.requestError = null;
    this.rideRejected = false;
    this.rideTimeout = false;
    this.cdr.detectChanges();
 
    const invoke = (): void => {
      this.hubConnection
        .invoke(
          'SendRideRequest',
          driver.connectionId,
          passengerId,
          passengerName,
          this.selectedPickup!.lat,
          this.selectedPickup!.lng,
          this.selectedDrop!.lat,
          this.selectedDrop!.lng,
          this.selectedPickup!.name,
          this.selectedDrop!.name,
        )
        .catch((err) => {
          console.error('Request error:', err);
          this.requestingDriverIds.delete(driver.connectionId);
          this.pendingDriverId = null;
          this.cdr.detectChanges();
        });
    };
 
    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      invoke();
    } else {
      this.hubConnection.start().then(() => invoke());
    }
 
    setTimeout(() => {
      if (this.requestingDriverIds.has(driver.connectionId) && !this.rideAccepted) {
        this.requestingDriverIds.delete(driver.connectionId);
        if (this.pendingDriverId === driver.connectionId) this.pendingDriverId = null;
        this.cdr.detectChanges();
      }
    }, REQUEST_TIMEOUT_MS);
  }
 
  public logout(): void {
    const passengerId: string | null = this.authService.getUserId();
    if (passengerId && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('PassengerLeft', passengerId).catch(() => {});
    }
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
 
 