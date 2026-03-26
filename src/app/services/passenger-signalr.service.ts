import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { API } from '../constants/api.constants';

export interface RideAcceptedEvent {
  rideId: string;
  driverConnectionId: string;
  driverName: string;
  vehicleModel: string;
  driverLat: number;
  driverLng: number;
}

export interface LocationUpdatedEvent {
  driverId: string;
  latitude: number;
  longitude: number;
}

export interface RideCancelledEvent {
  message: string;
  cancelledBy: string;
  rideId?: string;
}

export interface DriverPickingUpOtherEvent {
  message: string;
  nextPickupName: string;
  driverLat: number;
  driverLng: number;
}

export interface NewPassengerJoinedEvent {
  message: string;
  passengerName: string;
  pickupName: string;
  driverLat: number;
  driverLng: number;
  pickupLat: number;
  pickupLng: number;
}

@Injectable({ providedIn: 'root' })
export class PassengerSignalRService {
  private hubConnection!: signalR.HubConnection;

  public driverOnline$ = new Subject<any>();
  public locationUpdated$ = new Subject<LocationUpdatedEvent>();
  public driverOffline$ = new Subject<any>();
  public requestSent$ = new Subject<void>();
  public requestFailed$ = new Subject<any>();
  public requestTimeout$ = new Subject<void>();
  public rideAccepted$ = new Subject<RideAcceptedEvent>();
  public rideRejected$ = new Subject<void>();
  public driverArrived$ = new Subject<void>();
  public pinConfirmed$ = new Subject<void>();
  public rideCancelled$ = new Subject<RideCancelledEvent>();
  public cancelError$ = new Subject<any>();
  public rideCompleted$ = new Subject<any>();
  public driverSeatsUpdated$ = new Subject<{ driverId: string; availableSeats: number }>();
  public driverSeatsFull$ = new Subject<{ driverId: string }>();
  public driverPickingUpOther$ = new Subject<DriverPickingUpOtherEvent>();
  public newPassengerJoined$ = new Subject<NewPassengerJoinedEvent>();
  public nextDropUpdate$ = new Subject<{
    nextDropName: string;
    nextDropLat: number;
    nextDropLng: number;
    driverLat: number;
    driverLng: number;
    stopsRemaining: number;
  }>();

  public connect(): Promise<void> {
    const token = localStorage.getItem('token') ?? '';
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(API.signalR.hub + `?access_token=${token}`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect()
      .build();
    this.registerHandlers();
    return this.hubConnection.start();
  }

  public disconnect(): void {
    this.hubConnection?.stop();
  }

  public get state(): signalR.HubConnectionState {
    return this.hubConnection?.state;
  }

  public invoke(method: string, ...args: any[]): Promise<void> {
    return this.hubConnection.invoke(method, ...args);
  }

  private registerHandlers(): void {
    this.hubConnection.on('DriverOnline', (d) => this.driverOnline$.next(d));
    this.hubConnection.on('LocationUpdated', (d) => this.locationUpdated$.next(d));
    this.hubConnection.on('DriverOffline', (d) => this.driverOffline$.next(d));
    this.hubConnection.on('RequestSent', () => this.requestSent$.next());
    this.hubConnection.on('RequestFailed', (d) => this.requestFailed$.next(d));
    this.hubConnection.on('RequestTimeout', () => this.requestTimeout$.next());
    this.hubConnection.on('RideAccepted', (d) => this.rideAccepted$.next(d));
    this.hubConnection.on('RideRejected', () => this.rideRejected$.next());
    this.hubConnection.on('DriverArrived', () => this.driverArrived$.next());
    this.hubConnection.on('PinConfirmed', () => this.pinConfirmed$.next());
    this.hubConnection.on('RideCancelled', (d) => this.rideCancelled$.next(d));
    this.hubConnection.on('CancelError', (d) => this.cancelError$.next(d));
    this.hubConnection.on('RideCompleted', (d) => this.rideCompleted$.next(d));
    this.hubConnection.on('DriverSeatsUpdated', (d) => this.driverSeatsUpdated$.next(d));
    this.hubConnection.on('DriverSeatsFull', (d) => this.driverSeatsFull$.next(d));
    this.hubConnection.on('DriverPickingUpOther', (d) => this.driverPickingUpOther$.next(d));
    this.hubConnection.on('NewPassengerJoined', (d) => this.newPassengerJoined$.next(d));
    this.hubConnection.on('NextDropUpdate', (data) => this.nextDropUpdate$.next(data));
  }
}
