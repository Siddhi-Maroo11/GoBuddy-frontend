import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TestService } from './core/test';
import { SplashScreen } from './shared/splash-screen/splash-screen';
import { CommonModule } from '@angular/common';
import { LocationService } from './services/location';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SplashScreen],
  templateUrl: './app.html',
})
export class App implements OnInit {
  loading = true;

  constructor(
    private testService: TestService,
    private locationService: LocationService
  ) {}

  ngOnInit() {
    this.testService.getData().subscribe((result) => {
      console.log(result);
    });

    this.locationService.startTracking();
  }
}