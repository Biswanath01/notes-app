const express = require('express');
const uuid = require('uuid');
const router = express.Router();
const authModel = require('../Models/AuthModel');

router.post('/register-user/', (req, res)=>{
    const {userName, email, password} = req.body;
    authModel.findOne({
        // userName : userName,
        email : email,
        // password : password
    }, (err, data)=>{
        if(err){
            return res.status(500).send({
                success : false,
                message : "Error in saving to DB",
                error : err
            })
        }
        if(data !== null){
            return res.status(400).send({
                success : false,
                message : "User is already registered"
            })
        }
        const newModel = new authModel;
        newModel.userName = userName;
        newModel.email = email;
        newModel.password = password;
        newModel.userId = uuid.v4();

        newModel.save((error, authData)=>{
            if(error){
                return res.status(500).send({
                    success: false,
                    message: "Error while saving to DB",
                    error: error
                })
            }
            else{
                return res.status(200).send({
                    success : true,
                    message : "User details saved to DB",
                    data : {
                        userId: authData.userId,
                        userName: authData.userName
                    }
                });
            }
        });
       
    })
});

router.post('/login-user/', (req, res)=>{
    const {userName, email, password} = req.body;
    authModel.findOne({
        email : email,
        // password : password
    }, (err, data)=>{
        if(err){
            return res.status(500).send({
                    success : false,
                    message : "Error processing in DB",
                    error : err
                }
            )
        }
        if(data === null){
            return res.status(200).send({
                success: false,
                message: "No user with the data found. Pls register!"
            })
        }
        else{
            if(data.password === password){
                return res.status(200).send({
                    success : true,
                    message : "User data found in DB. Successfully Logged in",
                    data : {
                        userId: data.userId,
                        userName: data.userName
                    }
                })
            }
        }
    })
});

router.post('/get-user-details/', (req, res) => {
    const {userId} = req.body;
    authModel.findOne({
        userId : userId
    }, (err, data) => {
        if(err){
            return res.status(500).send({
                success : false,
                message : "Internal error in DB",
                error : err
            })
        }
        if(data === null){
            return res.status(404).send({
                success : false,
                message : "No such userId present"
            })
        }
        else{   
            // console.log(data);
            
            let userData = {
                userId : data.userId,
                userName : data.userName,
                email : data.email
            };
            
            return res.status(200).send({
                success : true,
                message : "User details send to DB",
                data : userData
            })
        }
    })
});

router.post('/change-password/', async(req, res) => {
    const {userId, oldPassword, newPassword} = req.body;
    const authData = await authModel.findOne({
        userId : userId
    })
    if(authData === null){
        return res.status(400).send({
            success : false,
            message : "No such user present!"
        })
    }
    else{
        if(authData.password === oldPassword){
            authModel.findOneAndUpdate({
                userId : userId 
            } , {
                $set : {password : newPassword}
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
                        message : "Successfully Changed the Password"
                    })
                }
            })
        }
        else{
            return res.status(200).send({
                success : false,
                message : "Wrong Old Password!!"
            })
        }

    }
})


module.exports = router;