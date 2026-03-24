import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.html',
  styleUrls: ['./map.scss'],
})
export class MapComponent implements AfterViewInit {
  private startMarker: any;
  private endMarker: any;
  private routeLayer: any;
  private map: any;
  async drawRoute() {
    const start = [75.70248, 26.92702];
    const end = [75.84606, 26.95354];
    if (this.startMarker) this.map.removeLayer(this.startMarker);
    if (this.endMarker) this.map.removeLayer(this.endMarker);
    if (this.routeLayer) this.map.removeLayer(this.routeLayer);
    const greenIcon = new L.Icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    const redIcon = new L.Icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    this.startMarker = L.marker([start[1], start[0]], { icon: greenIcon })
      .addTo(this.map)
      .bindPopup('Start Point');
    this.endMarker = L.marker([end[1], end[0]], { icon: redIcon })
      .addTo(this.map)
      .bindPopup('End Point');
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`,
    );
    const data = await response.json();
    const route = data.routes[0].geometry;
    this.routeLayer = L.geoJSON(route, {
      style: {
        color: 'blue',
        weight: 5,
      },
    }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds());
  }
  ngAfterViewInit(): void {
    this.map = L.map('map').setView([26.9124, 75.7873], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
    setTimeout(() => {
      this.map.invalidateSize();
    }, 0);
  }
}