// import { Injectable } from '@angular/core';
// import { HttpClient } from '@angular/common/http';
// import { Observable } from 'rxjs';
// import { jwtDecode } from 'jwt-decode';
// import { API, JWT_KEYS } from '../constants/api.constants';

// @Injectable({
//   providedIn: 'root',
// })
// export class AuthService {
//   constructor(private http: HttpClient) {}

//   private getDecodedToken(): any | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     return jwtDecode(token);
//   }

//   login(data: any): Observable<any> {
//     return this.http.post(API.auth.login, data);
//   }

//   signup(data: any): Observable<any> {
//     return this.http.post(API.auth.register, data);
//   }

//   getAvailableSeats(): number {
//     const decoded = this.getDecodedToken();
//     if (!decoded) return 1;
//     return parseInt(decoded[JWT_KEYS.AVAILABLE_SEATS] ?? '1', 10);
//   }

//   getRatePerKm(): number {
//     const decoded = this.getDecodedToken();
//     if (!decoded) return 0;
//     return parseFloat(decoded[JWT_KEYS.RATE_PER_KM] ?? '0');
//   }

//   getUserId(): string | null {
//     const decoded = this.getDecodedToken();
//     return decoded ? decoded[JWT_KEYS.USER_ID] ?? null : null;
//   }

//   getUserName(): string | null {
//     const decoded = this.getDecodedToken();
//     return decoded ? decoded[JWT_KEYS.NAME] ?? null : null;
//   }

//   getVehicleModel(): string | null {
//     const decoded = this.getDecodedToken();
//     return decoded ? decoded[JWT_KEYS.VEHICLE] ?? null : null;
//   }

//   getRole(): string | null {
//     const decoded = this.getDecodedToken();
//     return decoded ? decoded[JWT_KEYS.ROLE] ?? null : null;
//   }

//   getUserPin(): string | null {
//     const decoded = this.getDecodedToken();
//     return decoded ? decoded[JWT_KEYS.PIN] ?? null : null;
//   }

//   isLoggedIn(): boolean {
//     return !!localStorage.getItem('token');
//   }

//   logout(): void {
//     localStorage.removeItem('token');
//   }
// }

// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders } from '@angular/common/http';
// import { environment } from '../../environments/environment';
// import { Observable } from 'rxjs';
// import { jwtDecode } from 'jwt-decode';
// import { API, JWT_KEYS } from '../constants/api.constants';

// @Injectable({
//   providedIn: 'root',
// })
// export class AuthService {
//   constructor(private http: HttpClient) {}
 
//   public getAvailableSeats(): number {
//     const token = localStorage.getItem('token');
//     if (!token) return 1;
//     const decoded: any = jwtDecode(token);
//     return parseInt(decoded[JWT_KEYS.AVAILABLE_SEATS] ?? '1', 10);
//   }
 
//   public getRatePerKm(): number {
//     const token = localStorage.getItem('token');
//     if (!token) return 0;
//     const decoded: any = jwtDecode(token);
//     return parseFloat(decoded[JWT_KEYS.RATE_PER_KM] ?? '0');
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
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded[JWT_KEYS.USER_ID] ?? null;
//   }
 
//   getUserName(): string | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded[JWT_KEYS.NAME] ?? null;
//   }
 
//   getVehicleModel(): string | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded[JWT_KEYS.VEHICLE] ?? null;
//   }
//   getRole(): string | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded[JWT_KEYS.ROLE] ?? null;
//   }
//   private readonly PIN_KEY = 'UserPin';
 
//   getUserPin(): string | null {
//     const token = localStorage.getItem('token');
//     if (!token) return null;
//     const decoded: any = jwtDecode(token);
//     return decoded[JWT_KEYS.PIN] ?? null;
//   }
//   isLoggedIn(): boolean {
//     return !!localStorage.getItem('token');
//   }
 
//   logout(): void {
//     localStorage.removeItem('token');
//   }
// }

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { API, JWT_KEYS } from '../constants/api.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly TOKEN_KEY = 'token';

  constructor(private readonly http: HttpClient) {}

  getAvailableSeats(): number {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return 1;

    const decoded: any = jwtDecode(token);
    return parseInt(decoded[JWT_KEYS.AVAILABLE_SEATS] ?? '1', 10);
  }

  getRatePerKm(): number {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return 0;

    const decoded: any = jwtDecode(token);
    return parseFloat(decoded[JWT_KEYS.RATE_PER_KM] ?? '0');
  }

  login(data: any): Observable<any> {
    return this.http.post(API.auth.login, data);
  }

  signup(data: any): Observable<any> {

    if (data instanceof FormData) {
      return this.http.post(API.auth.register, data);
    }

    return this.http.post(API.auth.register, data, {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      }),
    });
  }

  getUserId(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    return decoded[JWT_KEYS.USER_ID] ?? null;
  }

  getUserName(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    return decoded[JWT_KEYS.NAME] ?? null;
  }

  getVehicleModel(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    return decoded[JWT_KEYS.VEHICLE] ?? null;
  }

  getRole(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    return decoded[JWT_KEYS.ROLE] ?? null;
  }

  getUserPin(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (!token) return null;

    const decoded: any = jwtDecode(token);
    return decoded[JWT_KEYS.PIN] ?? null;
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }
}