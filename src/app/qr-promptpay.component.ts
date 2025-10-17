import { Component, OnInit, ViewChild, ElementRef } from "@angular/core";
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";
import { PromptPayQrService, ProxyType } from "./promptpay-qr.service";
import { CommonModule } from "@angular/common";
import { QRCodeComponent } from "angularx-qrcode";
import { SecureStorageService } from "./secure-storage.service";
import { environment } from "../environments/environment";

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
  appVersion = environment.version;
  appName = environment.appName;

  @ViewChild('qrCodeElement') qrCodeElement!: ElementRef;

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

  async copyQRCodeImage(): Promise<void> {
    try {
      const canvas = this.qrCodeElement.nativeElement.querySelector('canvas');
      if (!canvas) {
        alert('QR Code not found');
        return;
      }

      // Convert canvas to blob
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          alert('Failed to generate QR code image');
          return;
        }

        try {
          // Check if Clipboard API is supported
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new ClipboardItem({
                'image/png': blob
              })
            ]);
            alert('QR Code copied to clipboard!');
          } else {
            // Fallback: create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `promptpay-qr-${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
            alert('QR Code downloaded! (Clipboard not supported)');
          }
        } catch (error) {
          console.error('Error copying to clipboard:', error);
          alert('Failed to copy QR code to clipboard');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error copying QR code:', error);
      alert('Failed to copy QR code');
    }
  }

  async shareQRCode(): Promise<void> {
    try {
      const canvas = this.qrCodeElement.nativeElement.querySelector('canvas');
      if (!canvas) {
        alert('QR Code not found');
        return;
      }

      // Convert canvas to blob
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          alert('Failed to generate QR code image');
          return;
        }

        const proxyType = this.form.value.proxyType;
        const idValue = proxyType === "mobile" ? this.form.value.mobile : this.form.value.citizenId;
        const amount = this.form.value.amount;
        
        const shareData = {
          title: 'PromptPay QR Code',
          text: `PromptPay QR Code - ${amount} บาท`,
          files: [new File([blob], 'promptpay-qr.png', { type: 'image/png' })]
        };

        // Check if Web Share API is supported
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData);
          } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to download
            this.downloadQRCode(blob);
          }
        } else {
          // Fallback: create download link
          this.downloadQRCode(blob);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error sharing QR code:', error);
      alert('Failed to share QR code');
    }
  }

  private downloadQRCode(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `promptpay-qr-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
    alert('QR Code downloaded!');
  }
}
