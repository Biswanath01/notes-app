const express = require('express');
const uuid = require('uuid');
const router = express.Router();  
const AuthModel = require('../Models/AuthModel');
const noteModel = require('../Models/NoteModel');
const sharedNoteModel = require('../Models/SharedNoteModel');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const storage = multer.diskStorage({ 
    destination: function(req, file, cb){
        cb(null, 'Images');
    },
    filename: function(req, file, cb){
        cb(null, file.originalname)
    }
});

const fileFilter = (req, file, cb) => {
    const allowedFileTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if(allowedFileTypes.includes(file.mimetype)){
        cb(null, true); 
    } else {
        cb(null, false);
    }
};

let upload = multer({
    storage,
    fileFilter
});

router.post('/share-note/', async(req, res) => { 
    const {ownerId, receiverId, noteId} = req.body;

    const authData1 = await AuthModel.findOne({
        userId : ownerId
    });
    const authData2 = await AuthModel.findOne({
        userId : receiverId
    });

    if(ownerId === receiverId){
        return res.status(200).send({
            success : false,
            message : "This note is shared to you!",
        });
    }

    if(authData1 === null || authData2 === null){
        return res.status(404).send({
            success : false,
            message : "No such user found!"
        })
    }
    else{
        const bData = await noteModel.aggregate([
            {
              $match: {
                "data.noteId": noteId
              } 
            },
            {
              $project: {
                data: {
                  $filter: {
                    input: "$data",
                    cond: {
                      $eq: [
                        "$$this.noteId",
                        noteId
                      ]
                    }
                  }
                }
              }
            }
            ]).exec();

            if(bData === null || bData.length === 0){
                return res.status(404).send({
                    success : false,
                    message : "No such note found!"
                })
            }

            const sharedData = await sharedNoteModel.findOne({
                sharedBy : ownerId,
                "data.noteId" : noteId
            })
            // console.log(sharedData);
            
            let a = {
                // to check once
                noteId : uuid.v4(),
                ...bData[0].data[0],
                noteTitle : bData[0].data[0].noteTitle,
                note : bData[0].data[0].note,
                createdAt : bData[0].data[0].createdAt
            }
            if(bData[0].data[0].image){
                let img = bData[0].data[0].image;
                a.image = img
            }

            if(sharedData === null){
                const newModel = new sharedNoteModel;
                newModel.sharedTo = [receiverId];
                newModel.sharedBy = ownerId;
                newModel.data = a;
                newModel.save((err, data) => {
                    if(err){
                        return res.status(500).send({
                            success : false,
                            message : "Internal error in DB", 
                            error : err
                        })
                    }
                    // successfully saved to shared
                    return res.status(200).send({
                        success : true,
                        message : `Note Successfully shared with ${receiverId}`,
                    });
                })
            }
        
            else{
                if(sharedData.sharedTo.includes(receiverId) === false && sharedData.sharedBy.includes(receiverId) === false){
                    sharedNoteModel.findOneAndUpdate({
                        sharedBy : ownerId
                    }, {
                        $push : {sharedTo : receiverId}
                    }, (err, data) => {
                        if(err){
                            return res.status(500).send({
                                success : false,
                                message : "Internal error in DB", 
                                error : err
                            })
                        }

                        return res.status(200).send({
                            success : true,
                            message : `Note Successfully shared with ${receiverId}`,
                        });
                    });
                } 
                else {
                    return res.status(200).send({
                        success : false,
                        message : "Note was already shared to this user",
                    });
                }
            }
    }
});

router.post('/edit-shared-note/', async(req, res) => {
    const {noteId, newEditedTitle, newEditedNote} = req.body;
        let data = await sharedNoteModel.find({}); 
        sharedNoteModel.findOneAndUpdate({
            "data.noteId" : noteId
        }, {
            $set : {"data.noteTitle" : newEditedTitle, "data.note" : newEditedNote, "data.createdAt" : new Date().toJSON()}
        }, (err, d) => {
            if(err){
                return res.status(500).send({ 
                    success : false,
                    message : "Internal Server error in DB",
                    error : err
                })
            }
            if(d === null){
                return res.status(200).send({
                    success : false,
                    message : "No such note present"
                })
            }
            return res.status(200).send({
                success : true,
                message : "Successfully edited the note!",
                data : d
            })
        })
})

router.get('/get-shared-notes/:userId', async(req, res) => {
    const userId = req.params.userId;
    const authData = await AuthModel.findOne({
        userId : userId
    });
    if(authData === null){
        return res.status(404).send({
            success : false,
            message : "No such user found!"
        })
    }

    let data = await sharedNoteModel.find({
        $or: [ { sharedTo: {$in : userId}  }, { sharedBy : userId } ] 
    });
    
    if(data.length === 0){
        return res.status(200).send({
            success : false,
            message : "No shared notes found for this user!"
        })
    }
    
    let sharedNotes = []; 
    let sharedToData = [];
    let sharedByData = [];
    
    for(let val of data){
        sharedNotes.push(val.data);
        sharedByData.push(val.sharedBy);
        let shareArr = [];  
        
        for (let shareId of val.sharedTo) {
            let shareObj = {};
            let authData = await AuthModel.findOne({
                userId : shareId
            });
            if(authData !== null){
                shareObj["sharedName"] = authData.userName;
                shareObj["sharedId"] = authData.userId;
            }
            shareArr.push(shareObj);
        }
        sharedToData.push(shareArr);
    }

    if(sharedNotes === []){
        return res.status(200).send({
            success : false,
            message : "No shared notes are present!"
        })
    }

    let finalSharedNotes = [];
    let index = 0;
    for(let value of sharedNotes){
        // let imageUrl = "";
        // let dp64 = Buffer.from(value.image.data).toString('base64');      //for image base 64 binary
        // let mimetype = value.image.contentType;
        // imageUrl = `data:${mimetype};base64,${dp64}`;

        let imageUrl = "";
        console.log(value._doc.data.image?.data, " Note: ", value.note.slice(0, 15));
        if(Object.keys(value._doc.data.image).length > 0){
            let dp64 = Buffer.from(value._doc.data.image?.data).toString('base64');      //for image base 64 binary
            let mimetype = value._doc.data.image?.contentType;
            imageUrl = `data:${mimetype};base64,${dp64}`;
        }

        finalSharedNotes.push({
            noteTitle : value.noteTitle,
            note : value.note,
            createdAt : value.createdAt,
            noteId : value.noteId,
            image : imageUrl,
            sharedTo : sharedToData[index],
            sharedBy : sharedByData[index]
        })
        index++;
    }

    return res.status(200).send({
        success : true,
        message : "Shared Note(s) found",
        data : finalSharedNotes.reverse()
    });
});

router.post('/delete-note-for-everyone/', async(req, res) => {
    const {ownerId, noteId} = req.body;
    const noteData = await sharedNoteModel.findOne({
        sharedBy : ownerId,
        "data.noteId" : noteId
    });
    if(noteData === null){
        return res.status(404).send({
            success : false,
            message : "No such note found or no such user present!"
        })
    }
    else{
        // console.log(noteData);
        
        sharedNoteModel.deleteOne({
            sharedBy : ownerId,
            "data.$.noteId" : noteId
        }, (err, data) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB", 
                    error : err
                })
            }
            else{
                return res.status(200).send({
                    success : true,
                    message : "Successfully deleted the note!"
                })
            }
        })
    }
})

router.post('/revoke-receiver/', async(req, res) => {
    const {ownerId, receiverId, noteId} = req.body;
    const noteData = await sharedNoteModel.findOne({
        sharedBy : ownerId,
        "data.noteId" : noteId,
        sharedTo : {$in : receiverId}
    });

    if(noteData === null){
        return res.status(404).send({
            success : false,
            message : "No such note found or no such user present!"
        })
    }
    else{
        sharedNoteModel.findOneAndUpdate({
            sharedBy : ownerId,
            "data.$.noteId" : noteId},
            {
                $pull : {sharedTo : {$in : receiverId}}
        }, (err, data) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB", 
                    error : err
                })
            }
            else{
                return res.status(200).send({
                    success : true,
                    message : `Successfully revoked the user ${receiverId}!`,
                    data : data
                })
            }
        })
    }
});

router.post('/delete-shared-note-by-receiver/', async(req, res) => {
    const {receiverId, noteId} = req.body;
    const noteData = await sharedNoteModel.findOne({
        "data.noteId" : noteId,
        sharedTo : {$in : receiverId}
    });
    if(noteData === null){
        return res.status(404).send({
            success : false,
            message : "No such note found or no such user present!"
        })
    }
    else{
        sharedNoteModel.findOneAndUpdate({
            "data.noteId" : noteId,
            sharedTo : {$in : receiverId}}, {
                $pull : {sharedTo : {$in : receiverId}}
        }, (err, data) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB", 
                    error : err
                })
            }
            else{
                return res.status(200).send({
                    success : true,
                    message : `Successfully delete the shared note ${receiverId}!`,
                    data : data
                })
            }
        })
    }
})

module.exports = router;