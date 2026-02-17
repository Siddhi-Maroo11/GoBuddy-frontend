import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TestService {

  constructor(private http: HttpClient) {}

  getData() {
    return this.http.get('https://jsonplaceholder.typicode.com/posts'); // This API is juts used for testing and learning.
  }
}
