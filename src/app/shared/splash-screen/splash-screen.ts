import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-splash-screen',
  imports: [CommonModule],
  templateUrl: './splash-screen.html',
  styleUrl: './splash-screen.scss',
})
export class SplashScreen implements OnInit {
  @Output() animationDone = new EventEmitter<void>();
  ngOnInit(): void {
    setTimeout(() => {
      this.animationDone.emit();
    }, 2500);
  }
}
