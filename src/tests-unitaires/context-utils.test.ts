import { validateContext, serializeMetadata, parseMetadata } from '../utils/context-utils';

describe('Context Utilities', () => {
  // Test de la validation du contexte
  describe('validateContext', () => {
    it('devrait valider un contexte correct', () => {
      const validContext = {
        key: 'test-key',
        value: 'test-value',
        metadata: { type: 'test' }
      };

      expect(() => validateContext(validContext)).not.toThrow();
      expect(validateContext(validContext)).toEqual(validContext);
    });

    it('devrait accepter un contexte sans metadata', () => {
      const contextWithoutMetadata = {
        key: 'test-key',
        value: 'test-value'
      };

      expect(() => validateContext(contextWithoutMetadata)).not.toThrow();
    });

    it('devrait rejeter un contexte sans clé', () => {
      const invalidContext = {
        value: 'test-value'
      };

      expect(() => validateContext(invalidContext)).toThrow();
    });
  });

  // Test de la sérialisation des métadonnées
  describe('serializeMetadata', () => {
    it('devrait sérialiser des métadonnées valides', () => {
      const metadata = { type: 'test', count: 42 };
      expect(serializeMetadata(metadata)).toBe('{"type":"test","count":42}');
    });

    it('devrait retourner {} pour des métadonnées undefined', () => {
      expect(serializeMetadata(undefined)).toBe('{}');
    });
  });

  // Test du parsing des métadonnées
  describe('parseMetadata', () => {
    it('devrait parser des métadonnées valides', () => {
      const metadataStr = '{"type":"test","count":42}';
      expect(parseMetadata(metadataStr)).toEqual({
        type: 'test',
        count: 42
      });
    });

    it('devrait retourner un objet vide pour une chaîne invalide', () => {
      expect(parseMetadata('invalid json')).toEqual({});
    });

    it('devrait retourner un objet vide pour une chaîne vide', () => {
      expect(parseMetadata('')).toEqual({});
    });
  });
});
