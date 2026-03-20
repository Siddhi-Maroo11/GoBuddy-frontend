import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const loginGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (localStorage.getItem('token')) {
    const role = authService.getRole();
    router.navigate([role === 'Driver' ? '/driver' : '/passenger']);
    return false;
  }
  return true;
};
