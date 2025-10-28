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
  isLoading = false;
  combinedQRImageDataUrl = '';

  @ViewChild('qrCodeElement') qrCodeElement!: ElementRef;

  constructor(private fb: FormBuilder, private promptPayQrService: PromptPayQrService, private secureStorage: SecureStorageService) { }

  ngOnInit(): void {
    // โหลดค่าเริ่มต้นจาก localStorage
    this.loadFromLocalStorage();

    this.rebuildQRCode();
    this.form.valueChanges.subscribe(() => this.rebuildQRCode());
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

  rebuildQRCode(): void {
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
      
      // สร้างรูป QR code พร้อมข้อความ
      setTimeout(() => this.generateCombinedQRImage(), 100);
    } catch (e: any) {
      this.payload = "";
      this.errorMsg = e?.message || "Invalid input";
      this.combinedQRImageDataUrl = '';
    }
  }

  private generateCombinedQRImage(): void {
    const qrCanvas = this.qrCodeElement?.nativeElement?.querySelector('canvas');
    if (!qrCanvas || !this.payload) return;

    const proxyType = this.form.value.proxyType ?? "mobile";
    const amount = Number(this.form.value.amount ?? 0);
    const idValue = proxyType === "mobile" ? this.form.value.mobile ?? "" : this.form.value.citizenId ?? "";

    // สร้าง canvas ใหม่สำหรับรูปแบบรวม
    const combinedCanvas = document.createElement('canvas');
    const ctx = combinedCanvas.getContext('2d');
    if (!ctx) return;

    const qrSize = 256;
    const textHeight = 80;
    const padding = 20;
    
    combinedCanvas.width = qrSize + (padding * 2);
    combinedCanvas.height = qrSize + textHeight + (padding * 2);

    // ตั้งค่าพื้นหลังสีขาว
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

    // วาด QR code
    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize);

    // ตั้งค่าฟอนต์และสี
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.font = '14px Arial, sans-serif';

    const centerX = combinedCanvas.width / 2;
    const textStartY = qrSize + padding + 20;

    // เขียนข้อความ
    const typeText = 'พร้อมเพย์';
    ctx.fillText(`${typeText}: ${idValue}`, centerX, textStartY);
    ctx.fillText(`จำนวนเงิน: ${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`, centerX, textStartY + 20);

    // บันทึกเป็น data URL
    this.combinedQRImageDataUrl = combinedCanvas.toDataURL('image/png');
  }

  // Copy & Share QR Code Image
  async copyQRCodeImage(): Promise<void> {
    this.isLoading = true;
    try {
      if (!this.combinedQRImageDataUrl) {
        this.showToastMessage('ไม่พบ QR Code');
        this.isLoading = false;
        return;
      }

      // Convert data URL to blob
      const response = await fetch(this.combinedQRImageDataUrl);
      const blob = await response.blob();

      if (!blob) {
        this.showToastMessage('ไม่สามารถสร้างภาพ QR Code ได้');
        this.isLoading = false;
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
      } finally {
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Error copying QR code:', error);
      this.showToastMessage('ไม่สามารถคัดลอก QR Code ได้');
      this.isLoading = false;
    }
  }
  async shareQRCode(): Promise<void> {
    this.isLoading = true;
    try {
      if (!this.combinedQRImageDataUrl) {
        this.showToastMessage('ไม่พบ QR Code');
        this.isLoading = false;
        return;
      }

      // Convert data URL to blob
      const response = await fetch(this.combinedQRImageDataUrl);
      const blob = await response.blob();

      if (!blob) {
        this.showToastMessage('ไม่สามารถสร้างภาพ QR Code ได้');
        this.isLoading = false;
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
        } finally {
          this.isLoading = false;
        }
      } else {
        // Fallback: create download link
        this.downloadQRCode(blob);
        this.isLoading = false;
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      this.showToastMessage('ไม่สามารถแชร์ QR Code ได้');
      this.isLoading = false;
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

  // Share App
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
        text += ' - Share Web App';
        break;
      case 'android':
        text += ' - Share Android App';
        break;
      case 'ios':
        text += ' - Share iOS App';
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

  // Show Toast Message
  private showToastMessage(message: string, duration = 3000): void {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, duration);
  }
}
