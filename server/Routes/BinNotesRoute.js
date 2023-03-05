const express = require('express');
const uuid = require('uuid');
const AuthModel = require('../Models/AuthModel');
const router = express.Router();  
const noteModel = require('../Models/NoteModel');
const binNotesModel = require('../Models/BinNotesModel');

router.post('/add-note-to-bin/', async(req, res) => {  
    const {userId, noteId} = req.body;
    const nData = await noteModel.findOne({
        userId : userId, 
        "data.$.noteId" : noteId
    }); 
    if(nData === null){
        return res.status(400).send({
            success : false,
            message : "No such user present!"  
        })
    }

    // console.log("nData", nData);

    
    let img = {};
    let a = {}
    nData.data.map((value, index) => {
        if(value.noteId === noteId){
            a = {
                noteTitle : value.noteTitle, 
                note : value.note,
                createdAt : value.createdAt,
                noteId : value.noteId,
                isPinned : value.isPinned,
                image :  value.image
            }
        }
    })

    // console.log("a", a.isPinned);


    const data = await binNotesModel.findOne({
        userId : userId
    })

    if(data === null){
        console.log("1");
        const newModel = new binNotesModel;
        newModel.userId = userId;
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
                message : "Note binned"
            })
        })
    }
    else{
        console.log("2");
        // console.log(a);
        binNotesModel.findOneAndUpdate({
            userId : userId
        },
        {
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
                message : "Note binned",
                data : d
            })
        })
    }
})


router.get('/get-binned-notes/:userId', async(req, res) => { 
    const userId = req.params.userId;
    const data = await binNotesModel.findOne({
        userId : userId
    });
    if(data === null){
        return res.status(200).send({
            success : false,
            message : "No binned notes present!"
        })
    }
    else{
        let binnedData = [];
        data.data.map((val, index) => { 
            binnedData.push(val);
        })

        let finalBinnedNotes = [];
        
        for(let value of binnedData){

            let imageUrl = "";
            if(Object.keys(value._doc.image).length > 0){
                // console.log(value._doc.image?.data, " Note: ", value.note.slice(0, 15));
                let dp64 = Buffer.from(value._doc.image?.data).toString('base64');      //for image base 64 binary
                let mimetype = value._doc.image?.contentType;
                imageUrl = `data:${mimetype};base64,${dp64}`;
            }
            finalBinnedNotes.push({
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
            message : "Binned notes send to fontend!",
            data : finalBinnedNotes
        })
    }
})

module.exports = router;