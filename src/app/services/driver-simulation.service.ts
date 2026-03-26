import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SimulationStep {
  lat: number;
  lng: number;
}

const ARRIVAL_THRESHOLD_KM = 0.05; 

@Injectable({ providedIn: 'root' })
export class DriverSimulationService {
  private interval: any = null;
  public isRunning = false;
  public step$ = new Subject<SimulationStep>();
  public start(coords: [number, number][], durationMs: number, onComplete: () => void): void {
    this.stop();
    if (coords.length < 2) {
      onComplete();
      return;
    }

    const totalSteps = coords.length;
    const intervalMs = Math.max(100, durationMs / totalSteps);
    let step = 0;
    this.isRunning = true;

    this.interval = setInterval(() => {
      if (step >= totalSteps) {
        this.stop();
        const [lng, lat] = coords[totalSteps - 1];
        this.step$.next({ lat, lng });
        onComplete();
        return;
      }
      const [lng, lat] = coords[step];
      this.step$.next({ lat, lng });
      step++;
    }, intervalMs);
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
  }

  private distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dx = lat2 - lat1;
    const dy = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(dx * dx + dy * dy) * 111;
  }
}
