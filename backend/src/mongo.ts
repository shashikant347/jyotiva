import mongoose, { type Model } from 'mongoose'
import { modelSchemas } from './models/index.js'
import type { DocStore } from './persist.js'

export interface MongoConnection extends DocStore { close(): Promise<void> }

export async function connectMongo(uri: string, dbName: string): Promise<MongoConnection> {
  const connection = await mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 15000 }).asPromise()
  const models = new Map<string, Model<any>>()

  const modelFor = (name: string): Model<any> => {
    const existing = models.get(name)
    if (existing) return existing
    const schema = modelSchemas[name as keyof typeof modelSchemas]
    if (!schema) throw new Error(`No Mongoose schema registered for collection "${name}"`)
    const model = connection.model(name, schema, name)
    models.set(name, model)
    return model
  }

  try {
    await connection.db!.command({ ping: 1 })
    return {
      async loadAll(names) {
        const out: Record<string, Record<string, unknown>[]> = {}
        for (const name of names) out[name] = await modelFor(name).find({}).lean().exec() as Record<string, unknown>[]
        return out
      },
      async apply(name, upserts, deleteIds) {
        const model = modelFor(name)
        if (upserts.length) {
          await model.bulkWrite(upserts.map(doc => ({
            replaceOne: { filter: { _id: String(doc._id) }, replacement: doc, upsert: true },
          })) as any, { ordered: false, throwOnValidationError: true })
        }
        if (deleteIds.length) await model.deleteMany({ _id: { $in: deleteIds } }).exec()
      },
      close: () => connection.close(),
    }
  } catch (error) {
    await connection.close()
    throw error
  }
}
