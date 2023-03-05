const express = require('express');
const uuid = require('uuid');
const router = express.Router();  
const AuthModel = require('../Models/AuthModel');
const noteModel = require('../Models/NoteModel');
const binNoteModel = require('../Models/BinNotesModel');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const lodash = require("lodash");
const SharedNoteModel = require('../Models/SharedNoteModel');

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


router.post('/add-note/', upload.single("image"), async(req, res) => {  
    const {userId, title, note, pinnedStatus} = req.body;
    const nData = await noteModel.findOne({
        userId : userId
    }); 
    let newPinnedStatus = pinnedStatus === 'true' ? true : false;
    if(nData === null){
        const newModel = new noteModel; 
        newModel.userId = userId;
        // console.log(newPinnedStatus); 
        newModel.data = [];
        let a = {
            noteTitle : title,
            note : note,
            createdAt : new Date().toJSON(), 
            noteId : uuid.v4(),
            isPinned : newPinnedStatus,
        }
        console.log(req.body);

        if(req.file){
            a.image = {
                data : fs.readFileSync(path.join(__dirname, '../Images/' + req.file.filename)), 
                contentType : req.file.mimetype
            }
        }

        newModel.data.push(a);
        
        newModel.save((err, d) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB",
                    error : err
                })
            }
            return res.status(200).send({
                success : true,
                message : "Note successfully added"
            })
        })
    }
    else{
        // console.log(newPinnedStatus);
        let a = {
            noteTitle : title, 
            note : note,
            createdAt : new Date().toJSON(),
            noteId : uuid.v4(),
            isPinned : newPinnedStatus
        }
        
        if(req.file){
            a.image = {
                data : fs.readFileSync(path.join(__dirname, '../Images/' + req.file.filename)), 
                contentType : req.file.mimetype
            }
        }
        
        noteModel.findOneAndUpdate({
            userId : userId
        }, {
            $push : {data : a}
        }, (err, data) => {
            if(err){
                return res.status(500).send({
                    message: "Some internal error occured!",
                    success : false,
                    error : err
                })
            }
            return res.status(200).send({
                success : true,
                message : "Note successfully added",
            })
        })
    }
    const dirPath = path.join(__dirname, '../Images/');
    fs.readdir(dirPath, (err, images) => {
        if (err) {
            console.log('Unable to scan directory: ' + err);
        } 

        images.forEach((image) => {
            fs.unlink(dirPath + image, (e) => console.log(e));
        });
    });
})

router.post('/copy-note/', async(req, res) => {
    const {userId, title, note, noteId, pinnedStatus} = req.body;
    const nData = await noteModel.findOne({
        userId : userId
    }); 

    let img = {};
    nData.data.map((value, index) => {
        if(value.noteId === noteId){
            img = value.image;
        }
    })

    let a = {
        noteTitle : title, 
        note : note,
        createdAt : new Date().toJSON(),
        noteId : uuid.v4(),
        isPinned : pinnedStatus,
        image :  img
    }
    // console.log(a);

    noteModel.findOneAndUpdate({
        userId : userId
    }, {
        $push : {data : a}
    }, (err, d) => {
        if(err){
            return res.status(500).send({
                message: "Some internal error occured!",
                success : false,
                error : err
            })
        }
        return res.status(200).send({
            success : true,
            message : "Note successfully copied",
        })
    })
})

router.get('/get-notes/:userId', async(req, res) => {
    const userId = req.params.userId;
    const authData = await AuthModel.findOne({
        userId : userId
    })
    if(authData === null){
        return res.status(404).send({
            success : false,
            message : "No such user present!"
        })
    }
    else{
        noteModel.findOne({
            userId : userId
        }, (err, data) => {  
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal Server error in DB",
                    error : err
                })
            }
            if(data === null || data.data.length === 0){
                return res.status(200).send({
                    success : true,
                    message : "No note present for this user!",
                })
            }
            else{
                // console.log(data); 
                let unPinnedNotes = [];
                data.data.map((val, index) => {
                    if(val.isPinned == false){
                        unPinnedNotes.push(val);
                    }
                })

                if(unPinnedNotes === []){
                    return res.status(200).send({
                        success : false,
                        message : "No unpinned notes are present!"
                    })
                }

                // console.log("unPinnedNotes: ", unPinnedNotes);
                let finalUnPinnedNotes = [];
                for(let value of unPinnedNotes){
                    let imageUrl = "";
                    if(Object.keys(value._doc.image).length > 0){
                        // console.log(value._doc.image?.data, " Note: ", value.note.slice(0, 15));
                        let dp64 = Buffer.from(value._doc.image?.data).toString('base64');      //for image base 64 binary
                        let mimetype = value._doc.image?.contentType;
                        imageUrl = `data:${mimetype};base64,${dp64}`;
                    }

                    finalUnPinnedNotes.push({
                        noteTitle : value.noteTitle,
                        note : value.note,
                        createdAt : value.createdAt,
                        noteId : value.noteId,
                        isPinned : value.pinnedStatus,
                        image : imageUrl
                    })
                }

                return res.status(200).send({
                    success : true,
                    message : "Data of the notes send to the frontend!",
                    data : finalUnPinnedNotes.reverse()
                })
            }
        })
    }
})

router.post('/add-note-to-pinned/', async(req, res) => {
    const {noteId, userId} = req.body;
    const noteData = await noteModel.findOne({
        userId : userId,
        noteId : {$in : noteId}
    })
    if(noteData === null){
        return res.status(404).send({
            success : false,
            message : "No such note present!"
        })
    }
    else{
        noteModel.findOneAndUpdate({
            userId : userId,
            "data.noteId" : noteId
        }, {
            $set : {"data.$.isPinned" : true}
        }, (err, d) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal Server error in DB",
                    error : err
                })
            }
            if(d === null){
                return res.status(400).send({
                    success : false,
                    message : "No such note!"
                })
            }
            return res.status(200).send({
                success : true,
                message : "Successfully pinned the note!"
            })
        })
    }
})

router.get('/get-pinned-notes/:userId', async(req, res) => {
    const userId = req.params.userId;
    const data = await noteModel.findOne({
        userId : userId
    })
    if(data === null){
        return res.status(200).send({
            success : false,
            message : "No pinned notes are present!!"
        })
    }
    else{
        let pinnedNotes = [];
        data.data.map((value, index) => {
            if(value.isPinned === true){
                pinnedNotes.push(value);
            }
        })

        if(pinnedNotes === []){
            return res.status(200).send({
                success : false,
                message : "No pinned notes are present!"
            })
        }

        let finalPinnedNotes = [];
        for(let value of pinnedNotes){
            let imageUrl = "";
            if(Object.keys(value._doc.image).length > 0){
                // console.log(value._doc.image?.data, " Note: ", value.note.slice(0, 15));
                let dp64 = Buffer.from(value._doc.image?.data).toString('base64');      //for image base 64 binary
                let mimetype = value._doc.image?.contentType;
                imageUrl = `data:${mimetype};base64,${dp64}`;
            }

            finalPinnedNotes.push({
                noteTitle : value.noteTitle,
                note : value.note,
                createdAt : value.createdAt,
                noteId : value.noteId,
                isPinned : value.pinnedStatus,
                image : imageUrl
            })
        }
        
        return res.status(200).send({
            success : true,
            message : "Successfully returned the pinned note!",
            data : finalPinnedNotes.reverse()
        })
    }
})

router.post('/remove-note-from-pinned/', async(req, res) => {
    const {noteId, userId} = req.body;
    const noteData = await noteModel.findOne({
        userId : userId,
        noteId : {$in : noteId}
    })
    if(noteData === null){
        return res.status(404).send({
            success : false,
            message : "No such note present!"
        })
    }
    else{
        noteModel.findOneAndUpdate({
            userId : userId,
            "data.noteId" : noteId
        }, {
            $set : {"data.$.isPinned" : false}
        }, (err, d) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal Server error in DB",
                    error : err
                })
            }
            if(d === null){
                return res.status(400).send({
                    success : false,
                    message : "No such note!"
                })
            }
            return res.status(200).send({
                success : true,
                message : "Successfully unpinned the note!"
            })
        })
    }
})

router.post('/delete-note/', async(req, res) => {
    const {userId, noteId} = req.body;
    const data = await noteModel.findOne({
        userId : userId
    });
    // console.log(data);
    let flag = 0;

    for(let j=0; j<data.data.length; j++){
        if(data.data[j].noteId === noteId){
            flag = 1;
            break;
        }
        else{
            flag = 0;
        }
    }
    if(flag===1){
        noteModel.findOneAndUpdate({
            userId : userId
        }, {
            $pull : {data : {noteId : noteId}}
        }, (err, d) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal Server error in DB",
                    error : err
                })
            }
            return res.status(200).send({
                success : true,
                message : "Successfully deleted the note!"
            })
        })
    }
    else{
        return res.status(200).send({
            success : false,
            message : "No such note present"
        })
    }
})

// to check once
router.post('/edit-note/', async(req, res) => {
    const {userId, newEditedTitle, newEditedNote, noteId, pinnedStatus } = req.body;
    const data = await noteModel.findOne({
        userId : userId
    });
    if(data === null){
        return res.status(404).send({
            success : false,
            message : "No such user found!"
        })
    }
    else{
        // console.log(data);
        let finalPinnedStatus = (pinnedStatus === 'true' ? true : false);
        let editedNote = [];
        data.data.map((value, index) => {
            editedNote.push(value);
        })
        let flag = 0;
        var index = 0;
        for(let j=0; j<data.data.length; j++){
            if(data.data[j].noteId === noteId){
                index = j;
                flag = 1;
                editedNote.push(data.data[j]);
                break;
            }
            else{
                flag = 0;
            }
        }
        if(flag===1){
            let imageUrl = "";
            // console.log("EditedNote:**** ", editedNote[0].image); 
            let dp64 =  Buffer.from(editedNote[0].image.data).toString('base64');      //for image base 64 binary
            let mimetype = editedNote[0].image.contentType;
            imageUrl = `data:${mimetype};base64,${dp64}`; 
            noteModel.findOneAndUpdate({
                userId : userId,
                "data.noteId" : noteId
            }, {
                $set : {"data.$.noteTitle" : newEditedTitle, "data.$.note" : newEditedNote, "data.$.createdAt" : new Date().toJSON()}
            }, (err, d) => {
                if(err){
                    return res.status(500).send({ 
                        success : false,
                        message : "Internal Server error in DB",
                        error : err
                    })
                }
                return res.status(200).send({
                    success : true,
                    message : "Successfully edited the note!"
                })
            })
        }
        else{
            return res.status(200).send({
                success : false,
                message : "No such note present"
            })
        }
    }
})

router.post('/restore-note/', async (req, res) => {
    const {userId, nId} = req.body;
    const nData = await noteModel.findOne({
        userId : userId 
    })


    const bData = await binNoteModel.aggregate([
        {
          $match: {
            "data.noteId": nId
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
                    nId
                  ]
                }
              }
            }
          }
        }
      ]).exec();

    // console.log("bData[0]", bData);
    if(bData === null || bData.length === 0){
        return res.status(404).send({
            success : false,
            message : "No such note found!"
        })
    }

    if(nData === null){
        console.log("1");
        const newModel = new noteModel;
        newModel.userId = userId;
        newModel.data.push(bData[0].data[0]);
        newModel.save((err, d) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB", 
                    error : err
                })
            }
            binNoteModel.findOneAndUpdate({
                userId : userId
            }, {
                $pull : {data : {noteId : nId}}
            }, (e, restoredData) => {
                if(e){
                    return res.status(500).send({
                        success : false,
                        message : "Internal error in DB!",
                        error : e
                    })
                }
                else{
                    // return res.status(200).send({
                    //     success : true,
                    //     message : "Successfully deleted the note from bin  and added to the main notes"
                    // })
                }
            })
            return res.status(200).send({
                success : true,
                message : "Successfully restored the note!"
            })
        })
    }
    else{
        console.log("2");
        noteModel.findOneAndUpdate({
            userId : userId
        },
        {
            $push : {data : bData[0].data[0]}
        }, (err, d) => {
            if(err){
                return res.status(500).send({
                    message: "Some internal error occured!",
                    success : false,
                    error : err
                })
            }
            binNoteModel.findOneAndUpdate({
                userId : userId,
                "data.noteId" : nId
            }, {
                $pull : {data : {noteId : nId}}
            }, (e, restoredData) => {
                if(e){
                    return res.status(500).send({
                        success : false,
                        message : "Internal error in DB!",
                        error : e
                    })
                }
                else{
                    // return res.status(200).send({
                    //     success : true,
                    //     message : "Successfully deleted the note from bin and added to the main notes"
                    // })
                }
            })
            return res.status(200).send({
                success : true,
                message : "Successfully restored the note", 
                data : d
            }) 
        })
    }
})

router.post('/get-search/', async(req, res) => {
    const {search, userId} = req.body;
    const data = await noteModel.find({
        userId : userId
    });
    if(search === ""){
        return res.status(200).send({
            success : true,
            message : "No search term. Initial rendering"
        })
    }

    let searchResult = [];
    // console.log(data);
    data[0].data && data[0].data.map((value, index) => {
        // console.log(value.noteTitle);
        if(value.noteTitle.toLowerCase().includes(search.toLowerCase()) || value.note.toLowerCase().includes(search.toLowerCase())){
            searchResult.push(value);
        }
    })
    if(searchResult.length !==0){
        let finalSearchResult = [];
        for(let value of searchResult){
            let imageUrl = "";
            if(Object.keys(value._doc.image).length > 0){
                // console.log(value._doc.image?.data, " Note: ", value.note.slice(0, 15));
                let dp64 = Buffer.from(value._doc.image?.data).toString('base64');      //for image base 64 binary
                let mimetype = value._doc.image?.contentType;
                imageUrl = `data:${mimetype};base64,${dp64}`;
            }

            finalSearchResult.push({
                noteTitle : value.noteTitle,
                note : value.note,
                createdAt : value.createdAt,
                noteId : value.noteId,
                isPinned : value.pinnedStatus,
                image : imageUrl
            })
        }
        return res.status(200).send({
            success : true,
            message : "Data found",
            data : finalSearchResult
        })
    }
    else{
        return res.status(200).send({
            success : false,
            message : "No search term found"
        })
    }
})

router.post('/get-shared-search/', async(req, res) => {
    const {search, userId} = req.body;

    const data = await SharedNoteModel.find({
        $or: [ { sharedTo: {$in : userId}  }, { sharedBy : userId } ] 
    });

    if(search === ""){
        return res.status(200).send({
            success : true,
            message : "No search term. Initial rendering"
        })
    }

    // console.log(data);

    let sharedSearchResult = [];
    // console.log(data);
    data && data.map((value, index) => {
        // console.log(value.data.noteTitle);
        if(value.data.noteTitle.toLowerCase().includes(search.toLowerCase()) || value.data.note.toLowerCase().includes(search.toLowerCase())){
            sharedSearchResult.push(value);
        }
    })
    // console.log("sharedSearchResult::", sharedSearchResult);

    let sharedNotes = []; 
    let sharedToData = [];
    let sharedByData = [];
    
    for(let val of sharedSearchResult){
        // sharedByData.push(val.sharedBy);
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

    let index=0;
    if(sharedSearchResult.length !==0){
        let finalSharedSearchResult = [];
        for(let value of sharedSearchResult){
            let imageUrl = "";
            if(Object.keys(value._doc.image).length > 0){
                // console.log(value._doc.image?.data, " Note: ", value.note.slice(0, 15));
                let dp64 = Buffer.from(value._doc.image?.data).toString('base64');      //for image base 64 binary
                let mimetype = value._doc.image?.contentType;
                imageUrl = `data:${mimetype};base64,${dp64}`;
            }

            finalSharedSearchResult.push({
                noteTitle : value.data.noteTitle,
                note : value.data.note,
                createdAt : value.data.createdAt,
                noteId : value.data.noteId,
                isPinned : value.data.pinnedStatus,
                sharedBy : value.sharedBy,
                sharedTo : sharedToData[index],
                image : imageUrl
            })
            index++;
        }
        return res.status(200).send({
            success : true,
            message : "Data found",
            data : finalSharedSearchResult
        })
    }
    else{
        return res.status(200).send({
            success : false,
            message : "No search term found"
        })
    }
})

module.exports = router;

