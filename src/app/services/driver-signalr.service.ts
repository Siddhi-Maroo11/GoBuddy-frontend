import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { API } from '../constants/api.constants';

export interface RideConfirmedEvent {
  rideId: string;
  passengerName: string;
  passengerConnectionId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  pickupName: string;
  dropName: string;
}

@Injectable({ providedIn: 'root' })
export class DriverSignalRService {
  private hubConnection!: signalR.HubConnection;

  public incomingRequest$ = new Subject<any>();
  public requestExpired$ = new Subject<void>();
  public rideConfirmed$ = new Subject<RideConfirmedEvent>();
  public driverArrived$ = new Subject<void>();
  public pinConfirmed$ = new Subject<void>();
  public pinError$ = new Subject<any>();
  public rideCancelled$ = new Subject<any>();
  public cancelError$ = new Subject<any>();
  public cannotGoOffline$ = new Subject<any>();
  public rideCompleted$ = new Subject<any>();

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
    this.hubConnection.on('IncomingRideRequest', (data) => this.incomingRequest$.next(data));
    this.hubConnection.on('RequestExpired', () => this.requestExpired$.next());
    this.hubConnection.on('RideConfirmed', (data) => this.rideConfirmed$.next(data));
    this.hubConnection.on('DriverArrived', () => this.driverArrived$.next());
    this.hubConnection.on('PinConfirmed', () => this.pinConfirmed$.next());
    this.hubConnection.on('PinError', (data) => this.pinError$.next(data));
    this.hubConnection.on('RideCancelled', (data) => this.rideCancelled$.next(data));
    this.hubConnection.on('CancelError', (data) => this.cancelError$.next(data));
    this.hubConnection.on('CannotGoOffline', (data) => this.cannotGoOffline$.next(data));
    this.hubConnection.on('RideCompleted', (data) => this.rideCompleted$.next(data));
  }
}
