import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const loginGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem('token');
  
   if (token) {

    const payload = JSON.parse(atob(token.split('.')[1]));
    const role = payload.role;

    if (role === 'Driver') {
      router.navigate(['/driver']);
    } else {
      router.navigate(['/passenger']);
    }

    return false;
  }

  return true;
};
