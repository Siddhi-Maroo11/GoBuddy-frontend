import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { jwtDecode } from 'jwt-decode';
import { STRINGS } from '../../../constants/strings.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class Login {

  @Output() closeEvent = new EventEmitter<void>();
  showPassword = false;

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  });

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    const payload = {
      Email: this.loginForm.value.email ?? '',
      Password: this.loginForm.value.password ?? ''
    };

    this.authService.login(payload).subscribe({
      next: (res: any) => {
        if (res?.token) {
          localStorage.setItem('token', res.token);

          const decoded: any = jwtDecode(res.token);

          const role =
            decoded?.role ||
            decoded?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

          alert(STRINGS.LOGIN_SUCCESS);

          if (role === 'Passenger') {
            this.router.navigate(['/passenger']);
          }
          else if (role === 'Driver') {
            this.router.navigate(['/driver']);
          }
          else {
            this.router.navigate(['/']);
          }

        } else {
          console.warn(STRINGS.TOKEN_NOT_FOUND);
        }
      },
      error: (err: any) => {
        console.error('Login Error:', err);
        alert(STRINGS.INVALID_LOGIN);
      }
    });
  }
}