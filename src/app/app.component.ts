import { Component } from "@angular/core";
import { PromptPayQrComponent } from "./promptpay-qr/promptpay-qr.component";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [PromptPayQrComponent, PromptPayQrComponent],
  template: `<app-promptpay-qr></app-promptpay-qr>`,
})
export class AppComponent {
  title = environment.appName;
  version = environment.version;
}
