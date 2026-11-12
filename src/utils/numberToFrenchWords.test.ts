import test from 'node:test';
import assert from 'node:assert/strict';
import { numberToFrenchWords } from './numberToFrenchWords';

test('converts zero amount correctly', () => {
  assert.equal(numberToFrenchWords(0, 'EUR'), 'Zéro euro');
});

test('converts simple single digit integer', () => {
  assert.equal(numberToFrenchWords(1, 'EUR'), 'Un euro');
  assert.equal(numberToFrenchWords(5, 'EUR'), 'Cinq euros');
});

test('converts hundreds and thousands', () => {
  assert.equal(numberToFrenchWords(100, 'EUR'), 'Cent euros');
  assert.equal(numberToFrenchWords(200, 'EUR'), 'Deux cents euros');
  assert.equal(numberToFrenchWords(1000, 'EUR'), 'Mille euros');
  assert.equal(numberToFrenchWords(15420, 'EUR'), 'Quinze mille quatre cent vingt euros');
});

test('converts decimal amounts with cents', () => {
  const result = numberToFrenchWords(15420.50, 'EUR');
  assert.equal(result, 'Quinze mille quatre cent vingt euros et cinquante centimes');
});

test('converts other currencies like USD and TND', () => {
  assert.equal(numberToFrenchWords(25000, 'USD'), 'Vingt-cinq mille dollars américains');
  assert.equal(numberToFrenchWords(1500.500, 'TND'), 'Mille cinq cents dinars tunisiens et cinq cents millimes');
});
