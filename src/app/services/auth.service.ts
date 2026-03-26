// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { environment } from '../../environments/environment';
// import { Observable } from 'rxjs';
// import { jwtDecode } from 'jwt-decode';

// @Injectable({ providedIn: 'root' })
// export class AuthService {
//   private apiUrl = `${environment.apiUrl}/Auth`;

//   private readonly USER_ID_KEY = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
//   private readonly NAME_KEY    = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
//   private readonly ROLE_KEY    = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

//   private readonly VEHICLE_MODEL_KEY  = 'VehicleModel';
//   private readonly USER_PIN_KEY       = 'UserPin';
//   private readonly AVAILABLE_SEATS_KEY = 'AvailableSeats';
//   private readonly RATE_PER_KM_KEY    = 'RatePerKm';
//   private readonly PHONE_KEY          = 'Phone';
//   private readonly VEHICLE_NO_KEY     = 'VehicleNo';

//   constructor(private http: HttpClient) {}

//   private decodeToken(): any | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     return jwtDecode(token);
//   }

//   login(data: any): Observable<any> {
//     return this.http.post(`${this.apiUrl}/login`, data);
//   }

//   signup(data: any): Observable<any> {
//     if (data instanceof FormData) {
//       return this.http.post(`${this.apiUrl}/register`, data);
//     }
//     return this.http.post(`${this.apiUrl}/register`, data, {
//       headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
//     });
//   }

//   getUserId(): string | null {
//     return this.decodeToken()?.[this.USER_ID_KEY] ?? null;
//   }

//   getUserName(): string | null {
//     return this.decodeToken()?.[this.NAME_KEY] ?? null;
//   }

//   getRole(): string | null {
//     return this.decodeToken()?.[this.ROLE_KEY] ?? null;
//   }

//   getVehicleModel(): string | null {
//     return this.decodeToken()?.[this.VEHICLE_MODEL_KEY] ?? null;
//   }

//   getUserPin(): string | null {
//     return this.decodeToken()?.[this.USER_PIN_KEY] ?? null;
//   }

//   getAvailableSeats(): number {
//     return parseInt(this.decodeToken()?.[this.AVAILABLE_SEATS_KEY] ?? '1', 10);
//   }

//   getRatePerKm(): number {
//     return parseFloat(this.decodeToken()?.[this.RATE_PER_KM_KEY] ?? '0');
//   }

//   getPhone(): string | null {
//     return this.decodeToken()?.[this.PHONE_KEY] ?? null;
//   }

//   getVehicleNo(): string | null {
//     return this.decodeToken()?.[this.VEHICLE_NO_KEY] ?? null;
//   }

//   isLoggedIn(): boolean {
//     return !!localStorage.getItem('token');
//   }

//   logout(): void {
//     localStorage.removeItem('token');
//   }
// }

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { API, JWT_KEYS } from '../constants/api.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}

  private getDecodedToken(): any | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return jwtDecode(token);
  }

  login(data: any): Observable<any> {
    return this.http.post(API.auth.login, data);
  }

  signup(data: any): Observable<any> {
    return this.http.post(API.auth.register, data);
  }

  getAvailableSeats(): number {
    const decoded = this.getDecodedToken();
    if (!decoded) return 1;
    return parseInt(decoded[JWT_KEYS.AVAILABLE_SEATS] ?? '1', 10);
  }

  getRatePerKm(): number {
    const decoded = this.getDecodedToken();
    if (!decoded) return 0;
    return parseFloat(decoded[JWT_KEYS.RATE_PER_KM] ?? '0');
  }

  getPhone(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.PHONE_KEY] ?? null : null;
  }

  getVehicleNo(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.VEHICLE_NO_KEY] ?? null : null;
  }

  getUserId(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.USER_ID] ?? null : null;
  }

  getUserName(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.NAME] ?? null : null;
  }

  getVehicleModel(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.VEHICLE] ?? null : null;
  }

  getRole(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.ROLE] ?? null : null;
  }

  getUserPin(): string | null {
    const decoded = this.getDecodedToken();
    return decoded ? decoded[JWT_KEYS.PIN] ?? null : null;
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');
  }
}