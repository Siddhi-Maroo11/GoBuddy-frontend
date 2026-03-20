import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../../services/auth.service';
import { PassengerSignalRService } from '../../../services/passenger-signalr.service';
import { PassengerMapService } from '../../../services/passenger-map.service';
import {
  API,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  DEFAULT_CITY,
  REQUEST_TIMEOUT_MS,
} from '../../../constants/api.constants';
import { NearbyDriver } from '../../../models/driver.model';
import { LocationSuggestion, SelectedLocation } from '../../../models/location.model';
import { appendCityIfNeeded } from '../../../utils/map.utils';

@Component({
  selector: 'app-passenger-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './passenger-dashboard.html',
  styleUrl: './passenger-dashboard.scss',
})
export class PassengerDashboard implements AfterViewInit, AfterViewChecked, OnDestroy {
  public pickupQuery: string = '';
  public dropQuery: string = '';
  public pickupSuggestions: LocationSuggestion[] = [];
  public dropSuggestions: LocationSuggestion[] = [];
  public selectedPickup: SelectedLocation | null = null;
  public selectedDrop: SelectedLocation | null = null;
  public pickupToDropRouteKm: number = 0;

  public requestError: string | null = null;
  public rideAccepted: boolean = false;
  public rideRejected: boolean = false;
  public rideTimeout: boolean = false;
  public acceptedDriver: any = null;
  public passengerPin: string | null = null;
  public requestingDriverIds: Set<string> = new Set();
  public pendingDriverId: string | null = null;
  public requestSent: boolean = false;
  public activeRideId: string | null = null;
  public pinConfirmed: boolean = false;
  public driverArrived: boolean = false;
  public cancelError: string | null = null;
  public rideCompleted: boolean = false;
  public passengerName: string = '';
  public paymentData: {
    driverName: string;
    totalKm: number;
    ratePerKm: number;
    totalCost: number;
  } | null = null;

  public activeInput: 'pickup' | 'drop' | null = null;
  public nearbyDrivers: NearbyDriver[] = [];
  public selectedDriver: NearbyDriver | null = null;
  public isSearching: boolean = false;

  public showHistory: boolean = false;
  public historyLoading: boolean = false;
  public rideHistory: any[] = [];

  private lastSidebarState: boolean = false;
  private subs: Subscription[] = [];
  private pickupDebounce: any;
  private dropDebounce: any;
  private cancelMessageTimer: any;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly signalRService: PassengerSignalRService,
    private readonly mapService: PassengerMapService,
  ) { }

  public ngAfterViewInit(): void {
    this.passengerName = this.authService.getUserName() ?? 'Passenger';
    this.passengerPin = this.authService.getUserPin();
    this.mapService.initMap('passenger-map', DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    this.subscribeToMapEvents();
    this.connectSignalR();
    this.showCurrentLocationDot(); 
  }

  public ngAfterViewChecked(): void {
    const current: boolean = !!(this.selectedPickup && this.selectedDrop);
    if (current !== this.lastSidebarState) {
      this.lastSidebarState = current;
      setTimeout(() => this.mapService.invalidateSize(), 310);
    }
  }

  public ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.signalRService.disconnect();
    clearTimeout(this.pickupDebounce);
    clearTimeout(this.dropDebounce);
    clearTimeout(this.cancelMessageTimer);
  }

  private subscribeToMapEvents(): void {
    this.subs.push(
      this.mapService.mapClick$.subscribe(({ lat, lng }) => {
        if (this.activeInput === 'pickup') {
          this.setPickup(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          this.reverseGeocode(lat, lng, 'pickup');
        } else if (this.activeInput === 'drop') {
          this.setDrop(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          this.reverseGeocode(lat, lng, 'drop');
        }
        this.cdr.detectChanges();
      }),

      this.mapService.markerDrag$.subscribe(({ lat, lng, type }) => {
        if (type === 'pickup') {
          this.selectedPickup = { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
          this.reverseGeocode(lat, lng, 'pickup');
        } else {
          this.selectedDrop = { lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
          this.reverseGeocode(lat, lng, 'drop');
        }
      }),
    );
  }

  private connectSignalR(): void {
    this.signalRService.connect().then(() => this.fetchExistingDrivers());

    this.subs.push(
      this.signalRService.driverOnline$.subscribe((data) => {
        this.mapService.addDriverMarker(data.driverId, data.latitude, data.longitude);
        if (this.selectedPickup && this.selectedDrop) this.findDrivers();
        this.cdr.detectChanges();
      }),

      this.signalRService.seatsUpdated$.subscribe((data) => {
         const driver = this.nearbyDrivers.find(driver => driver.connectionId === data.driverId);
           if (driver) {
                driver.availableSeats = data.availableSeats;
            }
          this.nearbyDrivers = this.nearbyDrivers.filter(driver => driver.availableSeats > 0);
          this.cdr.detectChanges();
}),

      this.signalRService.locationUpdated$.subscribe((data) => {
        this.mapService.updateDriverMarker(data.driverId, data.latitude, data.longitude);
        if (this.rideAccepted && this.pinConfirmed) {
          this.mapService.placePassengerMarker(data.latitude, data.longitude);
        } else if (this.rideAccepted && !this.pinConfirmed) {
          if (this.selectedPickup)
            this.mapService.placePassengerMarker(this.selectedPickup.lat, this.selectedPickup.lng);
        }
        this.cdr.detectChanges();
      }),

      this.signalRService.driverOffline$.subscribe((data) => {
        this.mapService.removeDriverMarker(data.driverId);
        this.nearbyDrivers = this.nearbyDrivers.filter((d) => d.connectionId !== data.driverId);
        if (this.selectedDriver?.connectionId === data.driverId) this.selectedDriver = null;
        this.cdr.detectChanges();
      }),

      this.signalRService.requestSent$.subscribe(() => {
        this.requestSent = true;
        this.cdr.detectChanges();
      }),

      this.signalRService.requestFailed$.subscribe((data) => {
        this.requestError = data.message;
        if (this.pendingDriverId) {
          this.requestingDriverIds.delete(this.pendingDriverId);
          this.pendingDriverId = null;
        }
        this.cdr.detectChanges();
      }),

      this.signalRService.rideAccepted$.subscribe((data) => {
        this.requestSent = false;
        this.rideAccepted = true;
        this.rideRejected = false;
        this.rideTimeout = false;
        this.acceptedDriver = data;
        this.activeRideId = data.rideId;
        this.pinConfirmed = false;
        this.driverArrived = false;
        this.cancelError = null;
        this.requestingDriverIds.clear();
        this.pendingDriverId = null;
        if (this.selectedPickup)
          this.mapService.drawDriverRoute(data.driverLat, data.driverLng, this.selectedPickup);
        this.cdr.detectChanges();
      }),

      this.signalRService.rideRejected$.subscribe(() => {
        this.requestSent = false;
        this.rideRejected = true;
        this.rideAccepted = false;
        if (this.pendingDriverId) {
          this.requestingDriverIds.delete(this.pendingDriverId);
          this.pendingDriverId = null;
        }
        this.cdr.detectChanges();
      }),

      this.signalRService.requestTimeout$.subscribe(() => {
        this.requestSent = false;
        this.rideTimeout = true;
        if (this.pendingDriverId) {
          this.requestingDriverIds.delete(this.pendingDriverId);
          this.pendingDriverId = null;
        }
        this.cdr.detectChanges();
      }),

      this.signalRService.driverArrived$.subscribe(() => {
        this.driverArrived = true;
        this.cdr.detectChanges();
      }),

      this.signalRService.pinConfirmed$.subscribe(() => {
        this.pinConfirmed = true;
        this.driverArrived = false;
        this.cancelError = null;
        if (this.selectedPickup && this.selectedDrop)
          this.mapService.drawDropRoute(this.selectedPickup, this.selectedDrop);
        this.cdr.detectChanges();
      }),

      this.signalRService.rideCancelled$.subscribe((data) => {
        this.resetRideState();
        this.requestError = data.message;
        if (this.selectedPickup) this.findDrivers();
        this.cdr.detectChanges();

        clearTimeout(this.cancelMessageTimer);
        this.cancelMessageTimer = setTimeout(() => {
          this.requestError = null;
          this.cdr.detectChanges();
        }, 3000);
      }),

      this.signalRService.cancelError$.subscribe((data) => {
        this.cancelError = data.message;
        this.cdr.detectChanges();
      }),

      this.signalRService.rideCompleted$.subscribe((data) => {
        if (data) {
          this.paymentData = {
            driverName: data.driverName,
            totalKm: data.totalKm,
            ratePerKm: data.ratePerKm,
            totalCost: data.totalCost,
          };
        }
        this.rideAccepted = false;
        this.pinConfirmed = false;
        this.rideCompleted = true;
        this.mapService.clearRoutes();
        this.cdr.detectChanges();
      }),
    );
  }

  private async drawAndStoreDistance(
    pickup: SelectedLocation,
    drop: SelectedLocation,
  ): Promise<void> {
    this.pickupToDropRouteKm = await this.mapService.drawPickupDropRoute(pickup, drop);
    this.cdr.detectChanges();
  }

  private resetRideState(): void {
    this.rideAccepted = false;
    this.acceptedDriver = null;
    this.activeRideId = null;
    this.pinConfirmed = false;
    this.driverArrived = false;
    this.cancelError = null;
    this.requestingDriverIds.clear();
    this.pendingDriverId = null;
    this.requestSent = false;
    this.mapService.clearDriverRoute();
  }

  private fullReset(): void {
    this.resetRideState();
    this.selectedPickup = null;
    this.selectedDrop = null;
    this.pickupQuery = '';
    this.dropQuery = '';
    this.pickupSuggestions = [];
    this.dropSuggestions = [];
    this.nearbyDrivers = [];
    this.pickupToDropRouteKm = 0;
    this.requestError = null;
    this.rideRejected = false;
    this.rideTimeout = false;
    this.rideCompleted = false;
    this.paymentData = null;
    this.selectedDriver = null;
    this.activeInput = null;
    this.mapService.resetMap();
  }

  public resetForNewRide(): void {
    this.fullReset();
    this.fetchExistingDrivers();
    this.cdr.detectChanges();
  }

  private fetchExistingDrivers(): void {
    this.http.get<any[]>(API.drivers.all).subscribe({
      next: (drivers) => {
        drivers.forEach((d) =>
          this.mapService.addDriverMarker(d.connectionId, d.latitude, d.longitude),
        );
        this.cdr.detectChanges();
      },
    });
  }

  private searchLocation(query: string, type: 'pickup' | 'drop'): void {
    const url = API.nominatim.search(appendCityIfNeeded(query, DEFAULT_CITY));
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
        const name = result.display_name?.split(',')[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (type === 'pickup') {
          this.pickupQuery = name;
          this.selectedPickup!.name = name;
        } else {
          this.dropQuery = name;
          this.selectedDrop!.name = name;
        }
        this.cdr.detectChanges();
        if (this.selectedPickup && this.selectedDrop)
          this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop);
        this.checkAutoSearch();
      },
    });
  }

  private setPickup(lat: number, lng: number, name: string): void {
    this.selectedPickup = { lat, lng, name };
    this.pickupQuery = name;
    this.mapService.placePickupMarker(lat, lng);
    this.activeInput = 'drop';
    if (this.selectedDrop) this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop);
  }

  private setDrop(lat: number, lng: number, name: string): void {
    this.selectedDrop = { lat, lng, name };
    this.dropQuery = name;
    this.mapService.placeDropMarker(lat, lng);
    this.activeInput = null;
    if (this.selectedPickup) this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop!);
  }

  private checkAutoSearch(): void {
    if (this.selectedPickup && this.selectedDrop) {
      this.findDrivers();
      setTimeout(() => this.mapService.invalidateSize(), 350);
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
        this.nearbyDrivers = drivers.filter(d => d.availableSeats > 0);  // ← sirf ye change
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.setPickup(lat, lng, 'Current Location');
        this.pickupQuery = 'Current Location';
        this.mapService.setView(lat, lng, 15);
        this.reverseGeocode(lat, lng, 'pickup');
        this.cdr.detectChanges();
      },
      (err) => console.error(err),
      { enableHighAccuracy: true },
    );
  }

  private showCurrentLocationDot(): void {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      this.mapService.placePickupMarker(lat, lng);
      this.mapService.setView(lat, lng, 14);
      this.cdr.detectChanges();
    },
    (err) => console.error(err),
    { enableHighAccuracy: true },
  );
}

  public selectDriver(driver: NearbyDriver): void {
    this.selectedDriver = driver;
    this.mapService.setView(driver.latitude, driver.longitude, 15);
    this.cdr.detectChanges();
  }

  public sendRideRequest(driver: NearbyDriver): void {
    if (!this.selectedPickup || !this.selectedDrop) return;
    if (this.requestingDriverIds.size > 0 || this.rideAccepted) return;
    const passengerId = this.authService.getUserId();
    const pName = this.authService.getUserName();
    const pin = this.authService.getUserPin();
    if (!passengerId || !pName || !pin) return;

    this.requestSent = false;
    this.requestingDriverIds.add(driver.connectionId);
    this.pendingDriverId = driver.connectionId;
    this.requestError = null;
    this.rideRejected = false;
    this.rideTimeout = false;
    this.rideCompleted = false;
    this.cdr.detectChanges();

    const invoke = (): void => {
      this.signalRService
        .invoke(
          'SendRideRequest',
          driver.connectionId,
          passengerId,
          pName,
          this.selectedPickup!.lat,
          this.selectedPickup!.lng,
          this.selectedDrop!.lat,
          this.selectedDrop!.lng,
          this.selectedPickup!.name,
          this.selectedDrop!.name,
          pin,
        )
        .catch((err) => {
          console.error(err);
          this.requestingDriverIds.delete(driver.connectionId);
          this.pendingDriverId = null;
          this.cdr.detectChanges();
        });
    };

    if (this.signalRService.state === signalR.HubConnectionState.Connected) invoke();
    else this.signalRService.connect().then(() => invoke());

    setTimeout(() => {
      if (this.requestingDriverIds.has(driver.connectionId) && !this.rideAccepted) {
        this.requestingDriverIds.delete(driver.connectionId);
        if (this.pendingDriverId === driver.connectionId) this.pendingDriverId = null;
        this.cdr.detectChanges();
      }
    }, REQUEST_TIMEOUT_MS);
  }

  public cancelRide(): void {
    if (!this.activeRideId) return;
    this.signalRService.invoke('CancelRide', this.activeRideId, 'Passenger').catch(console.error);
  }

  public get canLogout(): boolean {
    return !this.rideAccepted;
  }

  public logout(): void {
    if (this.rideAccepted) return;
    const passengerId = this.authService.getUserId();
    if (passengerId && this.signalRService.state === signalR.HubConnectionState.Connected)
      this.signalRService.invoke('PassengerLeft', passengerId).catch(() => { });
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  public getExpectedCost(driver: NearbyDriver): string {
    if (!this.selectedPickup || !this.selectedDrop) return '';
    const cost = Math.round(this.pickupToDropRouteKm * driver.ratePerKm);
    return cost > 0 ? `₹${cost}` : '';
  }

  public openHistory(): void {
    this.showHistory = true;
    this.historyLoading = true;
    this.rideHistory = [];
    this.cdr.detectChanges();

    const token = localStorage.getItem('token');
    this.http
      .get<any[]>(API.rides.passenger, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .subscribe({
        next: (data) => {
          this.rideHistory = data;
          this.historyLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.historyLoading = false;
          this.cdr.detectChanges();
        },
      });
  }

  public closeHistory(): void {
    this.showHistory = false;
    this.cdr.detectChanges();
  }
}