import { Component, OnInit } from '@angular/core';
import { LocationService } from '../../../services/location';
import { SignalrService } from '../../../services/signalr';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './driver-dashboard.html',
  styleUrl: './driver-dashboard.scss',
})
export class DriverDashboard implements OnInit {

  constructor(
    private locationService: LocationService,
    private signalrService: SignalrService
  ) {}

  async ngOnInit() {

    console.log("Driver dashboard loaded");
    await this.signalrService.startConnection();
    this.locationService.startTracking();
    
  }
}