import { Injectable } from '@angular/core';

@Injectable({
  providedIn: "root",
})
export class SecureStorageService {
  
  private readonly STORAGE_KEY = "promptpay_data";
  private readonly SECRET_KEY = "promptpay_secret_2024";

  constructor() {}

  private encrypt(text: string): string {
    try {
      // Simple encryption using btoa (Base64) with key mixing
      const keyedText = this.SECRET_KEY + text + this.SECRET_KEY;
      return btoa(keyedText);
    } catch {
      return text;
    }
  }

  private decrypt(encryptedText: string): string {
    try {
      const decoded = atob(encryptedText);
      const keyLength = this.SECRET_KEY.length;
      return decoded.slice(keyLength, -keyLength);
    } catch {
      return encryptedText;
    }
  }

  setSecureStorage(key: string, value: string): void {
    const encryptedKey = this.encrypt(key);
    const encryptedValue = this.encrypt(value);
    localStorage.setItem(encryptedKey, encryptedValue);
  }

  getSecureStorage(key: string): string | null {
    const encryptedKey = this.encrypt(key);
    const encryptedValue = localStorage.getItem(encryptedKey);
    if (encryptedValue) {
      return this.decrypt(encryptedValue);
    }
    return null;
  }
}
