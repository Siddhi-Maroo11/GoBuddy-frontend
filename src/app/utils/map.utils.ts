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
      <div style="position:relative;width:40px;height:40px;">
        <div style="position:absolute;inset:0;border-radius:50%;
             background:rgba(124,58,237,0.15);"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;
             background:#fff;border:2px solid #7c3aed;
             display:flex;align-items:center;justify-content:center;
             box-shadow:0 2px 8px rgba(124,58,237,0.4);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#7c3aed">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 
                     12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 
                     0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 
                     13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 
                     1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}
export function appendCityIfNeeded(query: string, city: string): string {
  return query.toLowerCase().includes(city.toLowerCase()) ? query : `${query}, ${city}`;
}
