import { Component, OnInit } from "@angular/core";
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";
import { PromptPayQrService, ProxyType } from "./promptpay-qr.service";
import { CommonModule } from "@angular/common";
import { QRCodeComponent } from "angularx-qrcode";
import { SecureStorageService } from "./secure-storage.service";

@Component({
  standalone: true,
  selector: "app-qr-promptpay",
  imports: [CommonModule, ReactiveFormsModule, QRCodeComponent],
  templateUrl: "./qr-promptpay.component.html",
})
export class QrPromptPayComponent implements OnInit {
  form = this.fb.group({
    proxyType: <ProxyType>"mobile",
    mobile: [""],
    citizenId: [""],
    amount: [0.0, [Validators.required, Validators.min(0.01)]],
  });

  payload = "";
  errorMsg = "";

  constructor(private fb: FormBuilder, private promptPayQrService: PromptPayQrService, private secureStorage: SecureStorageService) {}

  ngOnInit(): void {
    // โหลดค่าเริ่มต้นจาก localStorage
    this.loadFromLocalStorage();

    this.rebuild();
    this.form.valueChanges.subscribe(() => this.rebuild());
  }

  private loadFromLocalStorage(): void {
    const savedProxyType = this.secureStorage.getSecureStorage("proxyType") as ProxyType;
    const savedMobile = this.secureStorage.getSecureStorage("mobile");
    const savedCitizenId = this.secureStorage.getSecureStorage("citizenId");
    const savedAmount = this.secureStorage.getSecureStorage("amount");

    if (savedProxyType) {
      this.form.patchValue({ proxyType: savedProxyType });
    }

    if (savedMobile) {
      this.form.patchValue({ mobile: savedMobile });
    }

    if (savedCitizenId) {
      this.form.patchValue({ citizenId: savedCitizenId });
    }

    if (savedAmount) {
      const amount = parseFloat(savedAmount);
      if (!isNaN(amount)) {
        this.form.patchValue({ amount: amount });
      }
    }
  }

  rebuild(): void {
    this.errorMsg = "";
    this.payload = "";

    try {
      const proxyType = (this.form.value.proxyType ?? "mobile") as ProxyType;
      const amount = Number(this.form.value.amount ?? 0);
      const idValue = proxyType === "mobile" ? this.form.value.mobile ?? "" : this.form.value.citizenId ?? "";

      // ตรวจสอบความยาวของข้อมูล
      if (proxyType === "mobile") {
        const mobileDigits = (idValue || "").replace(/\D/g, "");
        if (mobileDigits.length < 10) {
          return; // ไม่สร้าง QR ถ้ายังไม่ครบ 10 ตัว
        } else {
          this.secureStorage.setSecureStorage("proxyType", "mobile");
          this.secureStorage.setSecureStorage("mobile", mobileDigits);
        }
      } else {
        const citizenDigits = (idValue || "").replace(/\D/g, "");
        if (citizenDigits.length < 13) {
          return; // ไม่สร้าง QR ถ้ายังไม่ครบ 13 ตัว
        } else {
          this.secureStorage.setSecureStorage("proxyType", "citizenId");
          this.secureStorage.setSecureStorage("citizenId", citizenDigits);
        }
      }

      // บันทึกจำนวนเงินลง localStorage แบบเข้ารหัส
      this.secureStorage.setSecureStorage("amount", amount.toString());

      this.payload = this.promptPayQrService.buildDynamicByProxy(proxyType, idValue, amount);
    } catch (e: any) {
      this.payload = "";
      this.errorMsg = e?.message || "Invalid input";
    }
  }

  copyPayload(): void {
    if (this.payload) navigator.clipboard.writeText(this.payload);
  }
}
