import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  FormBuilder,
} from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class Signup {
  @Output() closeEvent = new EventEmitter<void>();
  signupForm: FormGroup;

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      dob: ['', [Validators.required, this.minimumAgeValidator(18)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],

      isDriver: [false],
      vehicleModel: [''],
      vehicleNumber: [''],
      licenseNumber: [''],
      licenseImage: [''],
      vehicleImages: [''],
    });

    this.signupForm.get('isDriver')?.valueChanges.subscribe((isDriver) => {
      if (isDriver) {
        this.enableDriverFields();
        this.signupForm.get('licenseImage')?.setValidators([Validators.required]);
        this.signupForm.get('vehicleImages')?.setValidators([Validators.required]);
      } else {
        this.disableDriverFields();
        this.signupForm.get('licenseImage')?.clearValidators();
        this.signupForm.get('vehicleImages')?.clearValidators();
        this.signupForm.get('licenseImage')?.reset();
        this.signupForm.get('vehicleImages')?.reset();
      }

      this.signupForm.get('licenseImage')?.updateValueAndValidity();
      this.signupForm.get('vehicleImages')?.updateValueAndValidity();
    });
  }

  minimumAgeValidator(minAge: number) {
    return (control: AbstractControl) => {
      const dob = new Date(control.value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      return age >= minAge ? null : { underAge: true };
    };
  }

  enableDriverFields() {
    this.signupForm.get('vehicleModel')?.setValidators([Validators.required]);
    this.signupForm.get('vehicleNumber')?.setValidators([Validators.required]);
    this.signupForm.get('licenseNumber')?.setValidators([Validators.required]);
  }

  disableDriverFields() {
    this.signupForm.get('vehicleModel')?.clearValidators();
    this.signupForm.get('vehicleNumber')?.clearValidators();
    this.signupForm.get('licenseNumber')?.clearValidators();
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const formValue = this.signupForm.value;

    if (!formValue.isDriver) {
      // ✅ Passenger payload dynamic, backend DTO compatible
      const payload = {
        Name: formValue.fullName,
        Email: formValue.email,
        Password: formValue.password,
        Dob: formValue.dob,
        Role: "Passenger",
      };

      this.authService.signup(payload).subscribe({
        next: () => {
          alert('Passenger Signup Successful');
          this.signupForm.reset();
        },
        error: (err) => console.error(err),
      });

      return;
    }

    // ✅ Driver payload with FormData for file uploads
    const formData = new FormData();
    formData.append('Name', formValue.fullName);
    formData.append('Email', formValue.email);
    formData.append('Password', formValue.password);
    formData.append('Dob', formValue.dob);
    formData.append('Role', 'Driver');

    // Driver-specific fields
    formData.append('VehicleModel', formValue.vehicleModel);
    formData.append('VehicleNumber', formValue.vehicleNumber);
    formData.append('LicenseNumber', formValue.licenseNumber);

    if (formValue.licenseImage) {
      formData.append('LicenseImage', formValue.licenseImage);
    }

    if (formValue.vehicleImages && formValue.vehicleImages.length) {
      for (let file of formValue.vehicleImages) {
        formData.append('VehicleImages', file);
      }
    }

    this.authService.signup(formData).subscribe({
      next: () => {
        alert('Driver Signup Successful');
        this.signupForm.reset();
      },
      error: (err) => console.error(err),
    });
  }

  onFileSelect(event: any, controlName: string) {
    const files = event.target.files;

    if (controlName === 'licenseImage') {
      this.signupForm.get('licenseImage')?.setValue(files[0]);
    }

    if (controlName === 'vehicleImages') {
      this.signupForm.get('vehicleImages')?.setValue(files);
    }
  }
}