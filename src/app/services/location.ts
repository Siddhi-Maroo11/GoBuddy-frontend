import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  private lastLatitude: number | null = null;
  private lastLongitude: number | null = null;
  private lastSentTimestamp = 0;
  private readonly distanceThresholdMeters = 10;
  private readonly timeThresholdMs = 10000;
  private readonly apiUrl = 'http://localhost:5198/api/location';

  constructor(private http: HttpClient) {}

  startTracking() {
    if (!navigator.geolocation) return;

    navigator.geolocation.watchPosition(
      position => {
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

        if (movedDistanceMeters >= this.distanceThresholdMeters || elapsedTimeMs >= this.timeThresholdMs) {
          this.sendLocation(currentLatitude, currentLongitude);
          this.lastLatitude = currentLatitude;
          this.lastLongitude = currentLongitude;
          this.lastSentTimestamp = currentTimestamp;
        }
      }
    );
  }

  private sendLocation(latitude: number, longitude: number) {
    this.http.put(this.apiUrl, {
      latitude: latitude,
      longitude: longitude
    }).subscribe();
  }

  private calculateDistanceMeters(startLatitude: number, startLongitude: number, endLatitude: number, endLongitude: number): number {
    const earthRadiusKm = 6371;

    const latitudeDifferenceRadians = this.toRadians(endLatitude - startLatitude);
    const longitudeDifferenceRadians = this.toRadians(endLongitude - startLongitude);

    const haversineValue =
      Math.sin(latitudeDifferenceRadians / 2) * Math.sin(latitudeDifferenceRadians / 2) +
      Math.cos(this.toRadians(startLatitude)) *
      Math.cos(this.toRadians(endLatitude)) *
      Math.sin(longitudeDifferenceRadians / 2) *
      Math.sin(longitudeDifferenceRadians / 2);

    const angularDistance =
      2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));

    return earthRadiusKm * angularDistance * 1000;
  }

  private toRadians(value: number): number {
    return value * Math.PI / 180;
  }
}