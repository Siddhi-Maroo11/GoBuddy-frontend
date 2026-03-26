import { Routes } from '@angular/router';
import { Login } from './components/auth/login/login';
import { Signup } from './components/auth/sign-up/sign-up';
import { PassengerDashboard } from './components/passenger/passenger-dashboard/passenger-dashboard';
import { DriverDashboard } from './components/driver/driver-dashboard/driver-dashboard';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { loginGuard } from './guards/login-guard';
import { Landing } from './components/landing/landing';
import { MapComponent } from './components/map/map';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'signup', component: Signup, canActivate: [loginGuard] },
  { path: 'login', component: Login, canActivate: [loginGuard] },
  { path: 'map', component: MapComponent },
  {
    path: 'passenger',
    component: PassengerDashboard,
    canActivate: [authGuard, roleGuard],
    data: { role: 'Passenger' },
  },
  {
    path: 'driver',
    component: DriverDashboard,
    canActivate: [authGuard, roleGuard],
    data: { role: 'Driver' },
  },
  { path: '**', redirectTo: '' }

];