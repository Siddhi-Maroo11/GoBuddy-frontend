import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {

  const router = inject(Router);

  return next(request).pipe(
    catchError((error) => {

      if (error.status === 401) {
        console.log('Unauthorized! Redirecting...');
        localStorage.removeItem('token');
        router.navigate(['/login']);
      }

      console.error('HTTP Error:', error);

      return throwError(() => error);
    })
  );
};
