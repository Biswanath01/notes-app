const mongoose = require('mongoose');

const taskModel = new mongoose.Schema({
    userId : {
        type : String,
        required : true,
        unique : true
    },
    taskList :[{
        taskId : {
            type : String,
            required : true,
            unique : true
        },
        taskName : {
            type : String,
            required : true,
        },
        taskDueDate : {
            type : Date,
            required : true
        },
        taskImportance : {
            type : Number,         //1 high 2 med 3 low
            required : true
        },
        isCompleted : {
            type : Boolean,
            required : true
        },
        createdAt : {
            type : Date,
            required : true
        },
        attachments : [{
            image : {
                data : Buffer,
                contentType : String
            },
            video : {
                data : Buffer,
                contentType : String,
                encoding : String
            }
        }],
        shared : [{
            userId : {
                type : String
            },
            acceptedDate : {
                type : Date
            }
        }],
        invited : [{
            userId : {
                type : String
            },
            invitedDate : {
                type : Date
            }
        }]
    }]
})

module.exports = new mongoose.model("taskModel", taskModel);