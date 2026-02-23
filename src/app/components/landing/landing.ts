import { Component } from '@angular/core';
import { Login } from '../auth/login/login';
import { CommonModule } from '@angular/common';
import { Signup } from '../auth/sign-up/sign-up';

@Component({
  selector: 'app-landing',
  imports: [Login, CommonModule, Signup],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  showLogin = false;
  showSignup = false;

  openLogin() {
    this.showLogin = true;
  }

  closeLogin() {
    this.showLogin = false;
  }

  openSignup() {
    this.showSignup = true;
  }

  closeSignup() {
    this.showSignup = false;
  }
}
