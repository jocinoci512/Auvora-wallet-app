import { PriceAlertService } from './price-alert.service';

describe('PriceAlertService.shouldTrigger', () => {
  it('triggers above price', () => {
    expect(PriceAlertService.shouldTrigger('ABOVE_PRICE', 100, 120, null, null)).toBe(true);
    expect(PriceAlertService.shouldTrigger('ABOVE_PRICE', 100, 80, null, null)).toBe(false);
  });

  it('triggers below price', () => {
    expect(PriceAlertService.shouldTrigger('BELOW_PRICE', 100, 80, null, null)).toBe(true);
  });

  it('triggers percentage / daily movement', () => {
    expect(PriceAlertService.shouldTrigger('PERCENTAGE_MOVEMENT', 5, 100, 6, null)).toBe(true);
    expect(PriceAlertService.shouldTrigger('DAILY_MOVEMENT', 5, 100, 2, null)).toBe(false);
  });

  it('triggers volume spike', () => {
    expect(PriceAlertService.shouldTrigger('LARGE_VOLUME_MOVEMENT', 2, 100, null, 3)).toBe(true);
  });
});
