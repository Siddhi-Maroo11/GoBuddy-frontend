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

  // signup(data: any): Observable<any> {

  //   if (data instanceof FormData) {
  //     return this.http.post(API.auth.register, data);
  //   }

  //   return this.http.post(API.auth.register, data, {
  //     headers: new HttpHeaders({
  //       'Content-Type': 'application/json'
  //     }),
  //   });
  // }

signup(data: FormData): Observable<any> {
    return this.http.post(API.auth.register, data);
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