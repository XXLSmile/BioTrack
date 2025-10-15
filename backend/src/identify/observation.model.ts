import mongoose, { Schema, Document } from 'mongoose';

export interface IObservation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  speciesId: mongoose.Types.ObjectId;
  imageUrl: string;
  latitude?: number;
  longitude?: number;
  confidence: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const observationSchema = new Schema<IObservation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    speciesId: {
      type: Schema.Types.ObjectId,
      ref: 'Species',
      required: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
observationSchema.index({ userId: 1, createdAt: -1 });
observationSchema.index({ speciesId: 1, createdAt: -1 });

export const ObservationModel = mongoose.model<IObservation>('Observation', observationSchema);

// Observation Repository
export class ObservationRepository {
  async create(data: {
    userId: string;
    speciesId: string;
    imageUrl: string;
    latitude?: number;
    longitude?: number;
    confidence: number;
    notes?: string;
  }): Promise<IObservation> {
    const observation = await ObservationModel.create(data);
    return observation;
  }

  async findByUserId(userId: string, limit: number = 50): Promise<IObservation[]> {
    return await ObservationModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('speciesId');
  }

  async countByUserId(userId: string): Promise<number> {
    return await ObservationModel.countDocuments({ userId });
  }

  async countUniqueSpeciesByUserId(userId: string): Promise<number> {
    const unique = await ObservationModel.distinct('speciesId', { userId });
    return unique.length;
  }
}

export const observationRepository = new ObservationRepository();

