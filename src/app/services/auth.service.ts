import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

interface LoginRequest {
  Email: string;
  Password: string;
}

interface SignupRequest {
  email: string;
  password: string;
  role: string;
}

interface AuthResponse {
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/Auth`;
  private readonly USER_ID_KEY =
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
  private readonly NAME_KEY = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';
  private readonly VEHICLE_KEY = 'VehicleModel';
  private readonly ROLE_KEY = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

  constructor(private http: HttpClient) {}

  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  signup(data: any): Observable<any> {
    if (data instanceof FormData) {
      return this.http.post(`${this.apiUrl}/register`, data);
    }
    return this.http.post(`${this.apiUrl}/register`, data, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });
  }

  getUserId(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded[this.USER_ID_KEY] ?? null;
  }

  getUserName(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded[this.NAME_KEY] ?? null;
  }

  getVehicleModel(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded[this.VEHICLE_KEY] ?? null;
  }
  getRole(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded[this.ROLE_KEY] ?? null;
  }
  private readonly PIN_KEY = 'UserPin';

  getUserPin(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const decoded: any = jwtDecode(token);
    return decoded[this.PIN_KEY] ?? null;
  }
  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  logout(): void {
    localStorage.removeItem('token');

  private apiUrl = `${environment.apiUrl}/Auth`;
}