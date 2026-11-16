import { modelSchema } from './base.js'
export const WalletSchema = modelSchema({ userId:{type:String,required:true}, balancePaise:{type:Number,required:true}, updatedAt:{type:String,required:true} })
