import { modelSchema } from './base.js'
export const AvailabilityWatchSchema = modelSchema({ id:{type:String,required:true}, userId:{type:String,required:true}, astrologerId:{type:String,required:true}, active:{type:Boolean,required:true}, createdAt:{type:String,required:true} })
