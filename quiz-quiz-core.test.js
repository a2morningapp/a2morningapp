import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanFirebaseString,
  formatTime,
  normalizePhone,
  numericValue,
  parseQuizQuestion,
  parseQuizRecord,
} from './quiz-quiz-core.js';

test('parses native quiz question records and locates the marked answer', () => {
  assert.deepEqual(parseQuizQuestion('["2 + 2", "3", "4===true"]'), {
    question: '2 + 2',
    options: ['3', '4'],
    correctIndex: 1,
  });
});

test('orders quiz records by question number, not object key order', () => {
  const questions = parseQuizRecord({
    Q10: '["Last", "A===true", "B"]',
    Q2: '["Second", "A", "B===true"]',
    Q1: '["First", "A===true", "B"]',
    ignored: 'invalid',
  });
  assert.deepEqual(questions.map((question) => question.question), ['First', 'Second', 'Last']);
});

test('rejects quiz questions that do not mark a correct answer', () => {
  assert.throws(
    () => parseQuizQuestion('["Question", "Answer A", "Answer B"]'),
    /does not define/,
  );
});

test('handles Firebase string values and invalid numeric fallbacks', () => {
  assert.equal(cleanFirebaseString('"Player"'), 'Player');
  assert.equal(numericValue('25', 0), 25);
  assert.equal(numericValue(undefined, 12), 12);
  assert.equal(numericValue('unknown', 9), 9);
});

test('formats timer values and accepts only safe phone path segments', () => {
  assert.equal(formatTime(150), '2:30');
  assert.equal(formatTime(9), '9 Sec');
  assert.equal(normalizePhone('+919876543210'), '+919876543210');
  assert.equal(normalizePhone('123/../../Admin'), '');
});
