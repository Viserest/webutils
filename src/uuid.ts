
export class Uuid {
  public readonly value: Uint8Array<ArrayBuffer>;

  private constructor(value: Uint8Array) {
    if (value.length !== 16) {
      throw new Error("Uuid must contain exactly 16 bytes");
    }

    this.value = new Uint8Array(value);
  }

  public static randomv4(): Uuid {
    const bytes = crypto.getRandomValues(new Uint8Array(16));

    // Uuid version 4
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;

    // RFC 4122 variant
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    return new Uuid(bytes);
  }

  public static fromBytes(bytes: Uint8Array): Uuid {
    if (bytes.length !== 16) {
      throw new Error("Uuid must contain exactly 16 bytes");
    }

    return new Uuid(bytes);
  }

  public static fromString(value: string): Uuid {
    const hex = value.replaceAll("-", "");

    if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
      throw new Error(`Invalid Uuid string: ${value}`);
    }

    return Uuid.fromHex(hex);
  }

  public static fromHex(value: string): Uuid {
    if (!/^[0-9a-fA-F]{32}$/.test(value)) {
      throw new Error("Uuid hex must contain exactly 32 hexadecimal characters");
		}

		const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }

    return new Uuid(bytes);
  }

  public toBytes(): Uint8Array {
    return Uint8Array.from(this.value);
  }

  public toString(): string {
    const hex = this.toHex();

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join("-");
  }

	public toHex(): string {
		return Array.from(this.value, b => b.toString(16).padStart(2, "0")).join("");
  }
}
