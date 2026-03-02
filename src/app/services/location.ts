import { Injectable } from '@angular/core';
import { SignalrService } from './signalr';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  private lastLatitude: number | null = null;
  private lastLongitude: number | null = null;
  private lastSentTimestamp = 0;

  private readonly distanceThresholdMeters = 10;
  private readonly timeThresholdMs = 10000;

  constructor(private signalrService: SignalrService) {}

  startTracking() {
    console.log("startTracking called");

    if (!navigator.geolocation) {
      console.log("Geolocation not supported");
      return;
    }

    navigator.geolocation.watchPosition(
      position => {

        console.log("GPS LAT:", position.coords.latitude);
        console.log("GPS LNG:", position.coords.longitude);

        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;
        const currentTimestamp = Date.now();

        if (this.lastLatitude === null || this.lastLongitude === null) {
          this.sendLocation(currentLatitude, currentLongitude);
          this.lastLatitude = currentLatitude;
          this.lastLongitude = currentLongitude;
          this.lastSentTimestamp = currentTimestamp;
          return;
        }

        const movedDistanceMeters = this.calculateDistanceMeters(
          this.lastLatitude,
          this.lastLongitude,
          currentLatitude,
          currentLongitude
        );

        const elapsedTimeMs = currentTimestamp - this.lastSentTimestamp;

        if (
          movedDistanceMeters >= this.distanceThresholdMeters ||
          elapsedTimeMs >= this.timeThresholdMs
        ) {
          this.sendLocation(currentLatitude, currentLongitude);
          this.lastLatitude = currentLatitude;
          this.lastLongitude = currentLongitude;
          this.lastSentTimestamp = currentTimestamp;
        }
      },
      error => {
        console.log("GPS ERROR:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  private sendLocation(latitude: number, longitude: number) {
    this.signalrService.sendLocation(latitude, longitude);
  }

  private calculateDistanceMeters(
    startLatitude: number,
    startLongitude: number,
    endLatitude: number,
    endLongitude: number
  ): number {

    const earthRadiusKm = 6371;

    const dLat = this.toRadians(endLatitude - startLatitude);
    const dLon = this.toRadians(endLongitude - startLongitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(startLatitude)) *
      Math.cos(this.toRadians(endLatitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c * 1000;
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }
}