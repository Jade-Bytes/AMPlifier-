import { describe, expect, it } from 'vitest';
import { countTicks, crossing } from '../soundPlan';

describe('countTicks', () => {
  it('is silent when nothing changes', () => {
    expect(countTicks(86.4, 86.4, 900)).toEqual([]);
    expect(countTicks(1, 2, 0)).toEqual([]);
  });

  it('gives bigger changes more ticks, within 3–9', () => {
    const small = countTicks(85, 85.4, 900).length;
    const medium = countTicks(85, 90, 900).length;
    const large = countTicks(0, 86.4, 900).length;
    expect(small).toBeGreaterThanOrEqual(3);
    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThanOrEqual(medium);
    expect(large).toBeLessThanOrEqual(9);
  });

  it('rises in pitch for increases and falls for decreases', () => {
    const up = countTicks(85, 90, 900).map(tick => tick.rate);
    const down = countTicks(90, 85, 900).map(tick => tick.rate);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    expect(down).toEqual([...down].sort((a, b) => b - a));
    expect(up[up.length - 1]).toBeGreaterThan(up[0]);
  });

  it('follows the ease-out curve: ticks bunch early, spread late, and finish before the animation ends', () => {
    const ticks = countTicks(0, 90, 900);
    const gaps = ticks.slice(1).map((tick, index) => tick.at - ticks[index].at);
    expect(gaps[gaps.length - 1]).toBeGreaterThan(gaps[0]);
    expect(ticks[ticks.length - 1].at).toBeLessThan(900);
  });

  it('never schedules two ticks closer than an audible gap', () => {
    for (const [from, to, ms] of [[0, 100, 300], [0, 86, 900], [70, 71, 500]] as const) {
      const ticks = countTicks(from, to, ms);
      ticks.slice(1).forEach((tick, index) => expect(tick.at - ticks[index].at).toBeGreaterThanOrEqual(42));
    }
  });
});

describe('crossing', () => {
  it('reports reaching and dropping below a threshold', () => {
    expect(crossing(88.9, 90.1, 90)).toBe('up');
    expect(crossing(88, 90, 90)).toBe('up');
    expect(crossing(90.2, 89.9, 90)).toBe('down');
  });

  it('ignores movement on one side, and missing values', () => {
    expect(crossing(91, 95, 90)).toBeNull();
    expect(crossing(80, 85, 90)).toBeNull();
    expect(crossing(null, 95, 90)).toBeNull();
    expect(crossing(80, 95, null)).toBeNull();
  });
});
