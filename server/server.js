const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');

const app = express();      //making the express backend

app.use(bodyParser.json());         //some settings
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use('/api', require('./Routes/NoteRoute'));
app.use('/api', require('./Routes/AuthRoute'));
app.use('/api/', require('./Routes/BinNotesRoute'));
app.use('/api/', require('./Routes/SharedNoteRoute'));

mongoose.connect("mongodb://localhost:27017/keepnotes", {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then((res)=> console.log("Connected to DB"))
.catch((err)=> console.log("Error connecting to DB", err))

//Starting the server
app.listen(8000, ()=>{
    console.log("Server running on Port 8000");
})
