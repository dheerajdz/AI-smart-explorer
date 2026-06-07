import mongoose, { Schema, Document } from 'mongoose';
import { ReputationTier } from '../types';

export interface IReputation extends Document {
  userId: mongoose.Types.ObjectId;
  score: number;
  tier: ReputationTier;
  totalQueries: number;
  walletsTracked: number;
  commandsUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReputationSchema = new Schema<IReputation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    tier: {
      type: String,
      enum: ['NEWBIE', 'EXPLORER', 'VETERAN', 'ELITE', 'LEGEND'],
      default: 'NEWBIE',
    },
    totalQueries: {
      type: Number,
      default: 0,
    },
    walletsTracked: {
      type: Number,
      default: 0,
    },
    commandsUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const Reputation = mongoose.model<IReputation>('Reputation', ReputationSchema);
