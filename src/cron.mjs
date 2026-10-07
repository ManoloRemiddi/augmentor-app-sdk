// Copyright © 2026 Manolo Remiddi · SPDX-License-Identifier: LicenseRef-Augmentor-MIT-Resale-1.0
// Five-field cron (minute hour day-of-month month day-of-week) evaluated in an IANA time
// zone. Supports `*`, lists, ranges, steps and @hourly/@daily/@weekly/@monthly aliases.
import {check} from './errors.mjs';

const FIELDS = [['minute', 0, 59], ['hour', 0, 23], ['day', 1, 31], ['month', 1, 12], ['weekday', 0, 7]];
const ALL_MINUTES = new Set(Array.from({length: 60}, (_, i) => i)), ALL_HOURS = new Set(Array.from({length: 24}, (_, i) => i));
const ALIASES = {'@hourly': '0 * * * *', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@weekly': '0 0 * * 0', '@monthly': '0 0 1 * *', '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *'};

function field(text, [name, min, max]) {
  const values = new Set();
  for (const part of text.split(',')) {
    const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(part);
    check(m, 'INVALID_SCHEDULE', `Invalid cron ${name} "${part}"`);
    let lo = m[1] === '*' ? min : Number(m[2]), hi = m[1] === '*' ? max : m[3] !== undefined ? Number(m[3]) : m[4] ? max : lo;
    const step = m[4] ? Number(m[4]) : 1;
    check(lo >= min && hi <= max && lo <= hi && step >= 1, 'INVALID_SCHEDULE', `Cron ${name} out of range "${part}"`);
    for (let v = lo; v <= hi; v += step) values.add(name === 'weekday' && v === 7 ? 0 : v);
  }
  return values;
}

export function parseCron(expression) {
  check(typeof expression === 'string', 'INVALID_SCHEDULE', 'Cron expression must be a string');
  const text = ALIASES[expression.trim()] || expression.trim();
  const parts = text.split(/\s+/);
  check(parts.length === 5, 'INVALID_SCHEDULE', 'Cron expressions have five fields: minute hour day month weekday');
  const [minute, hour, day, month, weekday] = parts.map((p, i) => field(p, FIELDS[i]));
  return {expression: text, minute, hour, day, month, weekday, dayAny: parts[2] === '*', weekdayAny: parts[4] === '*'};
}

const formatters = new Map();
function zoned(date, timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    try {f = new Intl.DateTimeFormat('en-US', {timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short'});}
    catch {check(false, 'INVALID_SCHEDULE', `Unknown time zone ${timeZone}`);}
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(date).map(p => [p.type, p.value]));
  return {year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute,
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)};
}

function matches(cron, t) {
  if (!cron.minute.has(t.minute) || !cron.hour.has(t.hour) || !cron.month.has(t.month)) return false;
  // Standard cron: when both day fields are restricted, either may match.
  const day = cron.day.has(t.day), weekday = cron.weekday.has(t.weekday);
  return cron.dayAny && cron.weekdayAny ? true : cron.dayAny ? weekday : cron.weekdayAny ? day : day || weekday;
}

/** Next occurrence strictly after `after` (Date), evaluated in `timeZone`. */
export function nextRun(expression, {after = new Date(), timeZone = 'UTC'} = {}) {
  const cron = typeof expression === 'string' ? parseCron(expression) : expression;
  let time = Math.floor(after.getTime() / 60000) * 60000 + 60000;
  const limit = time + 366 * 24 * 3600 * 1000 * 4;
  while (time < limit) {
    const t = zoned(new Date(time), timeZone);
    // Skip to the next local hour when the day or hour cannot match. Hour steps stay exact
    // across daylight-saving changes, where days are 23 or 25 hours long.
    if (!cron.month.has(t.month) || !cron.hour.has(t.hour) || !matches({...cron, minute: ALL_MINUTES, hour: ALL_HOURS}, t)) {time += (60 - t.minute) * 60000; continue;}
    if (matches(cron, t)) return new Date(time);
    time += 60000;
  }
  check(false, 'INVALID_SCHEDULE', `Cron expression ${cron.expression} never fires`);
}

/** Most recent occurrence at or before `before` within `lookbackMs` (for catch-up). */
export function previousRun(expression, {before = new Date(), timeZone = 'UTC', lookbackMs = 48 * 3600 * 1000} = {}) {
  const cron = typeof expression === 'string' ? parseCron(expression) : expression;
  for (let time = Math.floor(before.getTime() / 60000) * 60000; time >= before.getTime() - lookbackMs; time -= 60000) {
    if (matches(cron, zoned(new Date(time), timeZone))) return new Date(time);
  }
  return null;
}

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone, for stable job keys. */
export function localDate(date, timeZone = 'UTC') {
  const t = zoned(date, timeZone);
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`;
}

/** True when `date` falls inside a daily quiet window such as {start: '22:00', end: '07:00'}. */
export function inQuietHours(date, {start, end, timeZone = 'UTC'}) {
  const t = zoned(date, timeZone), minutes = t.hour * 60 + t.minute;
  const toMinutes = s => {const m = /^(\d{1,2}):(\d{2})$/.exec(s); check(m && +m[1] < 24 && +m[2] < 60, 'INVALID_SCHEDULE', 'Quiet hours use HH:MM'); return +m[1] * 60 + +m[2];};
  const a = toMinutes(start), b = toMinutes(end);
  return a <= b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}
