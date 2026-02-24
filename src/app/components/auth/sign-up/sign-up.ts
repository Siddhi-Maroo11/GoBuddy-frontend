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
  FormControl,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  FormBuilder,
} from '@angular/forms';
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
      if (isNaN(dob.getTime())) return { invalidDob: true };
      const age = today.getFullYear() - dob.getFullYear();
      const is18 = age > minAge;
      return is18 ? null : { underAge: true };
    };
  }

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

  enableDriverFields() {
    this.signupForm
      .get('totalSeats')
      ?.setValidators([Validators.required, Validators.min(2), Validators.max(6)]);
    this.signupForm.get('vehicleModel')?.setValidators([Validators.required]);
    this.signupForm
      .get('vehicleNumber')
      ?.setValidators([
        Validators.required,
        Validators.pattern(/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/),
      ]);
    this.signupForm
      .get('licenseNumber')
      ?.setValidators([Validators.required, Validators.pattern(/^[A-Z0-9]{10,15}$/)]);
  }

  disableDriverFields() {
    this.signupForm.get('vehicleModel')?.clearValidators();
    this.signupForm.get('totalSeats')?.clearValidators();
    this.signupForm.get('vehicleNumber')?.clearValidators();
    this.signupForm.get('licenseNumber')?.clearValidators();
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
    if (this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      return;
    }
    console.log('final form ka data:', this.signupForm.value);
  }
  
  onFileSelect(event: any, controlName: string) {
    const files = event.target.files;
    if (controlName === 'licenseImage') {
      if (files.length === 1) {
        this.signupForm.get('licenseImage')?.setValue(files[0]);
        this.signupForm.get('licenseImage')?.setErrors(null);
      } else {
        this.signupForm.get('licenseImage')?.setErrors({ required: true });
      }
    }
    if (controlName === 'vehicleImages') {
      if (files.length === 2) {
        this.signupForm.get('vehicleImages')?.setValue(files);
        this.signupForm.get('vehicleImages')?.setErrors(null);
      } else {
        this.signupForm.get('vehicleImages')?.setErrors({ required: true });
      }
    }
  }
}
