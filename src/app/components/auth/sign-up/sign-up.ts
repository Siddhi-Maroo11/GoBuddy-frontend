import intlTelInput from 'intl-tel-input';
import { Component, EventEmitter, Output, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  FormBuilder,
  FormGroup,
} from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class Signup implements AfterViewInit {
  @ViewChild('phoneInput') phoneInput!: ElementRef;
  @Output() closeEvent = new EventEmitter<void>();

  phoneInstance: any;
  showPassword = false;
  signupForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
  ) {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      dob: ['', [Validators.required, this.minimumAgeValidator(18)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', Validators.required],
      password: ['', [Validators.required, Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/)]],
      isDriver: [false],
      vehicleModel: [''],
      totalSeats: [''],
      vehicleNumber: [''],
      licenseNumber: [''],
      licenseImage: [''],
      vehicleImages: ['']
    });

    this.handleDriverToggle();
  }

  ngAfterViewInit() {
    this.phoneInstance = intlTelInput(this.phoneInput.nativeElement, {
      initialCountry: 'in',
      separateDialCode: true,
      countryOrder: ['in', 'us'],
      loadUtils: () => import('intl-tel-input/utils'),
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onlyNumbers(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }
  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private handleDriverToggle() {
    this.signupForm.get('isDriver')?.valueChanges.subscribe((isDriver) => {
      const driverFields = [
        'vehicleModel',
        'totalSeats',
        'vehicleNumber',
        'licenseNumber',
        'licenseImage',
        'vehicleImages',
      ];

      if (isDriver) {
        this.signupForm.get('vehicleModel')?.setValidators([Validators.required]);
        this.signupForm
          .get('totalSeats')
          ?.setValidators([Validators.required, Validators.min(2), Validators.max(6)]);
        this.signupForm
          .get('vehicleNumber')
          ?.setValidators([
            Validators.required,
            Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/),
          ]);

        this.signupForm
          .get('licenseNumber')
          ?.setValidators([Validators.required, Validators.pattern(/^[A-Z0-9]{10,15}$/)]);

        this.signupForm.get('licenseImage')?.setValidators([Validators.required]);
        this.signupForm.get('vehicleImages')?.setValidators([Validators.required]);
      } else {
        driverFields.forEach((field) => {
          this.signupForm.get(field)?.clearValidators();
          this.signupForm.get(field)?.reset();
        });
      }
      driverFields.forEach((field) => this.signupForm.get(field)?.updateValueAndValidity());
    });
  }

  minimumAgeValidator(minAge: number) {
    return (control: AbstractControl) => {
      const dob = new Date(control.value);
      const today = new Date();
      if (isNaN(dob.getTime())) return { invalidDob: true };

      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      return age >= minAge ? null : { underAge: true };
    };
  }

  private handleDriverToggle() {
    this.signupForm.get('isDriver')?.valueChanges.subscribe(isDriver => {

      const driverFields = ['vehicleModel', 'totalSeats', 'vehicleNumber', 'licenseNumber'];

      if (isDriver) {
        this.signupForm.get('vehicleModel')?.setValidators([Validators.required]);
        this.signupForm.get('totalSeats')?.setValidators([Validators.required, Validators.min(2), Validators.max(6)]);
        this.signupForm.get('vehicleNumber')?.setValidators([
          Validators.required,
          Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/)
        ]);
        this.signupForm.get('licenseNumber')?.setValidators([
          Validators.required,
          Validators.pattern(/^[A-Z0-9]{10,15}$/)
        ]);
      } else {
        driverFields.forEach(field => {
          this.signupForm.get(field)?.clearValidators();
          this.signupForm.get(field)?.reset();
        });
  trimFormValues() {
    Object.keys(this.signupForm.controls).forEach((key) => {
      const control = this.signupForm.get(key);
      if (typeof control?.value === 'string') {
        control.setValue(control.value.trim().replace(/\s+/g, ' '));
      }

      driverFields.forEach(field =>
        this.signupForm.get(field)?.updateValueAndValidity()
      );
    });
  }

  onFileSelect(event: any, controlName: string) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.signupForm.get(controlName)?.setValue(files);
    }
  }

  removeFile(controlName: string, inputElement: HTMLInputElement) {
    this.signupForm.get(controlName)?.reset();
    inputElement.value = '';
  }

  trimFormValues() {
    Object.keys(this.signupForm.controls).forEach(key => {
      const control = this.signupForm.get(key);
      if (typeof control?.value === 'string') {
        control.setValue(control.value.trim().replace(/\s+/g, ' '));
      }
    });
  }

  onSubmit() {

    if (!this.phoneInstance || !this.phoneInstance.isValidNumber()) {
      this.signupForm.get('mobile')?.setErrors({ invalid: true });
  onFileSelect(event: any, controlName: string) {
    const files = event.target.files;
    if (controlName === 'licenseImage' && files.length === 1) {
      this.signupForm.get(controlName)?.setValue(files[0]);
    }

    if (controlName === 'vehicleImages' && files.length === 2) {
      this.signupForm.get(controlName)?.setValue(files);
    }
  }

  onSubmit() {
    if (!this.phoneInstance || !this.phoneInstance.isValidNumber()) {
      this.signupForm.get('mobile')?.setErrors({ invalid: true });
      this.signupForm.markAllAsTouched();
      return;
    }

    this.trimFormValues();

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.trimFormValues();
    const formValue = this.signupForm.value;
    const dobIso = new Date(formValue.dob).toISOString();
    const formattedMobile = this.phoneInstance.getNumber();
    if (formValue.isDriver) {
      const formData = new FormData();
      formData.append('Name', formValue.fullName);
      formData.append('Phone', formattedMobile);
      formData.append('Email', formValue.email);
      formData.append('Password', formValue.password);
      formData.append('Dob', dobIso);
      formData.append('Role', 'Driver');
      formData.append('VehicleModel', formValue.vehicleModel);
      formData.append('VehicleNumber', formValue.vehicleNumber);
      formData.append('LicenseNumber', formValue.licenseNumber);
      formData.append('TotalSeats', formValue.totalSeats);

      if (formValue.licenseImage) {
        formData.append('LicenseImage', formValue.licenseImage);
      }

      if (formValue.vehicleImages?.length) {
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

    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }

    const payload = {
      Name: formValue.fullName,
      Phone: formattedMobile,
      Email: formValue.email,
      Password: formValue.password,
      Dob: dobIso,
      Role: formValue.isDriver ? 'Driver' : 'Passenger'
    };

    if (formValue.isDriver) {
      payload.VehicleModel = formValue.vehicleModel;
      payload.TotalSeats = formValue.totalSeats;
      payload.VehicleNumber = formValue.vehicleNumber;
      payload.LicenseNumber = formValue.licenseNumber;
    }

    this.authService.signup(payload).subscribe({
      next: () => {
        alert(`${payload.Role} Signup Successful`);
        this.signupForm.reset();
      },
      error: err => console.error(err),
    });
  }
}
      Role: 'Passenger',
      Dob: dobIso,
    };

    this.authService.signup(payload).subscribe({
      next: () => {
        alert('Passenger Signup Successful');
        this.signupForm.reset();
      },

      error: (err) => console.error(err),
    });
  }
}
