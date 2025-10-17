import { Component } from "@angular/core";
import { QrPromptPayComponent } from "./qr-promptpay.component";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [QrPromptPayComponent],
  template: `<app-qr-promptpay></app-qr-promptpay>`,
})
export class AppComponent {
  title = environment.appName;
  version = environment.version;
}
