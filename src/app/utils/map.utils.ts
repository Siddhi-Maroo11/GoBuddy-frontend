import * as L from 'leaflet';

export function createPickupIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2.5px solid white;box-shadow:0 1px 5px rgba(34,197,94,0.6);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

export function createDropIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 2px 6px rgba(239,68,68,0.6);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function createDriverMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(124,58,237,0.12);"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#7c3aed;border:2.5px solid white;box-shadow:0 1px 6px rgba(124,58,237,0.5);"></div>
      </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function createSelfDriverIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:60px;height:60px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:60px;height:60px;border-radius:50%;background:rgba(124,58,237,0.15);"></div>
        <div style="position:absolute;width:36px;height:36px;border-radius:50%;background:rgba(124,58,237,0.25);"></div>
        <div style="position:absolute;width:16px;height:16px;border-radius:50%;background:#7c3aed;border:3px solid white;box-shadow:0 2px 8px rgba(124,58,237,0.6);"></div>
      </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 30],
  });
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}

export function appendCityIfNeeded(query: string, city: string): string {
  return query.toLowerCase().includes(city.toLowerCase()) ? query : `${query}, ${city}`;
}