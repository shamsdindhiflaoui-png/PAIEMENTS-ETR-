import test from 'node:test';
import assert from 'node:assert/strict';
import { canUserPerformTransition, generateOrderNumber, generateStructuredOrderNumber } from './workflowRules';

test('prevents depositing at bank if not validated by Contrôle de Gestion', () => {
  const result = canUserPerformTransition('TRANSMIS_CG', 'DEPOSE_BANQUE', 'AGENT_FINANCIER');
  assert.equal(result.allowed, false);
});

test('allows Contrôle de Gestion to validate order from TRANSMIS_CG', () => {
  const result = canUserPerformTransition('TRANSMIS_CG', 'VALIDE_CG', 'CONTROLE_GESTION');
  assert.equal(result.allowed, true);
});

test('prevents Agent Financier from validating order', () => {
  const result = canUserPerformTransition('TRANSMIS_CG', 'VALIDE_CG', 'AGENT_FINANCIER');
  assert.equal(result.allowed, false);
});

test('allows Agent Financier to deposit validated order to bank', () => {
  const result = canUserPerformTransition('VALIDE_CG', 'DEPOSE_BANQUE', 'AGENT_FINANCIER');
  assert.equal(result.allowed, true);
});

test('allows Administrator to perform transitions', () => {
  const result = canUserPerformTransition('VALIDE_CG', 'DEPOSE_BANQUE', 'ADMINISTRATEUR');
  assert.equal(result.allowed, true);
});

test('order number generator produces compliant 000 UTILISATEUR 000 ANNEE 0000 ORDRE format', () => {
  const { orderNumber, userPart, yearPart, seqPart } = generateStructuredOrderNumber('012', 2026, 41);
  assert.equal(userPart, '012');
  assert.equal(yearPart, '026');
  assert.equal(seqPart, '0042');
  assert.equal(orderNumber, '012-026-0042');
});
