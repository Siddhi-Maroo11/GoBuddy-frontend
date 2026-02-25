import intlTelInput from 'intl-tel-input';
import {
  Component,
  EventEmitter,
  Output,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  FormBuilder,
} from '@angular/forms';
<<<<<<< HEAD
import { AuthService } from '../../../services/auth.service';

=======
>>>>>>> 82d4a52abbf4772b5156a7e97633798b23f675cb
@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './sign-up.html',
  styleUrls: ['./sign-up.scss'],
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
})
export class Signup implements AfterViewInit {
  @ViewChild('phoneInput') phoneInput!: ElementRef;
  phoneInstance: any;
  @Output() closeEvent = new EventEmitter<void>();
  showPassword: boolean = false;
  signupForm: FormGroup;
<<<<<<< HEAD

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      dob: ['', [Validators.required, this.minimumAgeValidator(18)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],

=======
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  ngAfterViewInit() {
    this.phoneInstance = intlTelInput(this.phoneInput.nativeElement, {
      initialCountry: 'in',
      separateDialCode: true,
      countryOrder: ['in', 'us'],
      loadUtils: () => import('intl-tel-input/utils'),
    });
  }
  onlyNumbers(event: KeyboardEvent) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
    }
  }
  constructor(private fb: FormBuilder) {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.pattern(/^[A-Za-z]+(?: [A-Za-z]+)*$/)]],
      dob: ['', [Validators.required, this.minimumAgeValidator(18)]],
      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/),
        ],
      ],
      mobile: ['', [Validators.required]],
      password: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/),
        ],
      ],
>>>>>>> 82d4a52abbf4772b5156a7e97633798b23f675cb
      isDriver: [false],
      vehicleModel: [''],
      totalSeats: [''],
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
      this.signupForm.get('totalSeats')?.updateValueAndValidity();
    });
    this.signupForm.get('mobile')?.valueChanges.subscribe(() => {
      if (this.phoneInstance) {
        const isValid = this.phoneInstance.isValidNumber();
        if (!isValid) {
          this.signupForm.get('mobile')?.setErrors({ invalid: true });
        } else {
          this.signupForm.get('mobile')?.setErrors(null);
        }
      }
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

<<<<<<< HEAD
=======
  trimFormValues() {
    Object.keys(this.signupForm.controls).forEach((key) => {
      let value = this.signupForm.get(key)?.value;
      if (typeof value === 'string') {
        value = value.trim().replace(/\s+/g, ' ');
        this.signupForm.get(key)?.setValue(value);
      }
    });
  }

  removeFile(controlName: string, inputElement: HTMLInputElement) {
    this.signupForm.get(controlName)?.reset();
    this.signupForm.get(controlName)?.markAsTouched();
    inputElement.value = '';
    if (controlName === 'licenseImage') {
      if (this.signupForm.get('isDriver')?.value) {
        this.signupForm.get(controlName)?.setErrors({ required: true });
      }
    }
    if (controlName === 'vehicleImages') {
      if (this.signupForm.get('isDriver')?.value) {
        this.signupForm.get(controlName)?.setErrors({ required: true });
      }
    }
  }

>>>>>>> 82d4a52abbf4772b5156a7e97633798b23f675cb
  enableDriverFields() {
    this.signupForm
      .get('totalSeats')
      ?.setValidators([Validators.required, Validators.min(2), Validators.max(6)]);
    this.signupForm.get('vehicleModel')?.setValidators([Validators.required]);
    this.signupForm.get('vehicleNumber')?.setValidators([Validators.required]);
    this.signupForm.get('licenseNumber')?.setValidators([Validators.required]);
  }

  disableDriverFields() {
    this.signupForm.get('vehicleModel')?.clearValidators();
    this.signupForm.get('totalSeats')?.clearValidators();
    this.signupForm.get('vehicleNumber')?.clearValidators();
    this.signupForm.get('licenseNumber')?.clearValidators();
<<<<<<< HEAD
  }

  onSubmit() {
=======
    this.signupForm.get('vehicleModel')?.reset();
    this.signupForm.get('totalSeats')?.reset();
    this.signupForm.get('vehicleNumber')?.reset();
    this.signupForm.get('licenseNumber')?.reset();
  }

  onSubmit() {
    if (!this.phoneInstance.isValidNumber()) {
      this.signupForm.get('mobile')?.setErrors({ invalid: true });
    }
    this.trimFormValues();
>>>>>>> 82d4a52abbf4772b5156a7e97633798b23f675cb
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
<<<<<<< HEAD

=======
  
>>>>>>> 82d4a52abbf4772b5156a7e97633798b23f675cb
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