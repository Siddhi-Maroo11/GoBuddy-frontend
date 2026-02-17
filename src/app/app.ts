import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TestService } from './core/test'

@Component({
  selector: 'app-root',
  standalone: true,
  imports:[RouterOutlet],
  templateUrl: './app.html'
})
export class App {

      constructor(private testService: TestService) {
         this.testService.getData().subscribe(result => {
           console.log(result);
    });
  }
}
