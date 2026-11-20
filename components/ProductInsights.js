'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Feedback';
import { ACTIVITY_LABELS } from '@/lib/activity';
import { FORECAST_DAYS } from '@/lib/forecast/logic';

const WEEKS = 13;

// Groups 90 days of daily sales into weeks, newest week last.
function toWeeks(days) {
  const weeks = [];
  for (let end = days.length; end > 0 && weeks.length < WEEKS; end -= 7) {
    const slice = days.slice(Math.max(0, end - 7), end);
    weeks.unshift({
      start: slice[0].date,
      end: slice[slice.length - 1].date,
      quantity: slice.reduce((sum, d) => sum + d.quantity, 0),
    });
  }
  return weeks;
}

// A round number just above `n`, so the y-axis ticks look tidy.
function niceMax(n) {
  if (n <= 0) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / step) * step;
}

const shortDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : new Date(value).toLocaleDateString();
}

function SalesChart({ weeks, forecastPerWeek }) {
  const W = 640;
  const H = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(...weeks.map((w) => w.quantity), forecastPerWeek ?? 0));
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const slot = innerW / weeks.length;
  const barW = Math.max(6, slot * 0.62);
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];

  const total = weeks.reduce((s, w) => s + w.quantity, 0);
  const label = `Weekly sales for the last ${weeks.length} weeks, ${total} units in total`
    + (forecastPerWeek != null ? `; forecast about ${Math.round(forecastPerWeek)} per week.` : '.');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={pad.left - 8} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </text>
        </g>
      ))}

      {weeks.map((w, i) => {
        const x = pad.left + i * slot + (slot - barW) / 2;
        const h = Math.max(w.quantity > 0 ? 2 : 0, y(0) - y(w.quantity));
        return (
          <g key={w.start}>
            <rect x={x} y={y(0) - h} width={barW} height={h} rx="3"
              className={i === weeks.length - 1 ? 'chart-bar current' : 'chart-bar'}>
              <title>{`${shortDate(w.start)} – ${shortDate(w.end)}: ${w.quantity} sold`}</title>
            </rect>
            {(i % 3 === 0 || i === weeks.length - 1) && (
              <text x={x + barW / 2} y={H - 8} className="chart-axis" textAnchor="middle">{shortDate(w.start)}</text>
            )}
          </g>
        );
      })}

      {forecastPerWeek != null && (
        <g>
          <line x1={pad.left} x2={W - pad.right} y1={y(forecastPerWeek)} y2={y(forecastPerWeek)} className="chart-forecast" />
          <text x={W - pad.right} y={y(forecastPerWeek) - 6} className="chart-forecast-label" textAnchor="end">
            Forecast ≈ {Math.round(forecastPerWeek)}/week
          </text>
        </g>
      )}
    </svg>
  );
}

// Sales chart + history for one product (Edit Product screen).
// Bump refreshKey after a sale/waste/stock change to reload.
export default function ProductInsights({ productId, refreshKey }) {
  const toast = useToast();
  const [days, setDays] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [activity, setActivity] = useState({ items: [] });
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const [salesRes, forecastRes, activityRes] = await Promise.all([
      fetch(`/api/products/${productId}/sales`),
      fetch(`/api/forecasts/${productId}`),
      fetch(`/api/products/${productId}/activity`),
    ]);
    if (salesRes.ok) setDays(await salesRes.json());
    if (forecastRes.ok) setForecast(await forecastRes.json());
    if (activityRes.ok) setActivity(await activityRes.json());
  }, [productId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  async function updateForecast() {
    setUpdating(true);
    const res = await fetch(`/api/forecasts/${productId}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setUpdating(false);
    if (!res.ok) return toast(body.error || 'Could not update the forecast.', 'error');
    toast(`Forecast: ${body.predictedDemand} units over the next ${body.forecastDays} days.`);
    load();
  }

  const weeks = days ? toWeeks(days) : [];
  const forecastPerWeek = forecast?.predicted_demand != null ? (forecast.predicted_demand / FORECAST_DAYS) * 7 : null;
  const last7 = days?.slice(-7).reduce((s, d) => s + d.quantity, 0) ?? 0;
  const prev7 = days?.slice(-14, -7).reduce((s, d) => s + d.quantity, 0) ?? 0;
  const trend = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const total90 = days?.reduce((s, d) => s + d.quantity, 0) ?? 0;

  return (
    <div className="panel-grid insights">
      <section className="section-card">
        <div className="panel-head">
          <h2>Sales, last 13 weeks</h2>
          <button className="secondary small" onClick={updateForecast} disabled={updating}>
            {updating ? 'Updating…' : 'Update forecast'}
          </button>
        </div>
        <div className="mini-stats">
          <span><strong>{total90}</strong> sold in 90 days</span>
          <span>
            <strong>{last7}</strong> this week
            {trend != null && <em className={trend >= 0 ? 'up' : 'down'}> {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</em>}
          </span>
          {forecast?.predicted_demand != null && (
            <span><strong>{forecast.predicted_demand}</strong> forecast next {FORECAST_DAYS} days</span>
          )}
        </div>
        {days === null ? <p className="muted">Loading…</p>
          : total90 === 0 ? <p className="empty">No sales recorded yet. Use “Record a sale” above.</p>
          : <SalesChart weeks={weeks} forecastPerWeek={forecastPerWeek} />}
      </section>

      <section className="section-card">
        <h2>History</h2>
        {activity.unavailable && <p className="muted">{activity.unavailable}</p>}
        {!activity.unavailable && activity.items.length === 0 && <p className="empty">No changes recorded yet.</p>}
        <ul className="timeline">
          {activity.items.map((a) => (
            <li key={a.id}>
              <span className={`badge activity-${a.action}`}>{ACTIVITY_LABELS[a.action] ?? a.action}</span>
              <div className="body">
                <p>{a.detail}</p>
                <small>{a.actor_name} · {timeAgo(a.created_at)}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
