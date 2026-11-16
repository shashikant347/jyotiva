import { modelSchema } from './base.js'
import { Schema } from 'mongoose'
const keysSchema = new Schema({p256dh:{type:String,required:true},auth:{type:String,required:true}},{_id:false,strict:'throw'})
export const WebPushSubscriptionSchema = modelSchema({ id:{type:String,required:true}, userId:{type:String,required:true}, endpoint:{type:String,required:true}, keys:{type:keysSchema,required:true}, createdAt:{type:String,required:true}, updatedAt:{type:String,required:true} })
