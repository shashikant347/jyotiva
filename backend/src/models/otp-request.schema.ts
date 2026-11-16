import { modelSchema } from './base.js'
export const OtpRequestSchema = modelSchema({ id: {type:String,required:true}, phone: {type:String,required:true}, codeHash: {type:String,required:true}, expiresAt: {type:Number,required:true}, attempts: {type:Number,required:true}, createdAt: {type:Number,required:true}, consumed: {type:Boolean,required:true} })
