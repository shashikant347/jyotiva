import { modelSchema } from './base.js'
export const ChatMessageSchema = modelSchema({ id:{type:String,required:true}, sessionId:{type:String,required:true}, senderRole:{type:String,enum:['user','astrologer','system'],required:true}, body:{type:String,required:true}, createdAt:{type:Number,required:true}, readAt:{type:Number,default:null} })
