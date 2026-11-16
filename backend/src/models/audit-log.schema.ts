import { Schema } from 'mongoose'
import { modelSchema } from './base.js'
export const AuditLogSchema = modelSchema({ id:{type:String,required:true}, actorId:{type:String,required:true}, action:{type:String,required:true}, entity:{type:String,required:true}, entityId:{type:String,required:true}, meta:{type:Schema.Types.Mixed,required:false}, createdAt:{type:String,required:true} })
