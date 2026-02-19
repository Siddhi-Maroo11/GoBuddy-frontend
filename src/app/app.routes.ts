import { Routes } from '@angular/router';
import { Login } from './components/auth/login/login';

export const routes: Routes = [
     { path: 'login', component: Login},
    { path: '**', redirectTo: 'login', pathMatch: 'full' }
];
