import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { SpeciesModel, SpeciesRepository } from '../../../src/recognition/species.model';

describe('Mocked: SpeciesRepository', () => {
  let repository: SpeciesRepository;

  beforeEach(() => {
    repository = new SpeciesRepository();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Interface SpeciesRepository.findOrCreate
  test('returns existing species without creating duplicate', async () => {
    // API: SpeciesRepository.findOrCreate
    // Input: payload with inaturalistId 123 and scientific/common names
    // Expected status code: n/a (repository method), expectation is existing doc returned
    // Expected behavior: calls SpeciesModel.findOne once and skips SpeciesModel.create
    // Expected output: mocked existing species document
    const payload = {
      inaturalistId: 123,
      scientificName: 'Canis familiaris',
      commonName: 'Dog',
      rank: 'species',
      taxonomy: 'Animalia',
      wikipediaUrl: 'https://example.com/dog',
      imageUrl: 'https://example.com/dog.jpg',
    };

    const existingDoc = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
    };

    const findOneSpy = jest
      .spyOn(SpeciesModel, 'findOne')
      .mockResolvedValueOnce(existingDoc as any);
    const createSpy = jest.spyOn(SpeciesModel, 'create').mockResolvedValue(existingDoc as any);

    const result = await repository.findOrCreate(payload);

    expect(findOneSpy).toHaveBeenCalledWith({ inaturalistId: payload.inaturalistId });
    expect(createSpy).not.toHaveBeenCalled();
    expect(result).toBe(existingDoc);
  });

  // Interface SpeciesRepository.findOrCreate
  test('creates species when lookup misses', async () => {
    // API: SpeciesRepository.findOrCreate
    // Input: payload with inaturalistId 456
    // Expected status code: n/a (repository method), expectation is new doc created
    // Expected behavior: findOne returns null, repository delegates to SpeciesModel.create
    // Expected output: mocked newly created species document
    // Mock behavior: SpeciesModel.findOne resolves null, SpeciesModel.create resolves createdDoc
    const payload = {
      inaturalistId: 456,
      scientificName: 'Felis catus',
      commonName: 'Cat',
      rank: 'species',
    };

    const createdDoc = { _id: new mongoose.Types.ObjectId(), ...payload };

    jest.spyOn(SpeciesModel, 'findOne').mockResolvedValueOnce(null);
    const createSpy = jest.spyOn(SpeciesModel, 'create').mockResolvedValueOnce(createdDoc as any);

    const result = await repository.findOrCreate(payload);

    expect(createSpy).toHaveBeenCalledWith(payload);
    expect(result).toBe(createdDoc);
  });

  // Interface SpeciesRepository.findById
  test('delegates findById directly to SpeciesModel', async () => {
    // API: SpeciesRepository.findById
    // Input: stringified ObjectId
    // Expected status code: n/a (repository method), expectation is matching doc returned
    // Expected behavior: repository calls SpeciesModel.findById with provided id
    // Expected output: mocked species document
    const id = new mongoose.Types.ObjectId().toString();
    const doc = { _id: id, scientificName: 'Panthera leo', inaturalistId: 789, rank: 'species' };

    const findByIdSpy = jest.spyOn(SpeciesModel, 'findById').mockResolvedValueOnce(doc as any);

    const result = await repository.findById(id);

    expect(findByIdSpy).toHaveBeenCalledWith(id);
    expect(result).toBe(doc);
  });
});
