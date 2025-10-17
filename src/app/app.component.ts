import { Component } from '@angular/core';
import { QrPromptPayComponent } from "./qr-promptpay.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [QrPromptPayComponent],
  template: `<app-qr-promptpay></app-qr-promptpay>`,
})
export class AppComponent {}
