const mongoose = require('mongoose');

const sharedNoteModel = new mongoose.Schema({
    sharedBy : {
        type : String,
        required : true
    },
    sharedTo : {
        type : Array,
        required : true
    },
    // sharedNoteIdList : {
    //     type : Array,
    //     required : true
    // },
    data : {
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
    },
    // isPinnedList : {
    //     type : Array,
    //     required : true
    // }
})

module.exports = mongoose.model("sharedNoteModel", sharedNoteModel);

