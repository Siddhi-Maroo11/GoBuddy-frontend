import { Component, AfterViewInit, OnDestroy, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthService } from '../../../services/auth.service';
import { PassengerSignalRService } from '../../../services/passenger-signalr.service';
import { PassengerMapService } from '../../../services/passenger-map.service';
import { API, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DEFAULT_CITY, REQUEST_TIMEOUT_MS } from '../../../constants/api.constants';
import { NearbyDriver } from '../../../models/driver.model';
import { LocationSuggestion, SelectedLocation } from '../../../models/location.model';
import { appendCityIfNeeded } from '../../../utils/map.utils';

const PASSENGER_SESSION_KEY = 'passenger_ride_state';

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
  public activeInput: 'pickup' | 'drop' | null = null;
  public nextDropInfo: string = '';
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
  public paymentData: { driverName: string; totalKm: number; ratePerKm: number; totalCost: number; } | null = null;
  public driverPickingUpOtherMsg: string | null = null;
  public newPassengerJoinedMsg: string | null = null;
  public nearbyDrivers: NearbyDriver[] = [];
  public selectedDriver: NearbyDriver | null = null;
  public isSearching: boolean = false;
  public showHistory: boolean = false;
  public historyLoading: boolean = false;
  public rideHistory: any[] = [];
  public driverEta: string = '';
  public driverDistanceKm: number = 0;
  private acceptedDriverConnectionId: string | null = null;
  private lastSidebarState: boolean = false;
  private subs: Subscription[] = [];
  private pickupDebounce: any;
  private dropDebounce: any;
  private locationUpdateDebounce: any;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
    private readonly signalRService: PassengerSignalRService,
    private readonly mapService: PassengerMapService,
  ) {}

  private saveSession(): void {
    try {
      sessionStorage.setItem(PASSENGER_SESSION_KEY, JSON.stringify({
        selectedPickup: this.selectedPickup,
        selectedDrop: this.selectedDrop,
        pickupQuery: this.pickupQuery,
        dropQuery: this.dropQuery,
        pickupToDropRouteKm: this.pickupToDropRouteKm,
        rideAccepted: this.rideAccepted,
        activeRideId: this.activeRideId,
        acceptedDriver: this.acceptedDriver,
        pinConfirmed: this.pinConfirmed,
        driverArrived: this.driverArrived,
        rideCompleted: this.rideCompleted,
        paymentData: this.paymentData,
      }));
    } catch {}
  }

  private restoreSession(): void {
    try {
      const rawSessionData = sessionStorage.getItem(PASSENGER_SESSION_KEY);
      if (!rawSessionData) return;
      const parsedSessionData = JSON.parse(rawSessionData);
      this.selectedPickup = parsedSessionData.selectedPickup ?? null;
      this.selectedDrop = parsedSessionData.selectedDrop ?? null;
      this.pickupQuery = parsedSessionData.pickupQuery ?? '';
      this.dropQuery = parsedSessionData.dropQuery ?? '';
      this.pickupToDropRouteKm = parsedSessionData.pickupToDropRouteKm ?? 0;
      this.rideAccepted = parsedSessionData.rideAccepted ?? false;
      this.activeRideId = parsedSessionData.activeRideId ?? null;
      this.acceptedDriver = parsedSessionData.acceptedDriver ?? null;
      this.pinConfirmed = parsedSessionData.pinConfirmed ?? false;
      this.driverArrived = parsedSessionData.driverArrived ?? false;
      this.rideCompleted = parsedSessionData.rideCompleted ?? false;
      this.paymentData = parsedSessionData.paymentData ?? null;
    } catch {
      sessionStorage.removeItem(PASSENGER_SESSION_KEY);
    }
  }

  private clearSession(): void {
    sessionStorage.removeItem(PASSENGER_SESSION_KEY);
  }

  public ngAfterViewInit(): void {
    this.passengerName = this.authService.getUserName() ?? 'Passenger';
    this.passengerPin = this.authService.getUserPin();
    this.mapService.initMap('passenger-map', DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    this.restoreSession();
    if (this.selectedPickup) {
      this.mapService.placePickupMarker(this.selectedPickup.lat, this.selectedPickup.lng);
    }
    if (this.selectedDrop) {
      this.mapService.placeDropMarker(this.selectedDrop.lat, this.selectedDrop.lng);
    }
    if (this.selectedPickup && this.selectedDrop) {
      this.mapService.drawPickupDropRoute(this.selectedPickup, this.selectedDrop);
    }
    if (this.rideAccepted && this.acceptedDriver && this.selectedPickup) {
      if (this.pinConfirmed && this.selectedDrop) {
        this.mapService.drawDropRoute(this.selectedPickup, this.selectedDrop);
      } else {
        this.mapService.drawDriverRoute(this.acceptedDriver.driverLat, this.acceptedDriver.driverLng, this.selectedPickup);
      }
    }
    this.subscribeToMapEvents();
    this.connectSignalR();
  }

  public ngAfterViewChecked(): void {
    const isBothLocationsSelected = !!(this.selectedPickup && this.selectedDrop);
    if (isBothLocationsSelected !== this.lastSidebarState) {
      this.lastSidebarState = isBothLocationsSelected;
      setTimeout(() => this.mapService.invalidateSize(), 310);
    }
  }

  public ngOnDestroy(): void {
    this.subs.forEach((subscription) => subscription.unsubscribe());
    this.signalRService.disconnect();
    clearTimeout(this.pickupDebounce);
    clearTimeout(this.dropDebounce);
    clearTimeout(this.locationUpdateDebounce);
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
      this.signalRService.driverOnline$.subscribe((driverOnlineDetails) => {
        if (!this.rideAccepted) this.mapService.addDriverMarker(driverOnlineDetails.driverId, driverOnlineDetails.latitude, driverOnlineDetails.longitude);
        if (this.selectedPickup && this.selectedDrop) this.findDrivers();
        this.cdr.detectChanges();
      }),
      this.signalRService.locationUpdated$.subscribe((locationDetails) => {
        if (this.rideAccepted && locationDetails.driverId === this.acceptedDriverConnectionId) {
          this.mapService.updateDriverMarker(locationDetails.driverId, locationDetails.latitude, locationDetails.longitude);
          if (this.pinConfirmed) {
            this.mapService.placePassengerMarker(locationDetails.latitude, locationDetails.longitude);
          } else if (this.selectedPickup) {
            this.mapService.placePassengerMarker(this.selectedPickup.lat, this.selectedPickup.lng);
          }
        } else if (!this.rideAccepted) {
          this.mapService.updateDriverMarker(locationDetails.driverId, locationDetails.latitude, locationDetails.longitude);
          if (this.selectedPickup && this.selectedDrop) {
            clearTimeout(this.locationUpdateDebounce);
            this.locationUpdateDebounce = setTimeout(() => this.findDrivers(), 3000);
          }
        }
        this.cdr.detectChanges();
      }),
      this.signalRService.driverOffline$.subscribe((offlineDetails) => {
        this.mapService.removeDriverMarker(offlineDetails.driverId);
        this.nearbyDrivers = this.nearbyDrivers.filter((driverItem) => driverItem.connectionId !== offlineDetails.driverId);
        if (this.selectedDriver?.connectionId === offlineDetails.driverId) this.selectedDriver = null;
        this.cdr.detectChanges();
      }),
      this.signalRService.requestSent$.subscribe(() => {
        this.requestSent = true;
        this.cdr.detectChanges();
      }),
      this.signalRService.requestFailed$.subscribe((failureDetails) => {
        this.requestError = failureDetails.message;
        this.requestSent = false;
        if (this.pendingDriverId) {
          this.requestingDriverIds.delete(this.pendingDriverId);
          this.pendingDriverId = null;
        }
        this.cdr.detectChanges();
      }),
      this.signalRService.rideAccepted$.subscribe((acceptedRideDetails) => {
        this.requestSent = false;
        this.rideAccepted = true;
        this.rideRejected = false;
        this.rideTimeout = false;
        this.acceptedDriver = acceptedRideDetails;
        this.activeRideId = acceptedRideDetails.rideId;
        this.pinConfirmed = false;
        this.driverArrived = false;
        this.cancelError = null;
        this.driverPickingUpOtherMsg = null;
        this.newPassengerJoinedMsg = null;
        this.requestingDriverIds.clear();
        this.pendingDriverId = null;
        this.acceptedDriverConnectionId = acceptedRideDetails.driverConnectionId;
        this.mapService.clearRoutes();
        this.mapService.removePickupMarker();
        this.mapService.showOnlyDriver(acceptedRideDetails.driverConnectionId);
        if (this.selectedPickup) {
          this.mapService.drawDriverRoute(acceptedRideDetails.driverLat, acceptedRideDetails.driverLng, this.selectedPickup).then((routeInfo) => {
            if (routeInfo) {
              this.driverEta = routeInfo.eta;
              this.driverDistanceKm = routeInfo.distanceKm;
            }
            this.cdr.detectChanges();
          });
        }
        this.saveSession();
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
        this.driverPickingUpOtherMsg = null;
        this.saveSession();
        this.cdr.detectChanges();
      }),
      this.signalRService.pinConfirmed$.subscribe(() => {
        this.pinConfirmed = true;
        this.driverArrived = false;
        this.cancelError = null;
        this.driverPickingUpOtherMsg = null;
        if (this.selectedPickup && this.selectedDrop) this.mapService.drawDropRoute(this.selectedPickup, this.selectedDrop);
        this.saveSession();
        this.cdr.detectChanges();
      }),
      this.signalRService.driverPickingUpOther$.subscribe((pickingUpDetails) => {
        this.driverPickingUpOtherMsg = pickingUpDetails.message;
        if (this.selectedPickup) this.mapService.drawDriverRoute(pickingUpDetails.driverLat, pickingUpDetails.driverLng, this.selectedPickup);
        this.cdr.detectChanges();
      }),
      this.signalRService.newPassengerJoined$.subscribe((joinedPassengerDetails: any) => {
        this.newPassengerJoinedMsg = joinedPassengerDetails.message;
        if (this.pinConfirmed && this.selectedDrop) {
          this.mapService.drawRouteViaPickup(joinedPassengerDetails.driverLat, joinedPassengerDetails.driverLng, joinedPassengerDetails.pickupLat, joinedPassengerDetails.pickupLng, joinedPassengerDetails.pickupName);
          this.mapService.placeNextDropMarker(joinedPassengerDetails.pickupLat, joinedPassengerDetails.pickupLng, joinedPassengerDetails.pickupName);
        }
        setTimeout(() => {
          this.newPassengerJoinedMsg = null;
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCancelled$.subscribe((cancelledDetails) => {
        this.mapService.restoreAllDrivers();
        this.resetRideState();
        this.acceptedDriverConnectionId = null;
        this.requestError = cancelledDetails.message;
        this.clearSession();
        if (this.selectedPickup) this.findDrivers();
        this.cdr.detectChanges();
      }),
      this.signalRService.cancelError$.subscribe((cancelErrorDetails) => {
        this.cancelError = cancelErrorDetails.message;
        this.cdr.detectChanges();
      }),
      this.signalRService.rideCompleted$.subscribe((completionDetails) => {
        if (completionDetails) {
          const fareRatePerKm = this.acceptedDriver?.ratePerKm ?? completionDetails.ratePerKm;
          const travelDistanceKm = this.pickupToDropRouteKm;
          this.paymentData = {
            driverName: completionDetails.driverName,
            totalKm: travelDistanceKm,
            ratePerKm: fareRatePerKm,
            totalCost: Math.round(travelDistanceKm * fareRatePerKm),
          };
        }
        this.rideAccepted = false;
        this.pinConfirmed = false;
        this.rideCompleted = true;
        this.acceptedDriverConnectionId = null;
        this.mapService.clearRoutes();
        this.saveSession();
        this.cdr.detectChanges();
      }),
      this.signalRService.driverSeatsUpdated$.subscribe((seatUpdateDetails) => {
        const targetedDriver = this.nearbyDrivers.find((driverItem) => driverItem.connectionId === seatUpdateDetails.driverId);
        if (targetedDriver) {
          targetedDriver.availableSeats = seatUpdateDetails.availableSeats;
          this.cdr.detectChanges();
        }
        if (!targetedDriver && this.selectedPickup && this.selectedDrop) {
          clearTimeout(this.locationUpdateDebounce);
          this.locationUpdateDebounce = setTimeout(() => this.findDrivers(), 1000);
        }
      }),
      this.signalRService.driverSeatsFull$.subscribe((seatsFullDetails) => {
        this.nearbyDrivers = this.nearbyDrivers.filter((driverItem) => driverItem.connectionId !== seatsFullDetails.driverId);
        this.cdr.detectChanges();
      }),
      this.signalRService.nextDropUpdate$.subscribe((nextDropDetails) => {
        if (this.pinConfirmed) {
          this.mapService.drawRouteToNextDrop(nextDropDetails.driverLat, nextDropDetails.driverLng, nextDropDetails.nextDropLat, nextDropDetails.nextDropLng, nextDropDetails.nextDropName);
          this.mapService.placeNextDropMarker(nextDropDetails.nextDropLat, nextDropDetails.nextDropLng, nextDropDetails.nextDropName);
          this.nextDropInfo = `${nextDropDetails.stopsRemaining} stop${nextDropDetails.stopsRemaining > 1 ? 's' : ''} remaining`;
        }
        this.cdr.detectChanges();
      }),
    );
  }

  private async drawAndStoreDistance(pickupLocation: SelectedLocation, dropLocation: SelectedLocation): Promise<void> {
    this.pickupToDropRouteKm = await this.mapService.drawPickupDropRoute(pickupLocation, dropLocation);
    this.saveSession();
    this.cdr.detectChanges();
  }

  private resetRideState(): void {
    this.rideAccepted = false;
    this.acceptedDriver = null;
    this.activeRideId = null;
    this.pinConfirmed = false;
    this.driverArrived = false;
    this.cancelError = null;
    this.driverPickingUpOtherMsg = null;
    this.newPassengerJoinedMsg = null;
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
    this.acceptedDriverConnectionId = null;
    this.driverEta = '';
    this.driverDistanceKm = 0;
    this.mapService.resetMap();
  }

  public resetForNewRide(): void {
    this.fullReset();
    this.clearSession();
    this.fetchExistingDrivers();
    this.cdr.detectChanges();
  }

  private fetchExistingDrivers(): void {
    this.http.get<any[]>(API.drivers.all).subscribe({
      next: (driverList) => {
        driverList.forEach((driverItem) => this.mapService.addDriverMarker(driverItem.connectionId, driverItem.latitude, driverItem.longitude));
        this.cdr.detectChanges();
      },
    });
  }

  private findDrivers(): void {
    if (!this.selectedPickup || !this.selectedDrop) return;
    this.isSearching = true;
    this.cdr.detectChanges();
    this.http.get<NearbyDriver[]>(API.drivers.nearby(this.selectedPickup.lat, this.selectedPickup.lng, this.selectedDrop.lat, this.selectedDrop.lng)).subscribe({
      next: (nearbyDriversList) => {
        this.nearbyDrivers = nearbyDriversList;
        this.isSearching = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSearching = false;
        this.cdr.detectChanges();
      },
    });
  }

  private searchLocation(queryText: string, locationType: 'pickup' | 'drop'): void {
    this.http.get<LocationSuggestion[]>(API.nominatim.search(appendCityIfNeeded(queryText, DEFAULT_CITY))).subscribe({
      next: (searchResults) => {
        if (locationType === 'pickup') this.pickupSuggestions = searchResults;
        else this.dropSuggestions = searchResults;
        this.cdr.detectChanges();
      },
    });
  }

  private reverseGeocode(latitude: number, longitude: number, locationType: 'pickup' | 'drop'): void {
    this.http.get<any>(API.nominatim.reverse(latitude, longitude)).subscribe({
      next: (geocodeResult) => {
        const placeName = geocodeResult.display_name?.split(',')[0] || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        if (locationType === 'pickup') {
          this.pickupQuery = placeName;
          this.selectedPickup!.name = placeName;
        } else {
          this.dropQuery = placeName;
          this.selectedDrop!.name = placeName;
        }
        this.cdr.detectChanges();
        if (this.selectedPickup && this.selectedDrop) this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop);
        this.checkAutoSearch();
      },
    });
  }

  private setPickup(latitude: number, longitude: number, placeName: string): void {
    this.selectedPickup = { lat: latitude, lng: longitude, name: placeName };
    this.pickupQuery = placeName;
    this.mapService.placePickupMarker(latitude, longitude);
    this.activeInput = 'drop';
    if (this.selectedDrop) this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop);
  }

  private setDrop(latitude: number, longitude: number, placeName: string): void {
    this.selectedDrop = { lat: latitude, lng: longitude, name: placeName };
    this.dropQuery = placeName;
    this.mapService.placeDropMarker(latitude, longitude);
    this.activeInput = null;
    if (this.selectedPickup) this.drawAndStoreDistance(this.selectedPickup, this.selectedDrop!);
  }

  private checkAutoSearch(): void {
    if (this.selectedPickup && this.selectedDrop) {
      this.findDrivers();
      setTimeout(() => this.mapService.invalidateSize(), 350);
    }
  }

  public setActiveInput(inputType: 'pickup' | 'drop'): void {
    this.activeInput = inputType;
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

  public selectPickup(locationSuggestion: LocationSuggestion): void {
    this.setPickup(parseFloat(locationSuggestion.lat), parseFloat(locationSuggestion.lon), locationSuggestion.display_name.split(',')[0]);
    this.pickupSuggestions = [];
    this.checkAutoSearch();
  }

  public selectDrop(locationSuggestion: LocationSuggestion): void {
    this.setDrop(parseFloat(locationSuggestion.lat), parseFloat(locationSuggestion.lon), locationSuggestion.display_name.split(',')[0]);
    this.dropSuggestions = [];
    this.checkAutoSearch();
  }

  public useCurrentLocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (currentPosition) => {
        const { latitude: lat, longitude: lng } = currentPosition.coords;
        this.setPickup(lat, lng, 'Current Location');
        this.pickupQuery = 'Current Location';
        this.mapService.setView(lat, lng, 15);
        this.reverseGeocode(lat, lng, 'pickup');
        this.cdr.detectChanges();
      },
      (geolocationError) => console.error(geolocationError),
      { enableHighAccuracy: true },
    );
  }

  public selectDriver(chosenDriver: NearbyDriver): void {
    this.selectedDriver = chosenDriver;
    this.mapService.setView(chosenDriver.latitude, chosenDriver.longitude, 15);
    this.cdr.detectChanges();
  }

  public sendRideRequest(targetedDriver: NearbyDriver): void {
    if (!this.selectedPickup || !this.selectedDrop) return;
    if (this.requestingDriverIds.size > 0 || this.rideAccepted) return;
    const passengerAuthId = this.authService.getUserId();
    const authenticatedName = this.authService.getUserName();
    const authenticatedPin = this.authService.getUserPin();
    if (!passengerAuthId || !authenticatedName || !authenticatedPin) return;
    this.requestSent = false;
    this.requestingDriverIds.add(targetedDriver.connectionId);
    this.pendingDriverId = targetedDriver.connectionId;
    this.requestError = null;
    this.rideRejected = false;
    this.rideTimeout = false;
    this.rideCompleted = false;
    this.cdr.detectChanges();

    const invokeSignalRRequest = (): void => {
      this.signalRService.invoke('SendRideRequest', targetedDriver.connectionId, passengerAuthId, authenticatedName, this.selectedPickup!.lat, this.selectedPickup!.lng, this.selectedDrop!.lat, this.selectedDrop!.lng, this.selectedPickup!.name, this.selectedDrop!.name, authenticatedPin).catch((invocationError) => {
        console.error(invocationError);
        this.requestingDriverIds.delete(targetedDriver.connectionId);
        this.pendingDriverId = null;
        this.cdr.detectChanges();
      });
    };

    if (this.signalRService.state === signalR.HubConnectionState.Connected) invokeSignalRRequest();
    else this.signalRService.connect().then(() => invokeSignalRRequest());

    setTimeout(() => {
      if (this.requestingDriverIds.has(targetedDriver.connectionId) && !this.rideAccepted) {
        this.requestingDriverIds.delete(targetedDriver.connectionId);
        if (this.pendingDriverId === targetedDriver.connectionId) this.pendingDriverId = null;
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
    const passengerAuthId = this.authService.getUserId();
    if (passengerAuthId && this.signalRService.state === signalR.HubConnectionState.Connected) this.signalRService.invoke('PassengerLeft', passengerAuthId).catch(() => {});
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  public getExpectedCost(targetedDriver: NearbyDriver): string {
    if (!this.selectedPickup || !this.selectedDrop) return '';
    const estimatedCost = Math.round(this.pickupToDropRouteKm * targetedDriver.ratePerKm);
    return estimatedCost > 0 ? `₹${estimatedCost}` : '';
  }

  public openHistory(): void {
    this.showHistory = true;
    this.historyLoading = true;
    this.rideHistory = [];
    this.cdr.detectChanges();
    const authenticationToken = localStorage.getItem('token');
    this.http.get<any[]>(API.rides.passenger, { headers: { Authorization: `Bearer ${authenticationToken}` } }).subscribe({
      next: (historyRecords) => {
        this.rideHistory = historyRecords;
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