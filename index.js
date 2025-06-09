const express = require('express');
const cors = require('cors');

const app=express()
const port=process.env.PORT || 5000;


// Middleware
app.use(cors())
app.use(express.json())




app.get('/',(req,res)=>{
  res.send('Volunteer management server side running')
})

app.listen(port,()=>{
  console.log(`Volunteer server port ${port}`);
})