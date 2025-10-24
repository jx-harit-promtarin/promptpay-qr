import { Component, OnInit, ViewChild, ElementRef, HostListener } from "@angular/core";
import { FormBuilder, Validators, ReactiveFormsModule } from "@angular/forms";
import { PromptPayQrService, ProxyType } from "../services/promptpay-qr.service";
import { CommonModule } from "@angular/common";
import { QRCodeComponent } from "angularx-qrcode";
import { SecureStorageService } from "../services/secure-storage.service";
import { environment } from "../../environments/environment";

type SharePlatform = 'web' | 'android' | 'ios';

@Component({
  standalone: true,
  selector: "app-promptpay-qr",
  imports: [CommonModule, ReactiveFormsModule, QRCodeComponent],
  templateUrl: "./promptpay-qr.component.html",
  styleUrls: ["./promptpay-qr.component.css"],
})
export class PromptPayQrComponent implements OnInit {
  form = this.fb.group({
    proxyType: <ProxyType>"mobile",
    mobile: [""],
    citizenId: [""],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  payload = "";
  errorMsg = "";
  appVersion = environment.version;
  appName = environment.appName;
  showMoreActions = false;
  showShareModal = false;
  selectedSharePlatform: SharePlatform = 'web';
  toastMessage = '';
  showToast = false;

  @ViewChild('qrCodeElement') qrCodeElement!: ElementRef;

  constructor(private fb: FormBuilder, private promptPayQrService: PromptPayQrService, private secureStorage: SecureStorageService) { }

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
      const amount = Number.parseFloat(savedAmount);
      if (!Number.isNaN(amount)) {
        this.form.patchValue({ amount: amount });
      }
    }
  }

  rebuild(): void {
    this.errorMsg = "";
    this.payload = "";

    try {
      const proxyType = (this.form.value.proxyType ?? "mobile");
      const amount = Number(this.form.value.amount ?? 0);
      const idValue = proxyType === "mobile" ? this.form.value.mobile ?? "" : this.form.value.citizenId ?? "";

      // ตรวจสอบความยาวของข้อมูล
      if (proxyType === "mobile") {
        const mobileDigits = (idValue || "").replaceAll(/\D/g, "");
        if (mobileDigits.length < 10) {
          return; // ไม่สร้าง QR ถ้ายังไม่ครบ 10 ตัว
        } else {
          this.secureStorage.setSecureStorage("proxyType", "mobile");
          this.secureStorage.setSecureStorage("mobile", mobileDigits);
        }
      } else {
        const citizenDigits = (idValue || "").replaceAll(/\D/g, "");
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
        this.showToastMessage('ไม่พบ QR Code');
        return;
      }

      // Convert canvas to blob
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          this.showToastMessage('ไม่สามารถสร้างภาพ QR Code ได้');
          return;
        }

        try {
          // Check if Clipboard API is supported
          if (navigator.clipboard && globalThis.ClipboardItem) {
            await navigator.clipboard.write([
              new (globalThis as any).ClipboardItem({
                'image/png': blob
              })
            ]);
            this.showToastMessage('คัดลอก QR Code แล้ว');
          } else {
            // Fallback: create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `promptpay-qr-${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
            this.showToastMessage('ดาวน์โหลด QR Code แล้ว');
          }
        } catch (error) {
          console.error('Error copying to clipboard:', error);
          this.showToastMessage('ไม่สามารถคัดลอก QR Code ได้');
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error copying QR code:', error);
      this.showToastMessage('ไม่สามารถคัดลอก QR Code ได้');
    }
  }

  async shareQRCode(): Promise<void> {
    try {
      const canvas = this.qrCodeElement.nativeElement.querySelector('canvas');
      if (!canvas) {
        this.showToastMessage('ไม่พบ QR Code');
        return;
      }

      // Convert canvas to blob
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) {
          this.showToastMessage('ไม่สามารถสร้างภาพ QR Code ได้');
          return;
        }

        const amount = this.form.value.amount;

        const shareData = {
          title: 'PromptPay QR Code',
          text: `PromptPay QR Code - ${amount} บาท`,
          files: [new File([blob], 'promptpay-qr.png', { type: 'image/png' })]
        };

        // Check if Web Share API is supported
        if (navigator?.share && navigator?.canShare?.(shareData)) {
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
      this.showToastMessage('ไม่สามารถแชร์ QR Code ได้');
    }
  }

  private downloadQRCode(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `promptpay-qr-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(url);
    this.showToastMessage('ดาวน์โหลด QR Code แล้ว');
  }

  openModalShareApp(): void {
    // Open modal; on small screens it becomes fullscreen via CSS
    this.showShareModal = true;
    // Auto-detect platform to preselect tab
    // const ua = navigator?.userAgent || '';
    // if (/Android/i.test(ua)) {
    //   this.selectedSharePlatform = 'android';
    // } else if (/(iPhone|iPad|iPod)/i.test(ua)) {
    //   this.selectedSharePlatform = 'ios';
    // } else {
    //   this.selectedSharePlatform = 'web';
    // }

    this.selectedSharePlatform = 'web';
  }

  closeModalShareApp(): void {
    this.showShareModal = false;
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement)?.classList?.contains('modal-backdrop')) {
      this.closeModalShareApp();
    }
  }

  onModalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.closeModalShareApp();
  }

  setSharePlatform(p: SharePlatform): void {
    this.selectedSharePlatform = p;
  }

  shareAppSystem(platform?: SharePlatform): void {
    const url = globalThis?.location?.origin || document.location.origin;
    let text = `${this.appName} v${this.appVersion}`;
    switch (platform) {
      case 'web':
        text += ' - share this link';
        break;
      case 'android':
        text += ' - share this android app';
        break;
      case 'ios':
        text += ' - share this ios app';
        break;
      default:
        break;
    }

    const shareData: ShareData = { title: this.appName, text, url };

    if ((navigator as any)?.share) {
      (navigator as any).share(shareData)
        .then(() =>
          setTimeout(() => {
            this.closeModalShareApp();
          }, 1000)
        )
        .catch(() => {
          this.copyAppUrl();
        });
    } else {
      this.copyAppUrl();
    }
  }

  copyAppUrl(platform?: SharePlatform): void {
    let url = globalThis?.location?.origin || document.location.origin;
    let message = 'คัดลอกลิงก์แล้ว';

    switch (platform) {
      case 'web':
        // Use current app URL
        break;
      case 'android':
        url = (environment as any).playStoreUrl || url;
        message = 'คัดลอกลิงก์ Play Store แล้ว';
        break;
      case 'ios':
        url = (environment as any).appStoreUrl || url;
        message = 'คัดลอกลิงก์ App Store แล้ว';
        break;
      default:
        break;
    }

    (navigator.clipboard as any)?.writeText?.(url);
    this.showToastMessage(`${message}`);
    setTimeout(() => {
      this.closeModalShareApp();
    }, 1000);
  }

  toggleMoreActions(event: MouseEvent): void {
    event.stopPropagation();
    this.showMoreActions = !this.showMoreActions;
  }

  onMoreSelect(action: 'share' | 'version'): void {
    this.showMoreActions = false;
    if (action === 'share') {
      this.openModalShareApp();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showMoreActions) this.showMoreActions = false;
  }

  get isSmallScreen(): boolean {
    try {
      return !!globalThis?.matchMedia?.('(max-width: 600px)')?.matches;
    } catch {
      return false;
    }
  }

  private showToastMessage(message: string, duration = 3000): void {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, duration);
  }
}
