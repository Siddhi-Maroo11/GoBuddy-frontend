import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss'], 
})
export class Login {
  constructor(private authService: AuthService, private router: Router) {}
  @Output() closeEvent = new EventEmitter<void>();
  showPassword: boolean = false;
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  loginForm = new FormGroup({
    email: new FormControl(''),
    password: new FormControl(''),
  });

  onSubmit() {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (res: any) => {
          console.log('Login Success:', res);

          if (res.token) {
              localStorage.setItem('token', res.token);
              console.log('Token safely stored:', localStorage.getItem('token'));

              alert('Login Successful');
          } else {
            console.warn('Token not found in response!');
          }
        },
        error: (err: any) => {
          console.log('Login Error:', err);
          alert('Invalid Email or Password');
        }
      });
    }
  }
}