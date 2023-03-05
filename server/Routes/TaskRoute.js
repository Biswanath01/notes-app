const express = require('express');
const uuid = require('uuid');
const router = express.Router(); 
const authModel = require('../Models/AuthModel');
const taskModel = require('../Models/TaskModel');

router.post('/add-task/', async(req, res) => {
    const {userId, taskName, taskDueDate, taskImportance} = req.body;
    const authData = await authModel.findOne({
        userId : userId
    })

    if(authData === null){
        return res.status(404).send({
            success : false,
            message : "No such user present!"
        })
    }
    else{
        const taskData = await taskModel.findOne({
            userId : userId
        })
        console.log(taskData);
        let a = {
            taskId : uuid.v4(),
            taskName : taskName,
            taskDueDate : taskDueDate,
            taskImportance : taskImportance,
            isCompleted : false,
            createdAt : new Date().toJSON(),
            shared: [],
            invited: []
        }
        if(taskData === null){
            const newModel = new taskModel;
            newModel.userId = userId;
            newModel.taskList.push(a);
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
                    message : "Task successfully added to DB @1st task"
                })
            })
        }
        else{
            taskModel.findOneAndUpdate({
                userId : userId
            }, {
                $push : {taskList : a}
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
                    message : "Task successfully added to DB @2nd task"
                })
            })
        }
    }
})

router.get('/get-task/:userId', async(req, res) => {
    const userId = req.params.userId;
    const taskData = await taskModel.findOne({
        userId : userId
    })
    if(taskData === null){
        return res.status(200).send({
            success : false,
            message : "No task found for this user"
        })
    }
    else{
        taskModel.findOne({
            userId : userId
        }, (err, data) => {
            if(err){
                return res.status(500).send({
                    success : false,
                    message : "Internal error in DB",
                    error : err
                })
            }
            finalData = [];
            data.taskList.map((value, index) => {
                let a = {
                    taskId : value.taskId,
                    taskName : value.taskName,
                    taskDueDate : value.taskDueDate,
                    createdAt : value.createdAt,
                    taskImportance : value.taskImportance,
                    isCompleted : value.isCompleted
                }
                finalData.push(a);
            })
            return res.status(200).send({
                success : true,
                message : "Task successfully send to Frontend",
                data : finalData
            })
        })
    }
});

router.post('/completed-tasks/', async(req, res) => {
    const {userId, taskId, action_type} = req.body;
    const taskData = await taskModel.findOne({
        userId : userId
    })
    if(taskData === null){
        return res.status(200).send({
            success : false,
            message : "No task found for this user"
        });
    }
    else {
        taskModel.findOneAndUpdate({
            userId : userId,
            "taskList.taskId" : taskId} , {
                $set : {"taskList.$.isCompleted" : action_type === "mark-complete" ? true : false}
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
                message : "Task successfully completed and added to completed task list",
            });
        });
    }
});

router.post('/share-task/', async (req, res) => {
    const { userId, sharedMails, taskId } = req.body;
    let sharedUserIds = [];

    for(let mail of sharedMails){
        let authData = await authModel.findOne({ email: mail });
        if(authData !== null){
            sharedUserIds.push(authData.userId);
        }
    }

    if(sharedUserIds.length > 0){
        let sharedObjects = [];
        let date = new Date().toJSON();

        for(let id of sharedUserIds){
            sharedObjects.push({
                userId: id,
                invitedDate: date
            });
        }

        taskModel.findOneAndUpdate({
            userId : userId,
                "taskList.taskId" : taskId
            } , {
                $push : { "taskList.$.invited" : { $each: sharedObjects }}
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
                    message : "Successfully invited these users",
                });
        });
    }
});

router.post('/get-invites/', async (req, res) => {
    const { userId } = req.body;
    let taskData = await taskModel.aggregate([
        // Match documents where the given userId is in the invited array
        {
          $match: {
            "taskList.invited.userId": userId
          }
        },
        // Unwind the taskList array so we can work with each task individually
        {
          $unwind: "$taskList"
        },
        // Match the task within the taskList array where the given userId is in the invited array
        {
          $match: {
            "taskList.invited.userId": userId
          }
        },
        // Project only the taskId of the matching task
        {
          $project: {
            _id: 0,
            taskId: "$taskList.taskId"
          }
        }
    ]);

    let taskIds = [];
    taskData.map((taskObject) => taskIds.push(taskObject.taskId));
    let invitesInfo = [];
    for(let taskId of taskIds){
        //let taskData = await taskModel.findOne({ "taskList.taskId": taskId });
        let tData = await taskModel.aggregate([
            // Match documents where the given userId is in the invited array
            {
              $match: {
                "taskList.taskId": taskId
              }
            },
            // Unwind the taskList array so we can work with each task individually
            {
              $unwind: "$taskList"
            },
            // Match the task within the taskList array where the given userId is in the invited array
            {
              $match: {
                "taskList.taskId": taskId
              }
            },
            // Project only the taskId of the matching task
            {
              $project: {
                _id: 0,
                taskId: "$taskList.taskId",
                taskName: "$taskList.taskName",
                adminId: "$userId"
              }
            }
        ]);
        
        invitesInfo.push(tData[0]);
    }

    return res.status(200).send({
        success: true,
        invitesInfo: invitesInfo
    });
});


router.post('/accept-or-reject-invites/', async(req, res) => {
    const {userId, taskId, action_type} = req.body;
    const taskData = await taskModel.findOne({
        "taskList.taskId" : taskId,
        "taskList.invited.userId" : userId 
    });
    if(taskData === null){
        return res.status(404).send({
            success : false,
            message : "No such task found"
        })
    }
    else{
        if(action_type === "accept"){
            const acceptedObject = {
                userId: userId,
                acceptedDate: new Date().toJSON()
            };

            taskModel.updateOne({
                "taskList.taskId" : taskId,
                "taskList.invited.userId" : userId
            },
            {
                $pull : { "taskList.$.invited" : {
                    userId : userId
                }},
                $push: {
                    "taskList.$.shared": acceptedObject
                }
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
                        message : "Invite accepted!"
                    })
                }
            })
        } else {
            taskModel.updateOne({
                "taskList.taskId" : taskId,
                "taskList.invited.userId" : userId
            },
            {
                $pull : { "taskList.$.invited" : {
                    userId : userId
                }}
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
                        message : "Invite rejected!"
                    })
                }
            })
        }
    }
})
module.exports = router;