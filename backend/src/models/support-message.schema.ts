import { modelSchema } from './base.js'
export const SupportMessageSchema = modelSchema({ id:{type:String,required:true}, ticketId:{type:String,required:true}, senderId:{type:String,required:true}, senderRole:{type:String,enum:['user','admin'],required:true}, body:{type:String,required:true}, createdAt:{type:String,required:true} })
