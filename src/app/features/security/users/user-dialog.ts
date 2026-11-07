import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { type AppUser, UserApi } from '@api/security/user.api';
import { PhoneField } from '@shared/forms/phone-field/phone-field';
import { DialogFiles } from '@shared/forms/record-dialog/dialog-files';
import {
  RecordDialog,
  type RecordDialogData,
  RecordDialogFrame,
} from '@shared/forms/record-dialog/record-dialog';
import { EMAIL_PATTERN, requiredText } from '@shared/forms/validators';
import { formatDateTime } from '@shared/reference/date-time';
import { ImagePicker } from '@shared/ui/image-picker/image-picker';
import { StoredImage } from '@shared/ui/image-picker/stored-image';

const DEFAULT_PHOTO = '/images/profile.png';

export interface UserDialogData extends RecordDialogData<AppUser> {
  /**
   * The signed-in user's own profile (v21 header popup): email, employee id and Is Active
   * cannot be changed, and the last sign-in is shown.
   */
  readonly profile?: boolean;
}

/**
 * v21 user popup: profile photo, name, email, employee id, phone numbers and Is Active.
 * A new photo is uploaded when chosen, but the user record only changes on Update; the
 * photo it replaces (or one uploaded and then not used) is deleted afterwards, so
 * cancelling never leaves the record pointing at a deleted file (v21 deleted at once).
 * Also the user's own profile ({@link UserDialogData.profile}).
 */
@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, RecordDialogFrame, PhoneField, ImagePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <app-record-dialog-frame
        [title]="title"
        [isNew]="isNew"
        [readOnly]="readOnly"
        [saving]="saving() || uploading()"
      >
        <div class="user-layout">
          <div class="user-photo">
            <app-image-picker
              alt="Profile photo"
              removeLabel="Remove Photo"
              round
              [size]="220"
              [src]="photo.src()"
              [canChange]="!readOnly && !uploading()"
              [hasImage]="!!form.controls.ProfileImage.value"
              (picked)="uploadPhoto($event)"
              (removed)="removePhoto()"
            />
          </div>

          <div class="user-fields">
            @if (profile && (lastLogin || readOnly)) {
              <p class="user-profile-note">
                @if (lastLogin) {
                  <span>Last sign-in: {{ lastLogin }}</span>
                }
                @if (readOnly) {
                  <span>Ask an administrator to change your details.</span>
                }
              </p>
            }

            <div class="form-row">
              <div class="form-field">
                <label for="usr-first">First Name <span class="required">*</span></label>
                <input
                  id="usr-first"
                  type="text"
                  placeholder="Enter First Name"
                  formControlName="Firstname"
                />
                @if (showError('Firstname')) {
                  <span class="field-error">First Name is required.</span>
                }
              </div>
              <div class="form-field">
                <label for="usr-last">Last Name <span class="required">*</span></label>
                <input
                  id="usr-last"
                  type="text"
                  placeholder="Enter Last Name"
                  formControlName="Lastname"
                />
                @if (showError('Lastname')) {
                  <span class="field-error">Last Name is required.</span>
                }
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label for="usr-email">Email <span class="required">*</span></label>
                <input
                  id="usr-email"
                  type="email"
                  placeholder="Enter Email"
                  formControlName="UserEmail"
                />
                @if (showError('UserEmail')) {
                  <span class="field-error">
                    {{
                      form.controls.UserEmail.hasError('pattern')
                        ? 'Enter a valid email address.'
                        : 'Email is required.'
                    }}
                  </span>
                }
              </div>
              <div class="form-field">
                <label for="usr-employee">Employee ID</label>
                <input
                  id="usr-employee"
                  type="text"
                  placeholder="Enter Employee ID"
                  formControlName="EmployeeId"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label for="usr-phone">Phone Number</label>
                <app-phone-field
                  inputId="usr-phone"
                  label="Phone Number"
                  formControlName="PhoneNumber"
                />
                @if (showError('PhoneNumber')) {
                  <span class="field-error">Enter a valid phone number.</span>
                }
              </div>
              <div class="form-field">
                <label for="usr-mobile">Mobile Number <span class="required">*</span></label>
                <app-phone-field
                  inputId="usr-mobile"
                  label="Mobile Number"
                  formControlName="MobileNumber"
                />
                @if (showError('MobileNumber')) {
                  <span class="field-error">
                    {{
                      form.controls.MobileNumber.hasError('required')
                        ? 'Mobile Number is required.'
                        : 'Enter a valid mobile number.'
                    }}
                  </span>
                }
              </div>
            </div>

            <label class="switch-field">
              <span class="switch">
                <input type="checkbox" role="switch" formControlName="IsActive" />
                <span class="slider"></span>
              </span>
              Is Active?
            </label>
          </div>
        </div>
      </app-record-dialog-frame>
    </form>
  `,
  styles: `
    /* v21: round photo on the left, the fields in two columns beside it. */
    .user-layout {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 28px;
    }
    .user-photo {
      display: flex;
      flex: 0 0 auto;
      justify-content: center;
      margin: 0 auto;
    }
    .user-fields {
      flex: 1 1 440px;
      min-width: 0;
    }
    .user-fields .form-field {
      flex-basis: 200px;
    }
    .user-profile-note {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0 0 16px;
      color: #555;
    }
  `,
})
export class UserDialog extends RecordDialog<AppUser> {
  protected readonly source = inject(UserApi);
  protected readonly profile = inject<UserDialogData>(MAT_DIALOG_DATA).profile === true;
  protected readonly entityName = this.profile ? 'Profile' : 'User';

  private readonly record = this.data.record;
  /** The backend does not record sign-ins yet: it sends year 1 then, and nothing is shown. */
  protected readonly lastLogin = recorded(this.record?.LastLoginDateTime);
  private readonly storedPhoto = this.record?.ProfileImage || '';
  private readonly photoFiles = new DialogFiles('UserProfile', this.storedPhoto);

  protected readonly title = this.profile
    ? 'My Profile'
    : this.isNew
      ? 'Create New User'
      : this.readOnly
        ? 'View User'
        : 'Edit User';

  protected readonly uploading = signal(false);
  protected readonly photo = new StoredImage(DEFAULT_PHOTO);

  protected readonly form = new FormGroup({
    ProfileImage: new FormControl(this.storedPhoto, { nonNullable: true }),
    Firstname: new FormControl(this.record?.Firstname ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    Lastname: new FormControl(this.record?.Lastname ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    UserEmail: new FormControl(this.record?.UserEmail ?? '', {
      nonNullable: true,
      validators: [requiredText, Validators.pattern(EMAIL_PATTERN)],
    }),
    EmployeeId: new FormControl(this.record?.EmployeeId ?? '', { nonNullable: true }),
    PhoneNumber: new FormControl(this.record?.PhoneNumber ?? '', { nonNullable: true }),
    MobileNumber: new FormControl(this.record?.MobileNumber ?? '', {
      nonNullable: true,
      validators: requiredText,
    }),
    IsActive: new FormControl(this.record?.IsActive ?? true, { nonNullable: true }),
  });

  constructor() {
    super();
    void this.photo.load(this.storedPhoto);
    if (this.profile) {
      // v21: only an administrator changes these (Users screen).
      for (const control of [
        this.form.controls.UserEmail,
        this.form.controls.EmployeeId,
        this.form.controls.IsActive,
      ]) {
        control.disable();
      }
    }
  }

  protected async uploadPhoto(file: File): Promise<void> {
    if (this.readOnly || this.uploading()) return;
    this.uploading.set(true);
    try {
      this.setPhoto(await this.photoFiles.upload(file));
      this.photo.show(file);
    } catch {
      // The error interceptor has already told the user why.
    } finally {
      this.uploading.set(false);
    }
  }

  protected removePhoto(): void {
    if (this.readOnly) return;
    this.setPhoto('');
    this.photo.show(null);
  }

  protected toRecord(): AppUser {
    const value = this.form.getRawValue();
    const email = value.UserEmail.trim();
    return {
      // Keeps sign-in data and any other field this form does not show.
      ...(this.record ?? { IsDeleted: false, EmailConfirmed: true }),
      AspNetUserId: this.record?.AspNetUserId ?? 0,
      // v21: the user name is the email address.
      UserName: email,
      UserEmail: email,
      Firstname: value.Firstname.trim(),
      Lastname: value.Lastname.trim(),
      EmployeeId: value.EmployeeId.trim(),
      PhoneNumber: value.PhoneNumber,
      MobileNumber: value.MobileNumber,
      ProfileImage: value.ProfileImage,
      IsActive: value.IsActive,
      EmailConfirmed: true,
    };
  }

  /** Deletes the photo that was replaced or removed, and uploads that were not kept. */
  protected override afterSave(saved: AppUser): void {
    this.photoFiles.saved(saved.ProfileImage || this.form.controls.ProfileImage.value);
  }

  private setPhoto(path: string): void {
    const control = this.form.controls.ProfileImage;
    control.setValue(path);
    control.markAsDirty();
  }
}

function recorded(moment: string | undefined): string {
  return moment && Number(moment.slice(0, 4)) >= 2000 ? formatDateTime(moment) : '';
}
