import mongoose, { Schema, Document } from 'mongoose';

export interface ISpecies extends Document {
  _id: mongoose.Types.ObjectId;
  inaturalistId: number;
  scientificName: string;
  commonName?: string;
  rank: string;
  taxonomy?: string;
  wikipediaUrl?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const speciesSchema = new Schema<ISpecies>(
  {
    inaturalistId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    scientificName: {
      type: String,
      required: true,
      index: true,
    },
    commonName: {
      type: String,
      index: true,
    },
    rank: {
      type: String,
      required: true,
    },
    taxonomy: {
      type: String,
    },
    wikipediaUrl: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const SpeciesModel = mongoose.model<ISpecies>('Species', speciesSchema);

// Species Repository
export class SpeciesRepository {
  async findOrCreate(data: {
    inaturalistId: number;
    scientificName: string;
    commonName?: string;
    rank: string;
    taxonomy?: string;
    wikipediaUrl?: string;
    imageUrl?: string;
  }): Promise<ISpecies> {
    let species = await SpeciesModel.findOne({ inaturalistId: data.inaturalistId });
    
    if (!species) {
      species = await SpeciesModel.create(data);
    }
    
    return species;
  }

  async findById(id: string): Promise<ISpecies | null> {
    return await SpeciesModel.findById(id);
  }
}

export const speciesRepository = new SpeciesRepository();

