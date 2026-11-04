// Fails if any trailer number drifts from the approved sample grades. Run: node scripts/verify-numbers.mts
import assert from 'node:assert/strict';
import { SUBJECTS, TARGET, examAdds, examPercent, generalAverage, tasksAdds, termGrade, writtenAdds } from '../src/data.ts';
import { CUE, DURATION, check } from '../src/beats.ts';

const approved = { Math: 94.0, English: 96.5, Science: 95.2, Filipino: 94.8, AP: 93.7, ESP: 97.1, MAPEH: 96.3, TLE: 92.6 };
assert.deepEqual(Object.fromEntries(SUBJECTS.map((s) => [s.name, s.grade])), approved);
assert.equal(TARGET, 95);
assert.equal(generalAverage().toFixed(1), '95.0');
assert.equal(writtenAdds(), 38.4);
assert.equal(tasksAdds(), 37.6);
assert.equal(examPercent(45), 90);
assert.equal(examAdds(45), 18);
assert.equal(termGrade(45), 94);
assert.equal(examPercent(48), 96);
assert.equal(examAdds(48), 19.2);
assert.equal(termGrade(48), 95.2);
assert.ok(termGrade(47) < TARGET && termGrade(48) >= TARGET, '48 / 50 must be the lowest whole score that reaches the target');
assert.ok(SUBJECTS.every((s) => s.grade >= 75), 'no sample grade is below passing');
check();
assert.equal(DURATION, 1800);
assert.equal(CUE.drop / 30, 30);
console.log('All trailer numbers and cue points check out.');
