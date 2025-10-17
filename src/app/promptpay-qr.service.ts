import { Injectable } from '@angular/core';

export type ProxyType = 'mobile' | 'citizenId';

@Injectable({ providedIn: 'root' })
export class PromptPayQrService {
  private tlv(tag: string, value: string): string {
    const lenStr = value.length.toString().padStart(2, '0');
    return `${tag}${lenStr}${value}`;
  }

  private mobileToProxy(mobile: string): string {
    const digits = (mobile || '').replace(/\D/g, '');
    const trimmed = digits.startsWith('0') ? digits.slice(1) : digits;
    return `0066${trimmed}`;
  }

  private citizenIdToProxy(citizenId: string): string {
    const digits = (citizenId || '').replace(/\D/g, '');
    return digits;
  }

  private crc16ccitt(data: string): string {
    let crc = 0xFFFF;
    const poly = 0x1021;
    for (let i = 0; i < data.length; i++) {
      crc ^= (data.charCodeAt(i) & 0xff) << 8;
      for (let b = 0; b < 8; b++) {
        crc = (crc & 0x8000) ? ((crc << 1) & 0xffff) ^ poly : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  buildDynamicByProxy(proxyType: ProxyType, idValue: string, amount: number): string {
    // if (amount < 0) {
    //   throw new Error('จำนวนเงินต้องไม่น้อยกว่า 0 บาท');
    // }

    const pfi = this.tlv('00', '01');
    const poim = this.tlv('01', '12');

    let proxy: string;
    if (proxyType === 'mobile') {
      if (!idValue || idValue.trim() === "") {
        throw new Error("กรุณากรอกหมายเลขโทรศัพท์มือถือ");
      }
      proxy = this.mobileToProxy(idValue);
    } else {
      if (!idValue || idValue.trim() === "") {
        throw new Error("กรุณากรอกหมายเลขบัตรประชาชน");
      }
      const digits = idValue.replace(/\D/g, '');
      if (digits.length !== 13) throw new Error('Citizen ID ต้องมี 13 หลัก');
      proxy = this.citizenIdToProxy(digits);
    }

    const aid = this.tlv("00", "A000000677010111");
    // Subtag mapping per Thai PromptPay:
    // 01 = Mobile (0066 + number without leading 0)
    // 02 = Citizen ID (13 digits)
    const subTag = proxyType === "mobile" ? "01" : "02";
    const subProxy = this.tlv(subTag, proxy);
    const mai = this.tlv("29", `${aid}${subProxy}`);

    const mcc = this.tlv('52', '0000');
    const currency = this.tlv('53', '764');
    const amt = this.tlv('54', amount.toFixed(2));
    const country = this.tlv('58', 'TH');

    const partial = `${pfi}${poim}${mai}${mcc}${currency}${amt}${country}6304`;
    const crc = this.crc16ccitt(partial);
    return `${partial}${crc}`;
  }
}
