const mongoose = require('mongoose');

const noteModel = new mongoose.Schema({
    userId : {
        type : String,
        required : true,
        // unique : true
    },
    data : [{
        noteTitle : {
            type : String
        },
        note : {
            type : String,
            required : true,
        },
        noteId : {
            type : String,
            required : true,
            // unique : true
        },
        createdAt : {
            type : Date,
            required : true
        },
        isPinned : {
            type : Boolean,
            required : true
        },
        image : {
            data : Buffer,
            contentType : String
        }
    }]
})

module.exports = mongoose.model("noteModel", noteModel);