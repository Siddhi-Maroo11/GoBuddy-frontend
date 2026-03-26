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
  public seatsUpdated$ = new Subject<{ driverId: string; availableSeats: number }>();

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
    if (this.hubConnection) this.hubConnection.stop();
  }

  public get state(): signalR.HubConnectionState {
    return this.hubConnection?.state;
  }

  public invoke(method: string, ...args: any[]): Promise<void> {
    return this.hubConnection.invoke(method, ...args);
  }

  private registerHandlers(): void {
    this.hubConnection.on('DriverOnline', (data) => this.driverOnline$.next(data));
    this.hubConnection.on('LocationUpdated', (data) => this.locationUpdated$.next(data));
    this.hubConnection.on('DriverOffline', (data) => this.driverOffline$.next(data));
    this.hubConnection.on('RequestSent', () => this.requestSent$.next());
    this.hubConnection.on('RequestFailed', (data) => this.requestFailed$.next(data));
    this.hubConnection.on('RequestTimeout', () => this.requestTimeout$.next());
    this.hubConnection.on('RideAccepted', (data) => this.rideAccepted$.next(data));
    this.hubConnection.on('RideRejected', () => this.rideRejected$.next());
    this.hubConnection.on('DriverArrived', () => this.driverArrived$.next());
    this.hubConnection.on('PinConfirmed', () => this.pinConfirmed$.next());
    this.hubConnection.on('RideCancelled', (data) => this.rideCancelled$.next(data));
    this.hubConnection.on('CancelError', (data) => this.cancelError$.next(data));
    this.hubConnection.on('RideCompleted', (data) => this.rideCompleted$.next(data));
    this.hubConnection.on('SeatsUpdated', (data) => this.seatsUpdated$.next(data));
  }
}