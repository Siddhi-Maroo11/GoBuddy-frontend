import { AbstractControl, ValidationErrors } from '@angular/forms';

export const REGEX = {
  fullName: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
  password: /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/,
  vehicleNumber: /^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/,
  licenseNumber: /^[A-Z0-9]{10,15}$/,
} as const;

export function minimumAgeValidator(minAge: number) {
  return (control: AbstractControl): ValidationErrors | null => {
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