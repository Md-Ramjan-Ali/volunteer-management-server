const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_VOLUNTEER_NAME}:${process.env.DB_VOLUNTEER_PASSWORD}@brainbazzdatabase.ihuzu7m.mongodb.net/?retryWrites=true&w=majority&appName=BrainBazzDatabase`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const admin = require("firebase-admin");
const serviceAccount = require("./volunteer-management-web-service-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("decoded token", decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const VolunteerPostsCollection = client
      .db("sebaConnectDB")
      .collection("volunteers");

    const VolunteerRequestCollection = client
      .db("sebaConnectDB")
      .collection("requests");

    // ------------------volunteer post data api-------------------------//

    // volunteer all data get
    app.get("/volunteers", async (req, res) => {
      const { search } = req.query;

      const query = {};
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      const cursor = VolunteerPostsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    //volunteer data get
    app.get(
      "/volunteers/myPost",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;

        const query = {};
        if (email) {
          query.OrganizerEmail = email;
        }
        const cursor = VolunteerPostsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    //volunteer data get search
    // app.get("/volunteers/allVolunteer", async (req, res) => {
    //   const { search } = req.query;
    //   const query = {};
    //   if (search) {
    //     query.title = { $regex: search, $options: "i" };
    //   }
    //   const cursor = VolunteerPostsCollection.find(query);
    //   const result = await cursor.toArray();
    //   res.send(result);
    // });

    //get data home volunteers need now section
    app.get("/volunteers/volunteerNeedNow", async (req, res) => {
      const result = await VolunteerPostsCollection.find()
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    //get volunteers single data
    app.get("/volunteers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await VolunteerPostsCollection.findOne(query);
      res.send(result);
    });

    //volunteer data post
    app.post("/volunteers", async (req, res) => {
      const newVolunteer = req.body;
      const result = await VolunteerPostsCollection.insertOne(newVolunteer);
      res.send(result);
    });

    // put updata
    app.put("/volunteers/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateVolunteer = req.body;

      const updateDoc = {
        $set: updateVolunteer,
      };

      const result = await VolunteerPostsCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // delete volunteer post
    app.delete("/volunteers/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await VolunteerPostsCollection.deleteOne(filter);
      res.send(result);
    });

    //
    // ------------------volunteer Request data api-------------------------//
    //

    //get the All(unique) requested data
    app.get(
      "/requests",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;
        const query = {};
        if (email) {
          query.volunteerEmail = email;
        }

        const cursor = VolunteerRequestCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    // single data
    app.get("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await VolunteerRequestCollection.findOne(query);
      res.send(result);
    });

    //
    //post volunteer request and decrement volunteer need number
    app.post("/volunteers/requests", async (req, res) => {
      const { _id, ...requestData } = req.body;
      const reqId = _id;
      console.log(requestData);

      if (!ObjectId.isValid(reqId)) {
        return res.status(400).send({ error: "Invalid post ID." });
      }

      const isAlreadyAdded = await VolunteerRequestCollection.findOne({
        reqId,
        volunteerEmail: requestData.volunteerEmail,
      });
      if (isAlreadyAdded) {
        return res.status(500).send({ message: "already added" });
      }
      const filter = { _id: new ObjectId(reqId) };

      try {
        //  Step 1: Insert the volunteer request
        const insertResult = await VolunteerRequestCollection.insertOne({
          ...requestData,
          reqId,
        });
        //Step 2: Decrement volunteersNeeded
        const decrement = {
          $inc: { volunteersNeeded: -1 },
        };
        //  Step 3: update volunteersNeeded
        const updateResult = await VolunteerPostsCollection.updateOne(
          filter,
          decrement
        );

        res.send({
          acknowledged: true,
          requestInsertedId: insertResult.insertedId,
          volunteersDecremented: updateResult.modifiedCount > 0,
        });
      } catch (error) {
        console.error("Volunteer request error:", error);
        res.status(500).send({
          acknowledged: false,
          error: "Something went wrong. Try again later.",
        });
      }
    });

    //
    //
    // delete request data

    app.delete("/volunteers/requests/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const query = { _id: new ObjectId(id) };

        // First: Find the volunteer request to get the postId
        const volunteerRequest = await VolunteerRequestCollection.findOne(
          query
        );

        if (!volunteerRequest) {
          return res
            .status(404)
            .send({ message: "Volunteer request not found" });
        }

        const reqId = volunteerRequest.reqId;
        if (!reqId) {
          return res
            .status(400)
            .send({ message: "No postId found in the request" });
        }

        // Second: Delete the volunteer request
        const deleteResult = await VolunteerRequestCollection.deleteOne(query);

        // Third: Increment the volunteersNeeded field in the related post
        const filter = { _id: new ObjectId(reqId) };
        const update = { $inc: { volunteersNeeded: 1 } };
        const incrementResult = await VolunteerPostsCollection.updateOne(
          filter,
          update
        );

        res.send({
          deleted: deleteResult,
          incremented: incrementResult,
        });
      } catch (error) {
        console.error("Error deleting volunteer request:", error);
        res.status(500).send({ message: "Internal server error" });
      }
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

app.get("/", (req, res) => {
  res.send("Volunteer management server side running");
});

app.listen(port, () => {
  console.log(`Volunteer server port ${port}`);
});
