export const FORECAST_HISTORY_DAYS = 90;
export const FORECAST_DAYS = 30;
export const MIN_SALES_RECORDS = 7;

// Simple moving-average forecast for the implementation checkpoint.
// We total sales in the 90-day history window, convert that to average
// daily demand, then estimate demand for the next 30 days.
export function calculateDemandForecast(
  records = [],
  { historyDays = FORECAST_HISTORY_DAYS, forecastDays = FORECAST_DAYS, minRecords = MIN_SALES_RECORDS } = {}
) {
  const totalSold = records.reduce((sum, row) => sum + Number(row.quantity_sold || 0), 0);
  const dailyAverage = historyDays > 0 ? totalSold / historyDays : 0;
  const predictedDemand = Math.max(0, Math.ceil(dailyAverage * forecastDays));

  return {
    totalSold,
    dailyAverage,
    predictedDemand,
    recordCount: records.length,
    insufficientData: records.length < minRecords,
    historyDays,
    forecastDays,
  };
}
