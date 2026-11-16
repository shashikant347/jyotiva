import { Schema } from 'mongoose'

export function modelSchema(fields: Record<string, unknown> = {}): Schema {
  return new Schema({ _id: { type: String, required: true }, ...fields }, { strict: 'throw', versionKey: false, minimize: false })
}
