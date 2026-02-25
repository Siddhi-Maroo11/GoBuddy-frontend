import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  constructor(
    private fb: FormBuilder,
    private router: Router,
  ) {}
  showPassword: boolean = false;
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  loginForm = new FormGroup({
    email: new FormControl(''),
    password: new FormControl(''),
  });
  @Output() closeEvent = new EventEmitter<void>();
  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    console.log('Login data:', this.loginForm.value);
    this.router.navigate(['/map']);
  }
}
