import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
})
export class Login {
  @Output() closeEvent = new EventEmitter<void>();
  showPassword = false;

  loginForm = new FormGroup({
    email: new FormControl(''),
    password: new FormControl(''),
  });

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onSubmit() {
    if (!this.loginForm.valid) return;

    const payload = {
      Email: this.loginForm.value.email,
      Password: this.loginForm.value.password,
    };

    this.authService.login(payload).subscribe({
      next: (res: any) => {
        if (res?.token) {
          localStorage.setItem('token', res.token);
          const decoded: any = jwtDecode(res.token);
          console.log('Full decoded:', decoded);

          const role = this.authService.getRole();
          console.log('Role:', role);
          if (role === 'Passenger') {
            this.router.navigate(['/passenger']);
          } else if (role === 'Driver') {
            this.router.navigate(['/driver']);
          } else {
            this.router.navigate(['/']);
          }
        }
      },
      error: (err: any) => {
        console.log('Login Error:', err);
        alert('Invalid Email or Password');
      },
    });
  }
}
