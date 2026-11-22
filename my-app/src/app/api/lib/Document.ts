import mongoose from "mongoose";

const DocumentSchema =  new mongoose.Schema({
    userID:{
        type:String,
        required:true
    },
    pdf_link:{
        type:String,
        required:true,
    },
    persist_dir:{
        type:String,
    }

},{timestamps:true})


const Document =  mongoose.models.Document||mongoose.model("Document",DocumentSchema)
export default Document;
