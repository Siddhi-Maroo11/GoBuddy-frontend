import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../../services/auth.service';
import { DriverSignalRService } from '../../../services/driver-signalr.service';
import { DriverMapService } from '../../../services/driver-map.service';
import { DriverSimulationService } from '../../../services/driver-simulation.service';
import {
  API,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_CITY,
} from '../../../constants/api.constants';
import {
  SIMULATION_DURATION_MS,
  REQUEST_TIMEOUT_SECONDS,
  NOTIFICATION_DISMISS_MS,
  LOCATION_DEBOUNCE_MS,
  PIN_LENGTH,
  MANUAL_LOCATION_ZOOM,
  GEO_TIMEOUT_MS,
  GEO_MAX_AGE_MS,
  MIN_SEARCH_QUERY_LENGTH,
} from '../../../constants/app.constants';
import { LocationSuggestion } from '../../../models/location.model';
import { appendCityIfNeeded } from '../../../utils/map.utils';

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
  public timeLeft: number = REQUEST_TIMEOUT_SECONDS;
  public confirmedRide: any = null;
  public locationQuery: string = '';
  public locationSuggestions: LocationSuggestion[] = [];
  public driverName: string = '';
  public activeRideId: string | null = null;
  public pinConfirmed: boolean = false;
  public cancelError: string | null = null;
  public arrivedAtPickup: boolean = false;
  public arrivedAtDrop: boolean = false;
  public enteredPin: string = '';
  public pinError: string | null = null;
  public simulationRunning: boolean = false;
  public ridePaymentData: {
    passengerName: string;
    totalKm: number;
    ratePerKm: number;
    totalCost: number;
  } | null = null;

  private timerInterval: any = null;
  private locationDebounce: any;
  private manualLocationSet: boolean = false;
  private watchId: number | null = null;
  private subs: Subscription[] = [];
  private currentRideCoords: [number, number][] = [];
  private pickupToDropDistanceKm: number = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly signalRService: DriverSignalRService,
    private readonly mapService: DriverMapService,
    private readonly simulationService: DriverSimulationService,
  ) { }

  public ngAfterViewInit(): void {
    this.driverName = this.authService.getUserName() ?? 'Driver';
    this.cdr.detectChanges();
    this.mapService.initMap('driver-map', DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    this.subscribeToMapEvents();
    this.connectSignalR();
  }

  public ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.signalRService.disconnect();
    this.simulationService.stop();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
  }

  private subscribeToMapEvents(): void {
    this.subs.push(
      this.mapService.mapClick$.subscribe(({ lat, lng }) => {
        if (!this.isOnline) {
          this.currentLocation = { lat, lng };
          this.manualLocationSet = true;
          this.mapService.placeDriverMarker(lat, lng);
          fetch(API.nominatim.reverse(lat, lng))
            .then((r) => r.json())
            .then((result) => {
              this.locationQuery = result.display_name?.split(',')[0] || '';
              this.cdr.detectChanges();
            });
          this.cdr.detectChanges();
        }
      }),
    );
  }

  private connectSignalR(): void {
    this.signalRService.connect().catch((err) => console.error('SignalR error:', err));

    this.subs.push(
      this.signalRService.incomingRequest$.subscribe((data) => {
        this.incomingRequest = data;
        this.startRequestTimer();
        this.cdr.detectChanges();
      }),

      this.signalRService.requestExpired$.subscribe(() => {
        this.incomingRequest = null;
        this.stopTimer();
        this.cdr.detectChanges();
      }),

      this.signalRService.rideConfirmed$.subscribe(async (data) => {
        this.confirmedRide = data;
        this.activeRideId = data.rideId;
        this.pinConfirmed = false;
        this.arrivedAtPickup = false;
        this.arrivedAtDrop = false;
        this.pickupToDropDistanceKm = 0;
        this.enteredPin = '';
        this.pinError = null;
        this.cancelError = null;
        this.incomingRequest = null;
        this.stopTimer();
        this.loadPickupRoute(data);

        try {
          const res = await fetch(
            API.osrm.route(data.pickupLng, data.pickupLat, data.dropLng, data.dropLat)
          );
          const osrmData = await res.json();
          if (osrmData.routes?.length) {
            this.pickupToDropDistanceKm =
              Math.round((osrmData.routes[0].distance / 1000) * 100) / 100;
          }
        } catch (err) {
          console.error('Distance calc error:', err);
        }

        this.cdr.detectChanges();
      }),

      this.signalRService.driverArrived$.subscribe(() => {
        this.arrivedAtPickup = true;
        this.simulationService.stop();
        this.simulationRunning = false;
        this.cdr.detectChanges();
      }),

      this.signalRService.pinConfirmed$.subscribe(() => {
        this.pinConfirmed = true;
        this.arrivedAtPickup = false;
        this.enteredPin = '';
        this.pinError = null;
        this.cancelError = null;
        this.loadDropRoute(this.confirmedRide);
        this.cdr.detectChanges();
      }),

      this.signalRService.pinError$.subscribe((data) => {
        this.pinError = data.message;
        this.cdr.detectChanges();
      }),

      this.signalRService.rideCancelled$.subscribe((data) => {
        this.resetRideState();
        this.locationError = data.message;
        setTimeout(() => {
          this.locationError = null;
          this.cdr.detectChanges();
        }, NOTIFICATION_DISMISS_MS);
        this.cdr.detectChanges();
      }),

      this.signalRService.cancelError$.subscribe((data) => {
        this.cancelError = data.message;
        this.cdr.detectChanges();
      }),

      this.signalRService.cannotGoOffline$.subscribe((data) => {
        this.locationError = data.message;
        setTimeout(() => {
          this.locationError = null;
          this.cdr.detectChanges();
        }, NOTIFICATION_DISMISS_MS);
        this.cdr.detectChanges();
      }),

      this.signalRService.rideCompleted$.subscribe(() => {
        this.resetRideState();
        this.cdr.detectChanges();
      }),

      this.simulationService.step$.subscribe(({ lat, lng }) => {
        this.currentLocation = { lat, lng };
        this.mapService.placeDriverMarker(lat, lng);
        this.mapService.trimRoute(lat, lng);
        this.mapService.panToDriver(lat, lng);
        this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => { });
        this.cdr.detectChanges();
      }),
    );
  }

  private async loadPickupRoute(ride: any): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const { coords } = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng,
        this.currentLocation.lat,
        ride.pickupLng,
        ride.pickupLat,
        '#4285F4',
        `Pickup: ${ride.pickupName}`,
        ride.pickupLat,
        ride.pickupLng,
      );
      this.currentRideCoords = coords;
    } catch (err) {
      console.error('Pickup route error:', err);
    }
  }

  private async loadDropRoute(ride: any): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const { coords } = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng,
        this.currentLocation.lat,
        ride.dropLng,
        ride.dropLat,
        '#7c3aed',
      );
      this.currentRideCoords = coords;
    } catch (err) {
      console.error('Drop route error:', err);
    }
  }

  private resetRideState(): void {
    this.confirmedRide = null;
    this.activeRideId = null;
    this.pinConfirmed = false;
    this.arrivedAtPickup = false;
    this.arrivedAtDrop = false;
    this.ridePaymentData = null;
    this.pickupToDropDistanceKm = 0;
    this.enteredPin = '';
    this.pinError = null;
    this.cancelError = null;
    this.simulationRunning = false;
    this.simulationService.stop();
    this.mapService.clearRoute();
  }

  private startRequestTimer(): void {
    this.timeLeft = REQUEST_TIMEOUT_SECONDS;
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
        this.mapService.placeDriverMarker(lat, lng);
        this.cdr.detectChanges();
        if (this.signalRService.state === signalR.HubConnectionState.Connected)
          this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => { });
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: GEO_MAX_AGE_MS },
    );
  }

  public toggleSimulation(): void {
    if (!this.currentRideCoords.length || this.simulationRunning) return;
    this.startSimulation();
  }

  private startSimulation(): void {
    const isPickupPhase = !this.pinConfirmed;

    const onComplete = () => {
      this.simulationRunning = false;
      if (isPickupPhase) {
        this.signalRService.invoke('DriverArrivedAtPickup', this.activeRideId).catch(() => { });
      } else {
        this.arrivedAtDrop = true;
        const rate = this.authService.getRatePerKm();
        const totalKm = this.pickupToDropDistanceKm;
        this.ridePaymentData = {
          passengerName: this.confirmedRide?.passengerName ?? '',
          totalKm,
          ratePerKm: rate,
          totalCost: Math.round(totalKm * rate),
        };
      }
      this.cdr.detectChanges();
    };

    this.simulationRunning = true;
    this.simulationService.start(this.currentRideCoords, SIMULATION_DURATION_MS, onComplete);
    this.cdr.detectChanges();
  }

  public endRide(): void {
    if (!this.activeRideId) return;
    this.signalRService
      .invoke('RideCompleted', this.activeRideId, this.pickupToDropDistanceKm)
      .catch(console.error);
    this.resetRideState();
  }

  public toggleOnline(): void {
    if (this.isOnline && this.confirmedRide) {
      this.locationError = 'Cannot go offline during an active ride.';
      setTimeout(() => {
        this.locationError = null;
        this.cdr.detectChanges();
      }, NOTIFICATION_DISMISS_MS);
      return;
    }
    this.isOnline ? this.goOffline() : this.goOnline();
  }

  public goOnline(): void {
    this.isConnecting = true;
    this.locationError = null;
    this.cdr.detectChanges();

    const name = this.authService.getUserName() ?? 'Driver';
    const vehicle = this.authService.getVehicleModel() ?? '';
    const seats = this.authService.getAvailableSeats();
    const rate = this.authService.getRatePerKm();

    const sendOnline = (lat: number, lng: number): void => {
      const invoke = () =>
        this.signalRService
          .invoke('DriverGoOnline', lat, lng, name, vehicle, seats, rate)
          .catch(console.error);

      if (this.signalRService.state === signalR.HubConnectionState.Connected) invoke();
      else this.signalRService.connect().then(invoke);
    };

    if (this.manualLocationSet && this.currentLocation) {
      this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
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
        this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
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
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS },
    );
  }

  public goOffline(): void {
    if (this.signalRService.state === signalR.HubConnectionState.Connected)
      this.signalRService.invoke('DriverGoOffline').catch(console.error);

    this.isOnline = false;
    this.currentLocation = null;
    this.manualLocationSet = false;
    this.locationQuery = '';
    this.stopTimer();
    this.resetRideState();
    this.mapService.removeDriverMarker();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.cdr.detectChanges();
  }

  public acceptRequest(): void {
    this.signalRService.invoke('AcceptRideRequest').catch(console.error);
    this.stopTimer();
    this.incomingRequest = null;
    this.cdr.detectChanges();
  }

  public rejectRequest(): void {
    this.signalRService.invoke('RejectRideRequest').catch(console.error);
    this.stopTimer();
    this.incomingRequest = null;
    this.cdr.detectChanges();
  }

  public cancelRide(): void {
    if (!this.activeRideId) return;
    this.signalRService.invoke('CancelRide', this.activeRideId, 'Driver').catch(console.error);
  }

  public submitPin(): void {
    if (!this.activeRideId || this.enteredPin.length !== PIN_LENGTH) return;
    this.pinError = null;
    this.signalRService
      .invoke('ConfirmPin', this.activeRideId, this.enteredPin)
      .catch(console.error);
    this.enteredPin = '';
  }

  public onLocationInput(): void {
    clearTimeout(this.locationDebounce);
    if (this.locationQuery.length < MIN_SEARCH_QUERY_LENGTH) {
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
    }, LOCATION_DEBOUNCE_MS);
  }

  public selectManualLocation(s: LocationSuggestion): void {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    this.currentLocation = { lat, lng };
    this.locationQuery = s.display_name.split(',')[0];
    this.locationSuggestions = [];
    this.manualLocationSet = true;
    this.mapService.placeDriverMarker(lat, lng);
    this.mapService.setView(lat, lng, MANUAL_LOCATION_ZOOM);
    this.cdr.detectChanges();
  }

  public getTimerColor(): string {
    if (this.timeLeft > 10) return '#22c55e';
    if (this.timeLeft > 5) return '#f59e0b';
    return '#ef4444';
  }

  public logout(): void {
    if (this.confirmedRide) return;
    if (this.isOnline) this.goOffline();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}