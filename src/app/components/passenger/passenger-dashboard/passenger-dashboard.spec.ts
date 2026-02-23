import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PassengerDashboard } from './passenger-dashboard';

describe('PassengerDashboard', () => {
  let component: PassengerDashboard;
  let fixture: ComponentFixture<PassengerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PassengerDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PassengerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
