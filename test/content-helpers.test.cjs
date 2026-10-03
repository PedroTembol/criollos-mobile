const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./content-test-loader.cjs');
const { buildEventCalendarUrl } = require('../components/contentCalendar.ts');
const { contentActionTarget, contentMapTarget, safeExternalUrl, createContentActionRunner } = require('../components/contentActions.ts');
const { describeFeedState } = require('../components/feedState.ts');
const { validContentDate, contentDateRange, formatContentDate } = require('../components/contentDates.ts');
const calendar = (date, extra = {}) => new URL(buildEventCalendarUrl({ title: 'Evento criollo', date, ...extra }));

test('scraped midnight UTC remains all-day on the same day in every device timezone', () => {
  for (const timezone of ['UTC', 'America/Puerto_Rico', 'America/Los_Angeles', 'Asia/Tokyo']) {
    process.env.TZ = timezone;
    assert.equal(calendar('2026-10-03T00:00:00.000Z').searchParams.get('dates'), '20261003/20261004');
    assert.equal(calendar('2026-10-03').searchParams.get('ctz'), 'America/Puerto_Rico');
  }
});
test('all-day end is exclusive through month, year, and leap boundaries', () => {
  assert.equal(calendar('2028-02-29').searchParams.get('dates'), '20280229/20280301');
  assert.equal(calendar('2026-12-31').searchParams.get('dates'), '20261231/20270101');
});
test('explicit local times use Puerto Rico and never invent two-hour duration', () => {
  const url = calendar('2026-10-03T18:30:00');
  assert.equal(url.searchParams.get('dates'), '20261003T223000Z/20261003T223000Z');
  assert.match(url.searchParams.get('details'), /finalización no publicada/);
  assert.equal(calendar('2026-10-03T18:30:00-04:00', { endDate: '2026-10-03T19:15:00-04:00' }).searchParams.get('dates'), '20261003T223000Z/20261003T231500Z');
});
test('explicit datetime precision preserves a real midnight instant', () => {
  assert.equal(calendar('2026-10-03T00:00:00Z', { datePrecision: 'datetime' }).searchParams.get('dates'), '20261003T000000Z/20261003T000000Z');
});
test('invalid or missing calendar dates stay unavailable', () => {
  for (const date of [null, '', 'not a date', '2026-02-30', '2026-10-03T99:00:00Z']) assert.equal(buildEventCalendarUrl({ title: 'X', date }), null);
  assert.equal(buildEventCalendarUrl({ title: 'X', date: '2026-10-03T18:00:00Z', endDate: '2026-10-03T17:00:00Z' }), null);
});
test('deep-link date ranges accept actual YYYY-MM-DD days and reject invalid or reversed bounds', () => {
  assert.deepEqual(contentDateRange('2028-02-29', '2028-03-01'), { from: '2028-02-29', to: '2028-03-01', error: undefined });
  assert.equal(validContentDate(' 2026-10-03 '), '2026-10-03');
  for (const day of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-03T00:00:00Z', '10/03/2026']) {
    assert.equal(validContentDate(day), undefined);
    assert.match(contentDateRange(day).error, /YYYY-MM-DD/);
  }
  assert.match(contentDateRange('2026-10-04', '2026-10-03').error, /inicial/);
  assert.equal(contentDateRange('2026-10-03', '2026-10-03').error, undefined);
  assert.deepEqual(contentDateRange(undefined, '2026-10-03'), { from: undefined, to: '2026-10-03', error: undefined });
});
test('date-range labels preserve Puerto Rico calendar days on any device timezone', () => {
  for (const timezone of ['UTC', 'America/Puerto_Rico', 'America/Los_Angeles', 'Asia/Tokyo']) {
    process.env.TZ = timezone;
    assert.equal(formatContentDate('2026-10-03'), '03/10/2026');
    assert.equal(formatContentDate('2026-12-31'), '31/12/2026');
  }
});
test('recommendations route supported internal URLs and preserve filters', () => {
  assert.deepEqual(contentActionTarget('/gastronomia?category=Criolla&q=arroz'), { pathname: '/gastronomia', params: { category: 'Criolla', q: 'arroz' } });
  assert.deepEqual(contentActionTarget('/discovery'), { pathname: '/descubrir', params: {} });
  assert.deepEqual(contentActionTarget('/#trolley-board'), { pathname: '/', params: {} });
  assert.equal(contentActionTarget('https://example.com/eventos'), null);
  assert.equal(safeExternalUrl('javascript:alert(1)'), null);
  assert.equal(safeExternalUrl('https://username:secret@example.com'), null);
});
test('map target accepts zero coordinates and falls back to a useful location query', () => {
  assert.deepEqual(contentMapTarget({ title: 'X', lat: 0, lng: 0 }), { pathname: '/', params: { lat: '0', lng: '0' } });
  assert.deepEqual(contentMapTarget({ title: 'Evento', location: 'Teatro', lat: NaN, lng: 10 }), { pathname: '/', params: { q: 'Teatro' } });
});
test('action guard blocks double taps and in-flight actions, recovers after failure', async () => {
  let clock = 0; let calls = 0; let resolve;
  const run = createContentActionRunner(() => clock);
  const first = run(() => { calls++; return new Promise(r => { resolve = r; }); });
  clock = 1000;
  assert.equal(await run(() => calls++), false);
  resolve(); await first;
  clock = 2000;
  await assert.rejects(run(() => { throw new Error('offline'); }), /offline/);
  clock = 2001; assert.equal(await run(() => calls++), false);
  clock = 3000; assert.equal(await run(() => calls++), true);
  assert.equal(calls, 2);
});
test('fresh receipt does not disguise old, partial, or offline source data', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const old = describeFeedState({ metadata: { stale: true, lastSuccessAt: '2026-10-03T08:00:00Z', complete: false } }, now, false, now);
  assert.equal(old.stale, true); assert.equal(old.partial, true); assert.equal(old.minutes, 240);
  const partial = describeFeedState({ metadata: { complete: false } }, now, false, now);
  assert.match(partial.text, /parte del catálogo/);
  const cached = describeFeedState({ clientCache: { source: 'local-cache', cachedAt: '2026-10-03T10:00:00Z', ageMs: 7200000, networkError: 'offline' } }, now, false, now);
  assert.equal(cached.failed, true); assert.equal(cached.minutes, 120); assert.match(cached.text, /No pudimos actualizar/);
});
