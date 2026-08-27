import {
  validatePin,
  validatePinsMatch,
  validatePrice,
  validateQuantityField,
  validateCartQuantityAgainstStock,
  validateCustomerName,
  validateSizesList,
} from '@/utils/validation';

describe('validatePin', () => {
  it('accepts exactly 4 digits', () => {
    expect(validatePin('1234').valid).toBe(true);
  });
  it('rejects non-numeric input', () => {
    expect(validatePin('12a4').valid).toBe(false);
  });
  it('rejects fewer than 4 digits', () => {
    expect(validatePin('123').valid).toBe(false);
  });
  it('rejects more than 4 digits', () => {
    expect(validatePin('12345').valid).toBe(false);
  });
});

describe('validatePinsMatch', () => {
  it('passes when pins match', () => {
    expect(validatePinsMatch('1234', '1234').valid).toBe(true);
  });
  it('fails when pins differ', () => {
    expect(validatePinsMatch('1234', '4321').valid).toBe(false);
  });
});

describe('validatePrice', () => {
  it('accepts positive numbers', () => {
    expect(validatePrice('200').valid).toBe(true);
  });
  it('accepts zero', () => {
    expect(validatePrice('0').valid).toBe(true);
  });
  it('rejects negative numbers', () => {
    expect(validatePrice('-5').valid).toBe(false);
  });
  it('rejects non-numeric text', () => {
    expect(validatePrice('abc').valid).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validatePrice('').valid).toBe(false);
  });
});

describe('validateQuantityField', () => {
  it('accepts whole positive numbers', () => {
    expect(validateQuantityField('50').valid).toBe(true);
  });
  it('rejects negative numbers', () => {
    expect(validateQuantityField('-1').valid).toBe(false);
  });
  it('rejects decimals', () => {
    expect(validateQuantityField('5.5').valid).toBe(false);
  });
});

describe('validateCartQuantityAgainstStock', () => {
  it('rejects zero or negative requested quantity', () => {
    expect(validateCartQuantityAgainstStock(0, 10).valid).toBe(false);
    expect(validateCartQuantityAgainstStock(-2, 10).valid).toBe(false);
  });
  it('rejects quantity exceeding stock', () => {
    expect(validateCartQuantityAgainstStock(11, 10).valid).toBe(false);
  });
  it('accepts quantity exactly equal to stock', () => {
    expect(validateCartQuantityAgainstStock(10, 10).valid).toBe(true);
  });
  it('accepts quantity below stock', () => {
    expect(validateCartQuantityAgainstStock(5, 10).valid).toBe(true);
  });
});

describe('validateCustomerName', () => {
  it('rejects empty name', () => {
    expect(validateCustomerName('').valid).toBe(false);
    expect(validateCustomerName('   ').valid).toBe(false);
  });
  it('accepts a real name', () => {
    expect(validateCustomerName('Rahul Sharma').valid).toBe(true);
  });
});

describe('validateSizesList', () => {
  it('rejects an all-empty list', () => {
    expect(validateSizesList(['', '  ']).valid).toBe(false);
  });
  it('accepts at least one non-empty size', () => {
    expect(validateSizesList(['6', '', '8']).valid).toBe(true);
  });
});
