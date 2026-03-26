// import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
// import { CommonModule, DatePipe } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { HttpClient } from '@angular/common/http';
// import { Subscription } from 'rxjs';
// import * as signalR from '@microsoft/signalr';
// import { AuthService } from '../../../services/auth.service';
// import { DriverSignalRService } from '../../../services/driver-signalr.service';
// import { DriverMapService } from '../../../services/driver-map.service';
// import { DriverSimulationService } from '../../../services/driver-simulation.service';
// import {
//   API,
//   DEFAULT_MAP_CENTER,
//   DEFAULT_MAP_ZOOM,
//   DEFAULT_CITY,
// } from '../../../constants/api.constants';
// import { LocationSuggestion } from '../../../models/location.model';
// import { appendCityIfNeeded } from '../../../utils/map.utils';
// interface PassengerRide {
//   rideId: string;
//   passengerName: string;
//   passengerConnectionId: string;
//   pickupLat: number;
//   pickupLng: number;
//   pickupName: string;
//   dropLat: number;
//   dropLng: number;
//   dropName: string;
//   arrivedAtPickup: boolean;
//   pinConfirmed: boolean;
//   arrivedAtDrop: boolean;
//   paymentData: { totalKm: number; ratePerKm: number; totalCost: number } | null;
//   enteredPin: string;
//   pinError: string | null;
//   cancelError: string | null;
//   pickupToDropDistanceKm: number;
//   routeEta: string;          
//   routeDurationMin: number;  
// }

// /**
//  * 'pickups' = driver is still collecting passengers (going to pickups)
//  * 'drops'   = all passengers boarded, heading to destination to drop them
//  */
// type CarpoolPhase = 'pickups' | 'drops';

// @Component({
//   selector: 'app-driver-dashboard',
//   standalone: true,
//   imports: [CommonModule, FormsModule, DatePipe],
//   templateUrl: './driver-dashboard.html',
//   styleUrl: './driver-dashboard.scss',
// })
// export class DriverDashboard implements AfterViewInit, OnDestroy {

//   public isOnline = false;
//   public isConnecting = false;
//   public locationError: string | null = null;
//   public driverName = '';

//   public currentLocation: { lat: number; lng: number } | null = null;
//   public locationQuery = '';
//   public locationSuggestions: LocationSuggestion[] = [];
//   private manualLocationSet = false;
//   private watchId: number | null = null;
//   private locationDebounce: any;

//   public incomingRequest: any = null;
//   public timeLeft = 20;
//   private timerInterval: any = null;

//   public confirmedRides: PassengerRide[] = [];
//   public activeSimulationRideId: string | null = null;
//   public carpoolPhase: CarpoolPhase = 'pickups';

//   public simulationRunning = false;
//   private currentRideCoords: [number, number][] = [];

//   public showHistory = false;
//   public historyLoading = false;
//   public rideHistory: any[] = [];

//   private subs: Subscription[] = [];

//   constructor(
//     private readonly authService: AuthService,
//     private readonly router: Router,
//     private readonly http: HttpClient,
//     private readonly cdr: ChangeDetectorRef,
//     private readonly signalRService: DriverSignalRService,
//     private readonly mapService: DriverMapService,
//     private readonly simulationService: DriverSimulationService,
//   ) {}

 

//   public ngAfterViewInit(): void {
//     this.driverName = this.authService.getUserName() ?? 'Driver';
//     this.cdr.detectChanges();
//     this.mapService.initMap('driver-map', DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
//     this.subscribeToMapEvents();
//     this.connectSignalR();
   
//   }

//   public ngOnDestroy(): void {
//     this.subs.forEach((s) => s.unsubscribe());
//     this.signalRService.disconnect();
//     this.simulationService.stop();
//     if (this.timerInterval) clearInterval(this.timerInterval);
//     if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
//   }

 

//   public get hasConfirmedRides(): boolean {
//     return this.confirmedRides.length > 0;
//   }

//   public get activeRide(): PassengerRide | null {
//     if (!this.activeSimulationRideId) return null;
//     return this.confirmedRides.find((r) => r.rideId === this.activeSimulationRideId) ?? null;
//   }

//   public get pooledRides(): PassengerRide[] {
//     return this.confirmedRides.filter((r) => r.rideId !== this.activeSimulationRideId);
//   }

//   private get pendingPickupRides(): PassengerRide[] {
//     return this.confirmedRides.filter((r) => !r.pinConfirmed);
//   }

//   public getRideById(rideId: string): PassengerRide | undefined {
//     return this.confirmedRides.find((r) => r.rideId === rideId);
//   }

//   private updateRide(rideId: string, update: Partial<PassengerRide>): void {
//     const ride = this.confirmedRides.find((r) => r.rideId === rideId);
//     if (ride) Object.assign(ride, update);
//   }

 

//   private subscribeToMapEvents(): void {
//     this.subs.push(
//       this.mapService.mapClick$.subscribe(({ lat, lng }) => {
//         if (!this.isOnline) {
//           this.currentLocation = { lat, lng };
//           this.manualLocationSet = true;
//           this.mapService.placeDriverMarker(lat, lng);
//           fetch(API.nominatim.reverse(lat, lng))
//             .then((r) => r.json())
//             .then((data) => {
//               this.locationQuery = data.display_name?.split(',')[0] || '';
//               this.cdr.detectChanges();
//             });
//           this.cdr.detectChanges();
//         }
//       }),
//     );
//   }

 

//   private connectSignalR(): void {
//     this.signalRService.connect().catch((err) => console.error('SignalR error:', err));

//     this.subs.push(

//       this.signalRService.incomingRequest$.subscribe((data) => {
//         this.incomingRequest = data;
//         this.startRequestTimer();
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.requestExpired$.subscribe(() => {
//         this.incomingRequest = null;
//         this.stopTimer();
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.rideConfirmed$.subscribe(async (data) => {
//         this.incomingRequest = null;
//         this.stopTimer();

//         const newRide: PassengerRide = {
//           rideId: data.rideId,
//           passengerName: data.passengerName,
//           passengerConnectionId: data.passengerConnectionId,
//           pickupLat: data.pickupLat,
//           pickupLng: data.pickupLng,
//           pickupName: data.pickupName,
//           dropLat: data.dropLat,
//           dropLng: data.dropLng,
//           dropName: data.dropName,
//           arrivedAtPickup: false,
//           pinConfirmed: false,
//           arrivedAtDrop: false,
//           paymentData: null,
//           enteredPin: '',
//           pinError: null,
//           cancelError: null,
//           pickupToDropDistanceKm: 0,
//           routeEta: '',
//           routeDurationMin: 0,
//         };

//         this.confirmedRides.push(newRide);

//         this.calcPickupDropDistance(
//           data.rideId, data.pickupLng, data.pickupLat, data.dropLng, data.dropLat,
//         );

       
//         //
       
//         //
       
       
       
//         //
       
       

//         if (!this.activeSimulationRideId) {
         
//           this.carpoolPhase = 'pickups';
//           this.activeSimulationRideId = data.rideId;
//           await this.loadPickupRoute(newRide);
//         } else if (this.carpoolPhase === 'drops') {
         
//           this.simulationService.stop();
//           this.simulationRunning = false;
//           this.mapService.clearRoute();
//           this.carpoolPhase = 'pickups';
//           this.activeSimulationRideId = data.rideId;
//           await this.loadPickupRoute(newRide);
//         }
       

//         this.cdr.detectChanges();
//       }),

//       this.signalRService.driverArrived$.subscribe(() => {
//         if (!this.activeSimulationRideId) return;
//         this.updateRide(this.activeSimulationRideId, { arrivedAtPickup: true });
//         this.simulationService.stop();
//         this.simulationRunning = false;
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.pinConfirmed$.subscribe(() => {
//         if (!this.activeSimulationRideId) return;
//         this.updateRide(this.activeSimulationRideId, {
//           pinConfirmed: true,
//           arrivedAtPickup: false,
//           enteredPin: '',
//           pinError: null,
//           cancelError: null,
//         });
//         this.cdr.detectChanges();
//         setTimeout(() => {
//           this.advanceToNextStop();
//           this.cdr.detectChanges();
//         }, 300);
//       }),

//       this.signalRService.pinError$.subscribe((data) => {
//         if (!this.activeSimulationRideId) return;
//         this.updateRide(this.activeSimulationRideId, { pinError: data.message });
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.rideCancelled$.subscribe((data) => {
//         const cancelledRideId: string | undefined = data.rideId;
//         const wasActive = cancelledRideId === this.activeSimulationRideId;

//         this.confirmedRides = this.confirmedRides.filter((r) => r.rideId !== cancelledRideId);

//         if (wasActive) {
//           this.simulationService.stop();
//           this.simulationRunning = false;
//           this.mapService.clearRoute();
//           this.activeSimulationRideId = null;
//           this.advanceToNextStop();
//         }

//         this.showToast(data.message);
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.cancelError$.subscribe((data) => {
//         if (!this.activeSimulationRideId) return;
//         this.updateRide(this.activeSimulationRideId, { cancelError: data.message });
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.cannotGoOffline$.subscribe((data) => {
//         this.showToast(data.message);
//         this.cdr.detectChanges();
//       }),

//       this.signalRService.rideCompleted$.subscribe((data) => {
//         if (!this.activeSimulationRideId) return;

//         const completedId = this.activeSimulationRideId;
//         this.activeSimulationRideId = null;
//         this.simulationRunning = false;
//         this.confirmedRides = this.confirmedRides.filter((r) => r.rideId !== completedId);
//         this.mapService.clearRoute();
//         this.cdr.detectChanges();

//         setTimeout(() => {
//           this.advanceToNextStop();
//           this.cdr.detectChanges();
//         }, 300);
//       }),

//       this.simulationService.step$.subscribe(({ lat, lng }) => {
//         this.currentLocation = { lat, lng };
//         this.mapService.placeDriverMarker(lat, lng);
//         this.mapService.trimRoute(lat, lng);
//         this.mapService.panToDriver(lat, lng);
//         this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => {});
//         this.cdr.detectChanges();
//       }),
//     );
//   }

 

//   /**
//    * Called after every PIN confirm / ride complete / ride cancel.
//    *
//    * Decision tree:
//    *   Any unboarded passengers? → go to nearest pickup  (carpoolPhase = 'pickups')
//    *   All boarded?              → go to destination drop (carpoolPhase = 'drops')
//    *   No one left?              → reset
//    */
//   private advanceToNextStop(): void {
//     if (this.confirmedRides.length === 0) {
//       this.carpoolPhase = 'pickups';
//       this.activeSimulationRideId = null;
//       if (this.currentLocation)
//         this.mapService.setView(this.currentLocation.lat, this.currentLocation.lng, 15);
//       return;
//     }

//     const nextPickup = this.getNearestPendingPickup();

//     if (nextPickup) {
     
//       this.carpoolPhase = 'pickups';
//       this.activeSimulationRideId = nextPickup.rideId;
//       this.loadPickupRoute(nextPickup);
//     } else {
     
//       this.carpoolPhase = 'drops';
//       const dropsRemaining = this.confirmedRides.filter((r) => r.pinConfirmed && !r.arrivedAtDrop);
//       const nextDrop = dropsRemaining.sort((a, b) => {
//         if (!this.currentLocation) return 0;
//         const distA = this.distKm(this.currentLocation.lat, this.currentLocation.lng, a.dropLat, a.dropLng);
//         const distB = this.distKm(this.currentLocation.lat, this.currentLocation.lng, b.dropLat, b.dropLng);
//         return distA - distB;
//       })[0];
//       if (nextDrop) {
//         this.activeSimulationRideId = nextDrop.rideId;
//         this.loadDropRoute(nextDrop);
//       }
//     }
//   }

//   /**
//    * Returns the unboarded passenger nearest to driver's current position.
//    * Falls back to first in list if no location available.
//    */
//   private getNearestPendingPickup(): PassengerRide | null {
//     const pending = this.pendingPickupRides;
//     if (!pending.length) return null;
//     if (!this.currentLocation) return pending[0];

//     return pending.reduce((nearest, ride) => {
//       const dNearest = this.distKm(
//         this.currentLocation!.lat, this.currentLocation!.lng,
//         nearest.pickupLat, nearest.pickupLng,
//       );
//       const dRide = this.distKm(
//         this.currentLocation!.lat, this.currentLocation!.lng,
//         ride.pickupLat, ride.pickupLng,
//       );
//       return dRide < dNearest ? ride : nearest;
//     });
//   }

 

//   private async loadPickupRoute(ride: PassengerRide): Promise<void> {
//     if (!this.currentLocation) return;
//     try {
//       const result = await this.mapService.fetchAndDrawRoute(
//         this.currentLocation.lng, this.currentLocation.lat,
//         ride.pickupLng, ride.pickupLat,
//         '#4285F4',
//         `Pickup: ${ride.pickupName}`,
//         ride.pickupLat, ride.pickupLng,
//       );
//       this.currentRideCoords = result.coords;
     
//       this.updateRide(ride.rideId, {
//         routeEta: `${result.eta} · ${result.distanceKm} km`,
//         routeDurationMin: result.durationMin,
//       });
//       this.cdr.detectChanges();
//     } catch (err) {
//       console.error('Pickup route error:', err);
//     }
//   }

//   private async loadDropRoute(ride: PassengerRide): Promise<void> {
//     if (!this.currentLocation) return;
//     try {
//       const result = await this.mapService.fetchAndDrawRoute(
//         this.currentLocation.lng, this.currentLocation.lat,
//         ride.dropLng, ride.dropLat,
//         '#7c3aed',
//       );
//       this.currentRideCoords = result.coords;
//       this.updateRide(ride.rideId, {
//         routeEta: `${result.eta} · ${result.distanceKm} km`,
//         routeDurationMin: result.durationMin,
//       });
//       this.cdr.detectChanges();
//     } catch (err) {
//       console.error('Drop route error:', err);
//     }
//   }

//   private async calcPickupDropDistance(
//     rideId: string,
//     pickupLng: number, pickupLat: number,
//     dropLng: number, dropLat: number,
//   ): Promise<void> {
//     try {
//       const res = await fetch(API.osrm.route(pickupLng, pickupLat, dropLng, dropLat));
//       const data = await res.json();
//       if (data.routes?.length) {
//         this.updateRide(rideId, {
//           pickupToDropDistanceKm: Math.round((data.routes[0].distance / 1000) * 100) / 100,
//         });
//         this.cdr.detectChanges();
//       }
//     } catch (err) {
//       console.error('Distance calc error:', err);
//     }
//   }

 

//   public toggleSimulation(): void {
//     if (!this.currentRideCoords.length || this.simulationRunning) return;
//     this.startSimulation();
//   }

//   private startSimulation(): void {
//     const ride = this.activeRide;
//     if (!ride) return;

//     const isPickupPhase = this.carpoolPhase === 'pickups';

//     const onComplete = () => {
//       this.simulationRunning = false;
//       if (isPickupPhase) {
//         this.signalRService.invoke('DriverArrivedAtPickup', ride.rideId).catch(() => {});
//       } else {
//         this.updateRide(ride.rideId, {
//           arrivedAtDrop: true,
//           paymentData: {
//             totalKm: ride.pickupToDropDistanceKm,
//             ratePerKm: this.authService.getRatePerKm(),
//             totalCost: Math.round(ride.pickupToDropDistanceKm * this.authService.getRatePerKm()),
//           },
//         });
//       }
//       this.cdr.detectChanges();
//     };

//     this.simulationRunning = true;
//     this.simulationService.start(
//       this.currentRideCoords, 30000, onComplete);
//     this.cdr.detectChanges();
//   }

//   public endRide(): void {
//     const ride = this.activeRide;
//     if (!ride) return;
//     this.signalRService
//       .invoke('RideCompleted', ride.rideId, ride.pickupToDropDistanceKm)
//       .catch(console.error);
//   }

//   public submitPin(rideId: string, pin: string): void {
//     if (!rideId || pin.length !== 4) return;
//     this.updateRide(rideId, { pinError: null });
//     this.signalRService.invoke('ConfirmPin', rideId, pin).catch(console.error);
//   }

//   public cancelRide(rideId: string): void {
//     this.signalRService.invoke('CancelRide', rideId, 'Driver').catch(console.error);
//   }

 

//   public toggleOnline(): void {
//     if (this.isOnline && this.confirmedRides.length > 0) {
//       this.showToast('Cannot go offline during active rides.');
//       return;
//     }
//     this.isOnline ? this.goOffline() : this.goOnline();
//   }

//   public goOnline(): void {
//     this.isConnecting = true;
//     this.locationError = null;
//     this.cdr.detectChanges();

//     const driverName    = this.authService.getUserName() ?? 'Driver';
//     const vehicleModel  = this.authService.getVehicleModel() ?? '';
//     const availableSeats = this.authService.getAvailableSeats();
//     const ratePerKm     = this.authService.getRatePerKm();
//     const phoneNumber   = this.authService.getPhone() ?? '';
//     const vehicleNumber = this.authService.getVehicleNo() ?? '';

//     const sendOnline = (lat: number, lng: number): void => {
//       const invoke = () =>
//         this.signalRService
//           .invoke('DriverGoOnline', lat, lng, driverName, vehicleModel, availableSeats, ratePerKm, phoneNumber, vehicleNumber)
//           .catch(console.error);
//       if (this.signalRService.state === signalR.HubConnectionState.Connected) invoke();
//       else this.signalRService.connect().then(invoke);
//     };

//     if (this.manualLocationSet && this.currentLocation) {
//       this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
//       this.isOnline = true;
//       this.isConnecting = false;
//       this.cdr.detectChanges();
//       sendOnline(this.currentLocation.lat, this.currentLocation.lng);
//       return;
//     }

//     if (!navigator.geolocation) {
//       this.locationError = 'Geolocation not supported.';
//       this.isConnecting = false;
//       this.cdr.detectChanges();
//       return;
//     }

//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         this.currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
//         this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
//         this.isOnline = true;
//         this.isConnecting = false;
//         this.cdr.detectChanges();
//         this.startWatching();
//         sendOnline(this.currentLocation.lat, this.currentLocation.lng);
//       },
//       () => {
//         this.locationError = 'Location access denied.';
//         this.isConnecting = false;
//         this.cdr.detectChanges();
//       },
//       { enableHighAccuracy: true, timeout: 10000 },
//     );
//   }

//   public goOffline(): void {
//     if (this.signalRService.state === signalR.HubConnectionState.Connected)
//       this.signalRService.invoke('DriverGoOffline').catch(console.error);

//     this.isOnline = false;
//     this.currentLocation = null;
//     this.manualLocationSet = false;
//     this.locationQuery = '';
//     this.stopTimer();
//     this.confirmedRides = [];
//     this.activeSimulationRideId = null;
//     this.carpoolPhase = 'pickups';
//     this.simulationService.stop();
//     this.mapService.clearRoute();
//     this.mapService.removeDriverMarker();
//     if (this.watchId !== null) {
//       navigator.geolocation.clearWatch(this.watchId);
//       this.watchId = null;
//     }
//     this.cdr.detectChanges();
//   }
  
//   public acceptRequest(): void {
//     this.signalRService.invoke('AcceptRideRequest').catch(console.error);
//     this.stopTimer();
//     this.incomingRequest = null;
//     this.cdr.detectChanges();
//   }

//   public rejectRequest(): void {
//     this.signalRService.invoke('RejectRideRequest').catch(console.error);
//     this.stopTimer();
//     this.incomingRequest = null;
//     this.cdr.detectChanges();
//   }

//   private startRequestTimer(): void {
//     this.timeLeft = 20;
//     this.stopTimer();
//     this.timerInterval = setInterval(() => {
//       this.timeLeft--;
//       this.cdr.detectChanges();
//       if (this.timeLeft <= 0) {
//         this.stopTimer();
//         this.incomingRequest = null;
//         this.cdr.detectChanges();
//       }
//     }, 1000);
//   }

//   private stopTimer(): void {
//     if (this.timerInterval) {
//       clearInterval(this.timerInterval);
//       this.timerInterval = null;
//     }
//   }

//   private startWatching(): void {
//     this.watchId = navigator.geolocation.watchPosition(
//       (pos) => {
//         const { latitude: lat, longitude: lng } = pos.coords;
//         this.currentLocation = { lat, lng };
//         if (!this.simulationRunning) {
//           this.mapService.placeDriverMarker(lat, lng);
//         }
//         this.cdr.detectChanges();
//         if (this.signalRService.state === signalR.HubConnectionState.Connected)
//           this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => {});
//       },
//       (err) => console.error(err),
//       { enableHighAccuracy: true, maximumAge: 5000 },
//     );
//   }

//   public onLocationInput(): void {
//     clearTimeout(this.locationDebounce);
//     if (this.locationQuery.length < 2) { this.locationSuggestions = []; return; }
//     this.locationDebounce = setTimeout(() => {
//       fetch(API.nominatim.search(appendCityIfNeeded(this.locationQuery, DEFAULT_CITY)))
//         .then((r) => r.json())
//         .then((results) => { this.locationSuggestions = results; this.cdr.detectChanges(); });
//     }, 400);
//   }

//   public selectManualLocation(s: LocationSuggestion): void {
//     const lat = parseFloat(s.lat);
//     const lng = parseFloat(s.lon);
//     this.currentLocation = { lat, lng };
//     this.locationQuery = s.display_name.split(',')[0];
//     this.locationSuggestions = [];
//     this.manualLocationSet = true;
//     this.mapService.placeDriverMarker(lat, lng);
//     this.mapService.setView(lat, lng, 15);
//     this.cdr.detectChanges();
//   }

//   public getTimerColor(): string {
//     if (this.timeLeft > 10) return '#22c55e';
//     if (this.timeLeft > 5) return '#f59e0b';
//     return '#ef4444';
//   }

//   public openHistory(): void {
//     this.showHistory = true;
//     this.historyLoading = true;
//     this.rideHistory = [];
//     this.cdr.detectChanges();
//     const token = localStorage.getItem('token');
//     this.http.get<any[]>(API.rides.driver, { headers: { Authorization: `Bearer ${token}` } })
//       .subscribe({
//         next: (data) => { this.rideHistory = data; this.historyLoading = false; this.cdr.detectChanges(); },
//         error: () => { this.historyLoading = false; this.cdr.detectChanges(); },
//       });
//   }

//   public closeHistory(): void { this.showHistory = false; this.cdr.detectChanges(); }

//   public logout(): void {
//     if (this.confirmedRides.length > 0) return;
//     if (this.isOnline) this.goOffline();
//     this.authService.logout();
//     this.router.navigate(['/login']);
//   }

//   private showToast(message: string): void {
//     this.locationError = message;
//     setTimeout(() => { this.locationError = null; this.cdr.detectChanges(); }, 3000);
//   }

//   private distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
//     const dx = lat2 - lat1;
//     const dy = (lng2 - lng1) * Math.cos(lat1 * Math.PI / 180);
//     return Math.sqrt(dx * dx + dy * dy) * 111;
//   }
// }


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
  private subs: Subscription[] = [];

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
      const raw = sessionStorage.getItem(DRIVER_SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.isOnline = s.isOnline ?? false;
      this.currentLocation = s.currentLocation ?? null;
      this.locationQuery = s.locationQuery ?? '';
      this.manualLocationSet = s.manualLocationSet ?? false;
      this.confirmedRides = s.confirmedRides ?? [];
      this.activeSimulationRideId = s.activeSimulationRideId ?? null;
      this.carpoolPhase = s.carpoolPhase ?? 'pickups';
      this.simulationRunning = s.simulationRunning ?? false;
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
    this.subs.forEach((s) => s.unsubscribe());
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
    return this.confirmedRides.find((r) => r.rideId === this.activeSimulationRideId) ?? null;
  }

  public get pooledRides(): PassengerRide[] {
    return this.confirmedRides.filter((r) => r.rideId !== this.activeSimulationRideId);
  }

  private get pendingPickupRides(): PassengerRide[] {
    return this.confirmedRides.filter((r) => !r.pinConfirmed);
  }

  public getRideById(rideId: string): PassengerRide | undefined {
    return this.confirmedRides.find((r) => r.rideId === rideId);
  }

  private updateRide(rideId: string, update: Partial<PassengerRide>): void {
    const ride = this.confirmedRides.find((r) => r.rideId === rideId);
    if (ride) {
      Object.assign(ride, update);
      this.saveSession();
    }
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
            .then((data) => {
              this.locationQuery = data.display_name?.split(',')[0] || '';
              this.saveSession();
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
        this.incomingRequest = null;
        this.stopTimer();
        const newRide: PassengerRide = {
          rideId: data.rideId,
          passengerName: data.passengerName,
          passengerConnectionId: data.passengerConnectionId,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          pickupName: data.pickupName,
          dropLat: data.dropLat,
          dropLng: data.dropLng,
          dropName: data.dropName,
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
        this.confirmedRides.push(newRide);
        this.calcPickupDropDistance(data.rideId, data.pickupLng, data.pickupLat, data.dropLng, data.dropLat);
        if (!this.activeSimulationRideId) {
          this.carpoolPhase = 'pickups';
          this.activeSimulationRideId = data.rideId;
          await this.loadPickupRoute(newRide);
        } else if (this.carpoolPhase === 'drops') {
          this.simulationService.stop();
          this.simulationRunning = false;
          this.mapService.clearRoute();
          this.carpoolPhase = 'pickups';
          this.activeSimulationRideId = data.rideId;
          await this.loadPickupRoute(newRide);
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
      this.signalRService.pinError$.subscribe((data) => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, { pinError: data.message });
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCancelled$.subscribe((data) => {
        const cancelledRideId: string | undefined = data.rideId;
        const wasActive = cancelledRideId === this.activeSimulationRideId;
        this.confirmedRides = this.confirmedRides.filter((r) => r.rideId !== cancelledRideId);
        if (wasActive) {
          this.simulationService.stop();
          this.simulationRunning = false;
          this.mapService.clearRoute();
          this.activeSimulationRideId = null;
          this.advanceToNextStop();
        }
        this.saveSession();
        this.showToast(data.message);
        this.cdr.detectChanges();
      }),
      this.signalRService.cancelError$.subscribe((data) => {
        if (!this.activeSimulationRideId) return;
        this.updateRide(this.activeSimulationRideId, { cancelError: data.message });
        this.cdr.detectChanges();
      }),
      this.signalRService.cannotGoOffline$.subscribe((data) => {
        this.showToast(data.message);
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCompleted$.subscribe((data) => {
        if (!this.activeSimulationRideId) return;
        const completedId = this.activeSimulationRideId;
        this.activeSimulationRideId = null;
        this.simulationRunning = false;
        this.confirmedRides = this.confirmedRides.filter((r) => r.rideId !== completedId);
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
    const nextPickup = this.getNearestPendingPickup();
    if (nextPickup) {
      this.carpoolPhase = 'pickups';
      this.activeSimulationRideId = nextPickup.rideId;
      this.loadPickupRoute(nextPickup);
    } else {
      this.carpoolPhase = 'drops';
      const dropsRemaining = this.confirmedRides.filter((r) => r.pinConfirmed && !r.arrivedAtDrop);
      const nextDrop = dropsRemaining.sort((a, b) => {
        if (!this.currentLocation) return 0;
        const distA = this.distKm(this.currentLocation.lat, this.currentLocation.lng, a.dropLat, a.dropLng);
        const distB = this.distKm(this.currentLocation.lat, this.currentLocation.lng, b.dropLat, b.dropLng);
        return distA - distB;
      })[0];
      if (nextDrop) {
        this.activeSimulationRideId = nextDrop.rideId;
        this.loadDropRoute(nextDrop);
      }
    }
    this.saveSession();
  }

  private getNearestPendingPickup(): PassengerRide | null {
    const pending = this.pendingPickupRides;
    if (!pending.length) return null;
    if (!this.currentLocation) return pending[0];
    return pending.reduce((nearest, ride) => {
      const dNearest = this.distKm(this.currentLocation!.lat, this.currentLocation!.lng, nearest.pickupLat, nearest.pickupLng);
      const dRide = this.distKm(this.currentLocation!.lat, this.currentLocation!.lng, ride.pickupLat, ride.pickupLng);
      return dRide < dNearest ? ride : nearest;
    });
  }

  private async loadPickupRoute(ride: PassengerRide): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const result = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng, this.currentLocation.lat,
        ride.pickupLng, ride.pickupLat,
        '#4285F4',
        `Pickup: ${ride.pickupName}`,
        ride.pickupLat, ride.pickupLng,
      );
      this.currentRideCoords = result.coords;
      this.updateRide(ride.rideId, {
        routeEta: `${result.eta} · ${result.distanceKm} km`,
        routeDurationMin: result.durationMin,
      });
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Pickup route error:', err);
    }
  }

  private async loadDropRoute(ride: PassengerRide): Promise<void> {
    if (!this.currentLocation) return;
    try {
      const result = await this.mapService.fetchAndDrawRoute(
        this.currentLocation.lng, this.currentLocation.lat,
        ride.dropLng, ride.dropLat,
        '#7c3aed',
      );
      this.currentRideCoords = result.coords;
      this.updateRide(ride.rideId, {
        routeEta: `${result.eta} · ${result.distanceKm} km`,
        routeDurationMin: result.durationMin,
      });
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Drop route error:', err);
    }
  }

  private async calcPickupDropDistance(
    rideId: string, pickupLng: number, pickupLat: number, dropLng: number, dropLat: number
  ): Promise<void> {
    try {
      const res = await fetch(API.osrm.route(pickupLng, pickupLat, dropLng, dropLat));
      const data = await res.json();
      if (data.routes?.length) {
        this.updateRide(rideId, {
          pickupToDropDistanceKm: Math.round((data.routes[0].distance / 1000) * 100) / 100,
        });
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error('Distance calc error:', err);
    }
  }

  public toggleSimulation(): void {
    if (!this.currentRideCoords.length || this.simulationRunning) return;
    this.startSimulation();
  }

  private startSimulation(): void {
    const ride = this.activeRide;
    if (!ride) return;
    const isPickupPhase = this.carpoolPhase === 'pickups';
    const onComplete = () => {
      this.simulationRunning = false;
      if (isPickupPhase) {
        this.signalRService.invoke('DriverArrivedAtPickup', ride.rideId).catch(() => {});
      } else {
        this.updateRide(ride.rideId, {
          arrivedAtDrop: true,
          paymentData: {
            totalKm: ride.pickupToDropDistanceKm,
            ratePerKm: this.authService.getRatePerKm(),
            totalCost: Math.round(ride.pickupToDropDistanceKm * this.authService.getRatePerKm()),
          },
        });
      }
      this.saveSession();
      this.cdr.detectChanges();
    };
    this.simulationRunning = true;
    this.saveSession();
    this.simulationService.start(this.currentRideCoords, 30000, onComplete);
    this.cdr.detectChanges();
  }

  public endRide(): void {
    const ride = this.activeRide;
    if (!ride) return;
    this.signalRService.invoke('RideCompleted', ride.rideId, ride.pickupToDropDistanceKm).catch(console.error);
  }

  public submitPin(rideId: string, pin: string): void {
    if (!rideId || pin.length !== 4) return;
    this.updateRide(rideId, { pinError: null });
    this.signalRService.invoke('ConfirmPin', rideId, pin).catch(console.error);
  }

  public cancelRide(rideId: string): void {
    this.signalRService.invoke('CancelRide', rideId, 'Driver').catch(console.error);
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
    const driverName = this.authService.getUserName() ?? 'Driver';
    const vehicleModel = this.authService.getVehicleModel() ?? '';
    const availableSeats = this.authService.getAvailableSeats();
    const ratePerKm = this.authService.getRatePerKm();
    const phoneNumber = this.authService.getPhone() ?? '';
    const vehicleNumber = this.authService.getVehicleNo() ?? '';

    const sendOnline = (lat: number, lng: number): void => {
      const invoke = () =>
        this.signalRService.invoke('DriverGoOnline', lat, lng, driverName, vehicleModel, availableSeats, ratePerKm, phoneNumber, vehicleNumber).catch(console.error);
      if (this.signalRService.state === signalR.HubConnectionState.Connected) invoke();
      else this.signalRService.connect().then(invoke);
    };

    if (this.manualLocationSet && this.currentLocation) {
      this.mapService.placeDriverMarker(this.currentLocation.lat, this.currentLocation.lng);
      this.isOnline = true;
      this.isConnecting = false;
      this.saveSession();
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
        this.saveSession();
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
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.currentLocation = { lat, lng };
        if (!this.simulationRunning) {
          this.mapService.placeDriverMarker(lat, lng);
        }
        this.saveSession();
        this.cdr.detectChanges();
        if (this.signalRService.state === signalR.HubConnectionState.Connected)
          this.signalRService.invoke('UpdateLocation', lat, lng).catch(() => {});
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
  }

  public onLocationInput(): void {
    clearTimeout(this.locationDebounce);
    if (this.locationQuery.length < 2) { this.locationSuggestions = []; return; }
    this.locationDebounce = setTimeout(() => {
      fetch(API.nominatim.search(appendCityIfNeeded(this.locationQuery, DEFAULT_CITY)))
        .then((r) => r.json())
        .then((results) => { this.locationSuggestions = results; this.cdr.detectChanges(); });
    }, 400);
  }

  public selectManualLocation(s: LocationSuggestion): void {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    this.currentLocation = { lat, lng };
    this.locationQuery = s.display_name.split(',')[0];
    this.locationSuggestions = [];
    this.manualLocationSet = true;
    this.mapService.placeDriverMarker(lat, lng);
    this.mapService.setView(lat, lng, 15);
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
    const token = localStorage.getItem('token');
    this.http.get<any[]>(API.rides.driver, { headers: { Authorization: `Bearer ${token}` } })
      .subscribe({
        next: (data) => { this.rideHistory = data; this.historyLoading = false; this.cdr.detectChanges(); },
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

  private showToast(message: string): void {
    this.locationError = message;
    setTimeout(() => { this.locationError = null; this.cdr.detectChanges(); }, 3000);
  }

  private distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dx = lat2 - lat1;
    const dy = (lng2 - lng1) * Math.cos(lat1 * Math.PI / 180);
    return Math.sqrt(dx * dx + dy * dy) * 111;
  }
}