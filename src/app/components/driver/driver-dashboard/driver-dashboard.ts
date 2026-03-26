import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../../services/auth.service';
import { DriverSignalRService } from '../../../services/driver-signalr.service';
import { DriverMapService } from '../../../services/driver-map.service';
import { DriverSimulationService } from '../../../services/driver-simulation.service';
import { API, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DEFAULT_CITY } from '../../../constants/api.constants';
import { LocationSuggestion } from '../../../models/location.model';
import { appendCityIfNeeded } from '../../../utils/map.utils';

interface PassengerRide {
  rideId: string;
  passengerName: string;
  passengerConnectionId: string;
  pickupLat: number;
  pickupLng: number;
  pickupName: string;
  dropLat: number;
  dropLng: number;
  dropName: string;
  arrivedAtPickup: boolean;
  pinConfirmed: boolean;
  arrivedAtDrop: boolean;
  paymentData: { totalKm: number; ratePerKm: number; totalCost: number } | null;
  enteredPin: string;
  pinError: string | null;
  cancelError: string | null;
  pickupToDropDistanceKm: number;
  routeEta: string;
  routeDurationMin: number;
}

type CarpoolPhase = 'pickups' | 'drops';
const DRIVER_SESSION_KEY = 'driver_ride_state';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './driver-dashboard.html',
  styleUrl: './driver-dashboard.scss',
})
export class DriverDashboard implements AfterViewInit, OnDestroy {
  public isOnline = false;
  public isConnecting = false;
  public locationError: string | null = null;
  public driverName = '';
  public currentLocation: { lat: number; lng: number } | null = null;
  public locationQuery = '';
  public locationSuggestions: LocationSuggestion[] = [];
  private manualLocationSet = false;
  private watchId: number | null = null;
  private locationDebounce: any;
  public incomingRequest: any = null;
  public timeLeft = 20;
  private timerInterval: any = null;
  public confirmedRides: PassengerRide[] = [];
  public activeSimulationRideId: string | null = null;
  public carpoolPhase: CarpoolPhase = 'pickups';
  public simulationRunning = false;
  private currentRideCoords: [number, number][] = [];
  public showHistory = false;
  public historyLoading = false;
  public rideHistory: any[] = [];
  private subscriptionsList: Subscription[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly signalRService: DriverSignalRService,
    private readonly mapService: DriverMapService,
    private readonly simulationService: DriverSimulationService,
  ) {}

  private saveSession(): void {
    try {
      sessionStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify({
        isOnline: this.isOnline,
        currentLocation: this.currentLocation,
        locationQuery: this.locationQuery,
        manualLocationSet: this.manualLocationSet,
        confirmedRides: this.confirmedRides,
        activeSimulationRideId: this.activeSimulationRideId,
        carpoolPhase: this.carpoolPhase,
        simulationRunning: this.simulationRunning
      }));
    } catch {}
  }

  private restoreSession(): void {
    try {
      const rawSessionData = sessionStorage.getItem(DRIVER_SESSION_KEY);
      if (!rawSessionData) return;
      const parsedSessionData = JSON.parse(rawSessionData);
      this.isOnline = parsedSessionData.isOnline ?? false;
      this.currentLocation = parsedSessionData.currentLocation ?? null;
      this.locationQuery = parsedSessionData.locationQuery ?? '';
      this.manualLocationSet = parsedSessionData.manualLocationSet ?? false;
      this.confirmedRides = parsedSessionData.confirmedRides ?? [];
      this.activeSimulationRideId = parsedSessionData.activeSimulationRideId ?? null;
      this.carpoolPhase = parsedSessionData.carpoolPhase ?? 'pickups';
      this.simulationRunning = parsedSessionData.simulationRunning ?? false;
    } catch {
      sessionStorage.removeItem(DRIVER_SESSION_KEY);
    }
  }

  private clearSession(): void {
    sessionStorage.removeItem(DRIVER_SESSION_KEY);
  }

  public ngAfterViewInit(): void {
    this.driverName = this.authService.getUserName() ?? 'Driver';
    this.cdr.detectChanges();
    this.mapService.initMap('driver-map', DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    this.restoreSession();
    if (this.currentLocation) {
      this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
      this.mapService.setView(this.currentLocation.lat, this.currentLocation.lng, 15);
    }
    if (this.activeRide && this.currentLocation) {
      if (this.carpoolPhase === 'drops') {
        this.loadDropRoute(this.activeRide);
      } else {
        this.loadPickupRoute(this.activeRide);
      }
    }
    this.subscribeToMapEvents();
    this.connectSignalR();
  }

  public ngOnDestroy(): void {
    this.subscriptionsList.forEach((subscription) => subscription.unsubscribe());
    this.signalRService.disconnect();
    this.simulationService.stop();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
  }

  public get hasConfirmedRides(): boolean {
    return this.confirmedRides.length > 0;
  }

  public get activeRide(): PassengerRide | null {
    if (!this.activeSimulationRideId) return null;
    return this.confirmedRides.find((rideItem) => rideItem.rideId === this.activeSimulationRideId) ?? null;
  }

  public get pooledRides(): PassengerRide[] {
    return this.confirmedRides.filter((rideItem) => rideItem.rideId !== this.activeSimulationRideId);
  }

  private get pendingPickupRides(): PassengerRide[] {
    return this.confirmedRides.filter((rideItem) => !rideItem.pinConfirmed);
  }

  public getRideById(rideId: string): PassengerRide | undefined {
    return this.confirmedRides.find((rideItem) => rideItem.rideId === rideId);
  }

  private updateRide(rideId: string, updatedProperties: Partial<PassengerRide>): void {
    const targetRide = this.confirmedRides.find((rideItem) => rideItem.rideId === rideId);
    if (targetRide) {
      Object.assign(targetRide, updatedProperties);
      this.saveSession();
    }
  }

  private subscribeToMapEvents(): void {
    this.subscriptionsList.push(
      this.mapService.mapClick$.subscribe(({ lat, lng }) => {
        if (!this.isOnline) {
          this.currentLocation = { lat, lng };
          this.manualLocationSet = true;
          this.mapService.placeDriverMarker(lat, lng);
          fetch(API.nominatim.reverse(lat, lng))
            .then((httpResponse) => httpResponse.json())
            .then((geocodeData) => {
              this.locationQuery = geocodeData.display_name?.split(',')[0] || '';
              this.saveSession();
              this.cdr.detectChanges();
            });
          this.cdr.detectChanges();
        }
      }),
    );
  }

  private connectSignalR(): void {
    this.signalRService.connect().catch((connectionError) => console.error('SignalR error:', connectionError));
    this.subscriptionsList.push(
      this.signalRService.incomingRequest$.subscribe((requestData) => {
        this.incomingRequest = requestData;
        this.startRequestTimer();
        this.cdr.detectChanges();
      }),
      this.signalRService.requestExpired$.subscribe(() => {
        this.incomingRequest = null;
        this.stopTimer();
        this.cdr.detectChanges();
      }),
      this.signalRService.rideConfirmed$.subscribe(async (rideConfirmationData) => {
        this.incomingRequest = null;
        this.stopTimer();
        const newPassengerRide: PassengerRide = {
          rideId: rideConfirmationData.rideId,
          passengerName: rideConfirmationData.passengerName,
          passengerConnectionId: rideConfirmationData.passengerConnectionId,
          pickupLat: rideConfirmationData.pickupLat,
          pickupLng: rideConfirmationData.pickupLng,
          pickupName: rideConfirmationData.pickupName,
          dropLat: rideConfirmationData.dropLat,
          dropLng: rideConfirmationData.dropLng,
          dropName: rideConfirmationData.dropName,
          arrivedAtPickup: false,
          pinConfirmed: false,
          arrivedAtDrop: false,
          paymentData: null,
          enteredPin: '',
          pinError: null,
          cancelError: null,
          pickupToDropDistanceKm: 0,
          routeEta: '',
          routeDurationMin: 0,
        };
        this.confirmedRides.push(newPassengerRide);
        this.calculatePickupDropDistance(rideConfirmationData.rideId, rideConfirmationData.pickupLng, rideConfirmationData.pickupLat, rideConfirmationData.dropLng, rideConfirmationData.dropLat);
        if (!this.activeSimulationRideId) {
          this.carpoolPhase = 'pickups';
          this.activeSimulationRideId = rideConfirmationData.rideId;
          await this.loadPickupRoute(newPassengerRide);
        } else if (this.carpoolPhase === 'drops') {
          this.simulationService.stop();
          this.simulationRunning = false;
          this.mapService.clearRoute();
          this.carpoolPhase = 'pickups';
          this.activeSimulationRideId = rideConfirmationData.rideId;
          await this.loadPickupRoute(newPassengerRide);
        }
        this.saveSession();
        this.cdr.detectChanges();
      }),
      this.signalRService.driverArrived$.subscribe(() => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, { arrivedAtPickup: true });
        this.simulationService.stop();
        this.simulationRunning = false;
        this.saveSession();
        this.cdr.detectChanges();
      }),
      this.signalRService.pinConfirmed$.subscribe(() => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, {
          pinConfirmed: true,
          arrivedAtPickup: false,
          enteredPin: '',
          pinError: null,
          cancelError: null,
        });
        this.saveSession();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.advanceToNextStop();
          this.cdr.detectChanges();
        }, 300);
      }),
      this.signalRService.pinError$.subscribe((pinErrorData) => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, { pinError: pinErrorData.message });
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCancelled$.subscribe((cancellationData) => {
        const cancelledRideId: string | undefined = cancellationData.rideId;
        const wasActiveSimulation = cancelledRideId === this.activeSimulationRideId;
        this.confirmedRides = this.confirmedRides.filter((rideItem) => rideItem.rideId !== cancelledRideId);
        if (wasActiveSimulation) {
          this.simulationService.stop();
          this.simulationRunning = false;
          this.mapService.clearRoute();
          this.activeSimulationRideId = null;
          this.advanceToNextStop();
        }
        this.saveSession();
        this.showToast(cancellationData.message);
        this.cdr.detectChanges();
      }),
      this.signalRService.cancelError$.subscribe((errorData) => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, { cancelError: errorData.message });
        this.cdr.detectChanges();
      }),
      this.signalRService.cannotGoOffline$.subscribe((warningData) => {
        this.showToast(warningData.message);
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCompleted$.subscribe((completionData) => {
        if (!this.activeSimulationRideId) return;
        const completedRideId = this.activeSimulationRideId;
        this.activeSimulationRideId = null;
        this.simulationRunning = false;
        this.confirmedRides = this.confirmedRides.filter((rideItem) => rideItem.rideId !== completedRideId);
        this.mapService.clearRoute();
        this.saveSession();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.advanceToNextStop();
          this.cdr.detectChanges();
        }, 300);
      }),
      this.simulationService.step$.subscribe(({ lat, lng }) => {
        this.currentLocation = { lat, lng };
        this.mapService.placeDriverMarker(lat, lng);
        this.mapService.trimRoute(lat, lng);
        this.mapService.panToDriver(lat, lng);
        this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => {});
        this.saveSession();
        this.cdr.detectChanges();
      }),
    );
  }

  private advanceToNextStop(): void {
    if (this.confirmedRides.length === 0) {
      this.carpoolPhase = 'pickups';
      this.activeSimulationRideId = null;
      if (this.currentLocation)
        this.mapService.setView(this.currentLocation.lat, this.currentLocation.lng, 15);
      this.saveSession();
      return;
    }
    const nextPickupRide = this.getNearestPendingPickup();
    if (nextPickupRide) {
      this.carpoolPhase = 'pickups';
      this.activeSimulationRideId = nextPickupRide.rideId;
      this.loadPickupRoute(nextPickupRide);
    } else {
      this.carpoolPhase = 'drops';
      const remainingDropRides = this.confirmedRides.filter((rideItem) => rideItem.pinConfirmed && !rideItem.arrivedAtDrop);
      const nextDropRide = remainingDropRides.sort((rideA, rideB) => {
        if (!this.currentLocation) return 0;
        const distanceToA = this.calculateDistanceInKm(this.currentLocation.lat, this.currentLocation.lng, rideA.dropLat, rideA.dropLng);
        const distanceToB = this.calculateDistanceInKm(this.currentLocation.lat, this.currentLocation.lng, rideB.dropLat, rideB.dropLng);
        return distanceToA - distanceToB;
      })[0];
      if (nextDropRide) {
        this.activeSimulationRideId = nextDropRide.rideId;
        this.loadDropRoute(nextDropRide);
      }
    }
    this.saveSession();
  }

  private getNearestPendingPickup(): PassengerRide | null {
    const pendingPickupsList = this.pendingPickupRides;
    if (!pendingPickupsList.length) return null;
    if (!this.currentLocation) return pendingPickupsList[0];
    return pendingPickupsList.reduce((nearestRide, currentRide) => {
      const distanceToNearest = this.calculateDistanceInKm(this.currentLocation!.lat, this.currentLocation!.lng, nearestRide.pickupLat, nearestRide.pickupLng);
      const distanceToCurrent = this.calculateDistanceInKm(this.currentLocation!.lat, this.currentLocation!.lng, currentRide.pickupLat, currentRide.pickupLng);
      return distanceToCurrent < distanceToNearest ? currentRide : nearestRide;
    });
  }

  private async loadPickupRoute(targetRide: PassengerRide): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const routeResult = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng, this.currentLocation.lat,
        targetRide.pickupLng, targetRide.pickupLat,
        '#4285F4',
        `Pickup: ${targetRide.pickupName}`,
        targetRide.pickupLat, targetRide.pickupLng,
      );
      this.currentRideCoords = routeResult.coords;
      this.updateRide(targetRide.rideId, {
        routeEta: `${routeResult.eta} · ${routeResult.distanceKm} km`,
        routeDurationMin: routeResult.durationMin,
      });
      this.cdr.detectChanges();
    } catch (routeError) {
      console.error('Pickup route error:', routeError);
    }
  }

  private async loadDropRoute(targetRide: PassengerRide): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const routeResult = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng, this.currentLocation.lat,
        targetRide.dropLng, targetRide.dropLat,
        '#7c3aed',
      );
      this.currentRideCoords = routeResult.coords;
      this.updateRide(targetRide.rideId, {
        routeEta: `${routeResult.eta} · ${routeResult.distanceKm} km`,
        routeDurationMin: routeResult.durationMin,
      });
      this.cdr.detectChanges();
    } catch (routeError) {
      console.error('Drop route error:', routeError);
    }
  }

  private async calculatePickupDropDistance(targetRideId: string, pickupLongitude: number, pickupLatitude: number, dropLongitude: number, dropLatitude: number): Promise<void> {
    try {
      const routeResponse = await fetch(API.osrm.route(pickupLongitude, pickupLatitude, dropLongitude, dropLatitude));
      const routeData = await routeResponse.json();
      if (routeData.routes?.length) {
        this.updateRide(targetRideId, {
          pickupToDropDistanceKm: Math.round((routeData.routes[0].distance / 1000) * 100) / 100,
        });
        this.cdr.detectChanges();
      }
    } catch (calculationError) {
      console.error('Distance calc error:', calculationError);
    }
  }

  public toggleSimulation(): void {
    if (!this.currentRideCoords.length || this.simulationRunning) return;
    this.startSimulation();
  }

  private startSimulation(): void {
    const currentActiveRide = this.activeRide;
    if (!currentActiveRide) return;
    const isHandlingPickupPhase = this.carpoolPhase === 'pickups';
    const handleSimulationCompletion = () => {
      this.simulationRunning = false;
      if (isHandlingPickupPhase) {
        this.signalRService.invoke('DriverArrivedAtPickup', currentActiveRide.rideId).catch(() => {});
      } else {
        this.updateRide(currentActiveRide.rideId, {
          arrivedAtDrop: true,
          paymentData: {
            totalKm: currentActiveRide.pickupToDropDistanceKm,
            ratePerKm: this.authService.getRatePerKm(),
            totalCost: Math.round(currentActiveRide.pickupToDropDistanceKm * this.authService.getRatePerKm()),
          },
        });
      }
      this.saveSession();
      this.cdr.detectChanges();
    };
    this.simulationRunning = true;
    this.saveSession();
    this.simulationService.start(this.currentRideCoords, 30000, handleSimulationCompletion);
    this.cdr.detectChanges();
  }

  public endRide(): void {
    const currentActiveRide = this.activeRide;
    if (!currentActiveRide) return;
    this.signalRService.invoke('RideCompleted', currentActiveRide.rideId, currentActiveRide.pickupToDropDistanceKm).catch(console.error);
  }

  public submitPin(targetRideId: string, inputPin: string): void {
    if (!targetRideId || inputPin.length !== 4) return;
    this.updateRide(targetRideId, { pinError: null });
    this.signalRService.invoke('ConfirmPin', targetRideId, inputPin).catch(console.error);
  }

  public cancelRide(targetRideId: string): void {
    this.signalRService.invoke('CancelRide', targetRideId, 'Driver').catch(console.error);
  }

  public toggleOnline(): void {
    if (this.isOnline && this.confirmedRides.length > 0) {
      this.showToast('Cannot go offline during active rides.');
      return;
    }
    this.isOnline ? this.goOffline() : this.goOnline();
  }

  public goOnline(): void {
    this.isConnecting = true;
    this.locationError = null;
    this.cdr.detectChanges();
    const authenticatedDriverName = this.authService.getUserName() ?? 'Driver';
    const registeredVehicleModel = this.authService.getVehicleModel() ?? '';
    const driverAvailableSeats = this.authService.getAvailableSeats();
    const driverRatePerKm = this.authService.getRatePerKm();
    const registeredPhoneNumber = this.authService.getPhone() ?? '';
    const registeredVehicleNumber = this.authService.getVehicleNo() ?? '';

    const executeOnlineInvocation = (latitude: number, longitude: number): void => {
      const invokeSignalR = () =>
        this.signalRService.invoke('DriverGoOnline', latitude, longitude, authenticatedDriverName, registeredVehicleModel, driverAvailableSeats, driverRatePerKm, registeredPhoneNumber, registeredVehicleNumber).catch(console.error);
      if (this.signalRService.state === signalR.HubConnectionState.Connected) invokeSignalR();
      else this.signalRService.connect().then(invokeSignalR);
    };

    if (this.manualLocationSet && this.currentLocation) {
      this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
      this.isOnline = true;
      this.isConnecting = false;
      this.saveSession();
      this.cdr.detectChanges();
      executeOnlineInvocation(this.currentLocation.lat, this.currentLocation.lng);
      return;
    }

    if (!navigator.geolocation) {
      this.locationError = 'Geolocation not supported.';
      this.isConnecting = false;
      this.cdr.detectChanges();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (currentPosition) => {
        this.currentLocation = { lat: currentPosition.coords.latitude, lng: currentPosition.coords.longitude };
        this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
        this.isOnline = true;
        this.isConnecting = false;
        this.saveSession();
        this.cdr.detectChanges();
        this.startWatching();
        executeOnlineInvocation(this.currentLocation.lat, this.currentLocation.lng);
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
    if (this.signalRService.state === signalR.HubConnectionState.Connected)
      this.signalRService.invoke('DriverGoOffline').catch(console.error);
    this.isOnline = false;
    this.currentLocation = null;
    this.manualLocationSet = false;
    this.locationQuery = '';
    this.stopTimer();
    this.confirmedRides = [];
    this.activeSimulationRideId = null;
    this.carpoolPhase = 'pickups';
    this.simulationService.stop();
    this.mapService.clearRoute();
    this.mapService.removeDriverMarker();
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.clearSession();
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
      (currentPosition) => {
        const { latitude: lat, longitude: lng } = currentPosition.coords;
        this.currentLocation = { lat, lng };
        if (!this.simulationRunning) {
          this.mapService.placeDriverMarker(lat, lng);
        }
        this.saveSession();
        this.cdr.detectChanges();
        if (this.signalRService.state === signalR.HubConnectionState.Connected)
          this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => {});
      },
      (trackingError) => console.error(trackingError),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  public onLocationInput(): void {
    clearTimeout(this.locationDebounce);
    if (this.locationQuery.length < 2) { this.locationSuggestions = []; return; }
    this.locationDebounce = setTimeout(() => {
      fetch(API.nominatim.search(appendCityIfNeeded(this.locationQuery, DEFAULT_CITY)))
        .then((searchResponse) => searchResponse.json())
        .then((searchResults) => { this.locationSuggestions = searchResults; this.cdr.detectChanges(); });
    }, 400);
  }

  public selectManualLocation(locationSuggestion: LocationSuggestion): void {
    const parsedLatitude = parseFloat(locationSuggestion.lat);
    const parsedLongitude = parseFloat(locationSuggestion.lon);
    this.currentLocation = { lat: parsedLatitude, lng: parsedLongitude };
    this.locationQuery = locationSuggestion.display_name.split(',')[0];
    this.locationSuggestions = [];
    this.manualLocationSet = true;
    this.mapService.placeDriverMarker(parsedLatitude, parsedLongitude);
    this.mapService.setView(parsedLatitude, parsedLongitude, 15);
    this.saveSession();
    this.cdr.detectChanges();
  }

  public getTimerColor(): string {
    if (this.timeLeft > 10) return '#22c55e';
    if (this.timeLeft > 5) return '#f59e0b';
    return '#ef4444';
  }

  public openHistory(): void {
    this.showHistory = true;
    this.historyLoading = true;
    this.rideHistory = [];
    this.cdr.detectChanges();
    const authenticationToken = localStorage.getItem('token');
    this.http.get<any[]>(API.rides.driver, { headers: { Authorization: `Bearer ${authenticationToken}` } })
      .subscribe({
        next: (historyData) => { this.rideHistory = historyData; this.historyLoading = false; this.cdr.detectChanges(); },
        error: () => { this.historyLoading = false; this.cdr.detectChanges(); },
      });
  }

  public closeHistory(): void { this.showHistory = false; this.cdr.detectChanges(); }

  public logout(): void {
    if (this.confirmedRides.length > 0) return;
    if (this.isOnline) this.goOffline();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private showToast(toastMessage: string): void {
    this.locationError = toastMessage;
    setTimeout(() => { this.locationError = null; this.cdr.detectChanges(); }, 3000);
  }

  private calculateDistanceInKm(latitude1: number, longitude1: number, latitude2: number, longitude2: number): number {
    const deltaLat = latitude2 - latitude1;
    const deltaLng = (longitude2 - longitude1) * Math.cos(latitude1 * Math.PI / 180);
    return Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111;
  }
}