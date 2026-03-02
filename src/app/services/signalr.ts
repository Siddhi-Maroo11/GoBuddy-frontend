import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Injectable({
  providedIn: 'root'
})
export class SignalrService {

  private hubConnection!: signalR.HubConnection;
  private isConnected = false; 

  startConnection(): Promise<void> { 
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:44338/locationHub', {
        accessTokenFactory: () => localStorage.getItem('token') || ''
      })
      .withAutomaticReconnect()
      .build();

    return this.hubConnection.start()
      .then(() => {
        console.log('SignalR Connected');
        this.isConnected = true;
      })
      .catch(err => {
        console.log('SignalR Error:', err);
        throw err;
      });
  }

  sendLocation(latitude: number, longitude: number) {

    if (!this.isConnected) {
      console.log("SignalR not connected yet");
      return;
    }

    this.hubConnection.invoke("SendLocation", latitude, longitude)
      .catch(err => console.log(err));
  }

  receiveLocation() {
    this.hubConnection.on("ReceiveDriverLocation", (lat, lng) => {
      console.log("Live Location:", lat, lng);
    });
  }
}