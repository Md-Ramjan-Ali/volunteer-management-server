const express = require('express');
const cors = require('cors');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app=express()
const port=process.env.PORT || 5000;


// Middleware
app.use(cors())
app.use(express.json())







const uri = `mongodb+srv://${process.env.DB_VOLUNTEER_NAME}:${process.env.DB_VOLUNTEER_PASSWORD}@brainbazzdatabase.ihuzu7m.mongodb.net/?retryWrites=true&w=majority&appName=BrainBazzDatabase`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const VolunteerCollection = client
      .db("sebaConnectDB")
      .collection("volunteers");

    // ------------------volunteer management data api-------------------------//

    //volunteer data get
    app.get("/volunteers", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.OrganizerEmail = email;
      }
      const cursor = VolunteerCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //get data home volunteers need now section
    app.get("/volunteers/volunteerNeedNow", async (req, res) => {
      const result = await VolunteerCollection.find()
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    //get volunteers single data
    app.get("/volunteers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await VolunteerCollection.findOne(query);
      res.send(result);
    });

    //volunteer data post
    app.post("/volunteers", async (req, res) => {
      const newVolunteer = req.body;
      const result = await VolunteerCollection.insertOne(newVolunteer);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);







app.get('/',(req,res)=>{
  res.send('Volunteer management server side running')
})

app.listen(port,()=>{
  console.log(`Volunteer server port ${port}`);
})