import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

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
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = `${environment.apiUrl}/Auth`;

  constructor(private http: HttpClient) {}

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, data);
  }

  signup(data: SignupRequest | FormData): Observable<AuthResponse> {

    if (data instanceof FormData) {
      return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data);
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    });
  }
}