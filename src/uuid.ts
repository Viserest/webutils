
import { Err, Ok, type Result } from "./result";

export class Uuid {
  public readonly value: Uint8Array<ArrayBuffer>;

  /** Value MUST be 16 bytes long because this function doesn't check length. */
  private constructor(value: Uint8Array) {
    this.value = new Uint8Array(value);
  }

  /** Generates a random uuid with version code and RFC 4122 variant. */
  public static randomv4(): Uuid {
    const bytes = crypto.getRandomValues(new Uint8Array(16));

    // Uuid version 4
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;

    // RFC 4122 variant
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;

    return new Uuid(bytes);
  }

  /** Make a uuid from bytes. The value must be 16 bytes long. */
  public static fromBytes(value: Uint8Array): Result<Uuid> {
    if (value.length !== 16) {
      return Err("Uuid must contain exactly 16 bytes");
    }

    return Ok(new Uuid(value));
  }

  /** Make a uuid from string of hex separated by hyphens. Excluding all hyphens, the value must be 32 bytes long. */
  public static fromString(value: string): Result<Uuid> {
    const hex = value.replaceAll("-", "");

    if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
      return Err(`Invalid Uuid string: ${value}`);
    }

    return Uuid.fromHex(hex);
  }

  /** Make a uuid from string of hex. The value must be 32 bytes long. */
  public static fromHex(value: string): Result<Uuid> {
    if (!/^[0-9a-fA-F]{32}$/.test(value)) {
      return Err("Uuid hex must contain exactly 32 hexadecimal characters");
		}

		const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }

    return Ok(new Uuid(bytes));
  }

  /** Return uuid as byte array. */
  public toBytes(): Uint8Array {
    return Uint8Array.from(this.value);
  }

  /** Return uuid as string with hyphens. */
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

  /** Return uuid as string without hyphens. */
	public toHex(): string {
		return Array.from(this.value, b => b.toString(16).padStart(2, "0")).join("");
  }
}
