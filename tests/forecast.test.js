import { describe, it, expect } from 'vitest';
import { calculateDemandForecast } from '@/lib/forecast/logic';

describe('Demand forecast', () => {
  it('UT-10: 90-day moving average predicts the next 30 days', () => {
    
    // 90 days x 3 units = 270 units sold
    // Average = 3 units per day
    // 30-day forecast = 90 units

    const records = Array.from(
      { length: 90 },
      () => ({
        quantity_sold: 3,
      })
    );

    const result = calculateDemandForecast(records);

    expect(result.totalSold).toBe(270);
    expect(result.predictedDemand).toBe(90);
    expect(result.insufficientData).toBe(false);
  });
});