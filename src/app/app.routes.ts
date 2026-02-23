import { Routes } from '@angular/router';
import { Login } from './components/auth/login/login';
import { PassengerDashboard } from './components/passenger/passenger-dashboard/passenger-dashboard';
import { DriverDashboard } from './components/driver/driver-dashboard/driver-dashboard';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { loginGuard } from './guards/login-guard';

export const routes: Routes = [
    { path: 'login', component: Login , canActivate: [loginGuard] },
    {
        path: 'passenger',
        component: PassengerDashboard,
        canActivate: [authGuard, roleGuard],
        data: { role: 'Passenger' }
    },
    {
        path: 'driver',
        component: DriverDashboard,
        canActivate: [authGuard, roleGuard],
        data: { role: 'Driver' }
    },
    { path: '', redirectTo: 'landing', pathMatch: 'full' },
    { path: '**', redirectTo: 'login'}

import { Landing } from './components/landing/landing';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: '**', redirectTo: '' },
];

