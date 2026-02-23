import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class Signup {
  @Output() closeEvent = new EventEmitter<void>();
  signupForm = new FormGroup({
    fullName: new FormControl(''),
    dob: new FormControl(''),
    email: new FormControl(''),
    password: new FormControl(''),
    isDriver: new FormControl(false),
    vehicleModel: new FormControl(''),
    vehicleNumber: new FormControl(''),
    licenseNumber: new FormControl(''),
  });
  onSubmit() {
    if (this.signupForm.valid) {
      console.log(this.signupForm.value);
    } else {
      this.signupForm.markAllAsTouched();
    }
  }
}
