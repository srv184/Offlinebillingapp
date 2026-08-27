import { ValidationResult } from '@/types';

export function validatePin(pin: string): ValidationResult {
  if (!/^\d{4}$/.test(pin)) {
    return { valid: false, message: 'PIN must be exactly 4 digits.' };
  }
  return { valid: true };
}

export function validatePinsMatch(pin: string, confirmPin: string): ValidationResult {
  if (pin !== confirmPin) {
    return { valid: false, message: 'PINs do not match.' };
  }
  return { valid: true };
}

export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Name cannot be empty.' };
  }
  return { valid: true };
}

export function validatePrice(priceText: string): ValidationResult {
  const value = Number(priceText);
  if (priceText.trim() === '' || Number.isNaN(value)) {
    return { valid: false, message: 'Price must be a number.' };
  }
  if (value < 0) {
    return { valid: false, message: 'Price cannot be negative.' };
  }
  return { valid: true };
}

export function validateQuantityField(qtyText: string): ValidationResult {
  const value = Number(qtyText);
  if (qtyText.trim() === '' || !Number.isInteger(value)) {
    return { valid: false, message: 'Quantity must be a whole number.' };
  }
  if (value < 0) {
    return { valid: false, message: 'Quantity cannot be negative.' };
  }
  return { valid: true };
}

export function validateArticleName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Article name cannot be empty.' };
  }
  return { valid: true };
}

export function validateSizesList(sizes: string[]): ValidationResult {
  const cleaned = sizes.map((s) => s.trim()).filter((s) => s.length > 0);
  if (cleaned.length === 0) {
    return { valid: false, message: 'Add at least one size (or "Free Size" if not applicable).' };
  }
  return { valid: true };
}

export function validateCartQuantityAgainstStock(
  requestedQty: number,
  availableQty: number
): ValidationResult {
  if (requestedQty <= 0) {
    return { valid: false, message: 'Quantity must be greater than zero.' };
  }
  if (requestedQty > availableQty) {
    return {
      valid: false,
      message: `Only ${availableQty} in stock -- cannot bill ${requestedQty}.`,
    };
  }
  return { valid: true };
}

export function validateCustomerName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: 'Customer name is required before generating a bill.' };
  }
  return { valid: true };
}
