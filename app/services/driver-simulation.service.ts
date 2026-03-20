import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SimulationStep {
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class DriverSimulationService {
  private interval: any = null;

  public isRunning: boolean = false;
  public step$ = new Subject<SimulationStep>();

  public start(
    coords: [number, number][],
    durationMs: number,
    onComplete: () => void,
  ): void {
    this.stop();
    if (coords.length < 2) { onComplete(); return; }

    const totalSteps = coords.length;
    const intervalMs = durationMs / totalSteps;
    let step = 0;
    this.isRunning = true;

    this.interval = setInterval(() => {
      if (step >= totalSteps) {
        this.stop();
        const last = coords[totalSteps - 1];
        this.step$.next({ lat: last[1], lng: last[0] });
        onComplete();
        return;
      }
      const [lng, lat] = coords[step];
      this.step$.next({ lat, lng });
      step++;
    }, intervalMs);
  }

  public stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    this.isRunning = false;
  }
}