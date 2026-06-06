import mongoose, { Schema, Document } from 'mongoose';

export interface IQueryHistory extends Document {
  userId: mongoose.Types.ObjectId;
  query: string;
  response: string;
  intent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const QueryHistorySchema = new Schema<IQueryHistory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    query: { type: String, required: true },
    response: { type: String, required: true },
    intent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const QueryHistory = mongoose.model<IQueryHistory>('QueryHistory', QueryHistorySchema);
