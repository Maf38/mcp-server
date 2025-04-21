import { validateContext } from '../validation';

describe('validateContext', () => {
  it('devrait valider un contexte valide', () => {
    const context = {
      key: 'test',
      value: 'value',
      metadata: { test: 'meta' }
    };
    const result = validateContext(context);
    expect(result.success).toBe(true);
  });

  it('devrait valider un contexte avec une valeur JSON', () => {
    const context = {
      key: 'test',
      value: JSON.stringify({ complex: 'value', array: [1, 2, 3] }),
      metadata: { test: 'meta' }
    };
    const result = validateContext(context);
    expect(result.success).toBe(true);
  });

  it('devrait valider un contexte avec des caractères spéciaux', () => {
    const context = {
      key: 'test-special',
      value: "Voici des caractères spéciaux : é à ç",
      metadata: { "clé-spéciale": "valeur" }
    };
    const result = validateContext(context);
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un contexte avec une valeur non sérialisable', () => {
    const context = {
      key: 'test',
      value: () => {}
    };
    const result = validateContext(context);
    expect(result.success).toBe(false);
  });

  it('devrait accepter des métadonnées avec des valeurs JSON valides', () => {
    const context = {
      key: 'test',
      value: 'value',
      metadata: {
        str: 'string',
        num: 123,
        bool: true,
        null: null,
        obj: { nested: 'value' },
        arr: [1, 2, 3]
      }
    };
    const result = validateContext(context);
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un contexte sans clé', () => {
    const context = {
      value: 'value'
    };
    const result = validateContext(context);
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un contexte avec une clé vide', () => {
    const context = {
      key: '',
      value: 'value'
    };
    const result = validateContext(context);
    expect(result.success).toBe(false);
  });

  it('devrait accepter un contexte avec des champs supplémentaires', () => {
    const context = {
      key: 'test',
      value: 'value',
      extra: 'field'
    };
    const result = validateContext(context);
    expect(result.success).toBe(true);
  });

  it('devrait gérer null ou undefined', () => {
    expect(validateContext(null).success).toBe(false);
    expect(validateContext(undefined).success).toBe(false);
  });
}); 