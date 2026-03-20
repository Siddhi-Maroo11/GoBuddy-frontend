import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.getRole() === route.data['role']) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
