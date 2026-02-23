import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem('token');

  if(!token) {
    router.navigate(['/login']);
    return false;
  }
  
  const payload = JSON.parse(atob(token.split('.')[1]));

  const userRole = payload.role;

  const expectedRole = route.data['role'];

  if (userRole === expectedRole) {
    return true;
  } else {
    router.navigate(['/']);
    return false;
  }
};
