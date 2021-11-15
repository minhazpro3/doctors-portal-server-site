const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { MongoClient } = require('mongodb');
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 5000


const serviceAccount = require('./doctors-portals-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

app.use(cors());
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z45ex.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken (req,res,next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization?.split(' ')[1];

    try{

        const decodedUser = await admin.auth().verifyIdToken(token);
        req.decodedEmail = decodedUser.email;

    }
    catch{

    }

  }
  next();
}

async function run (){

    try{
        await client.connect(); 
        const database = client.db('doctors-portals')
        const appointmentCollection = database.collection('appointments')
        const usersCollection=database.collection('users')
        console.log('database connected');


        app.post('/appointment', async (req,res)=>{
          const appointment = req.body;
          const result = await appointmentCollection.insertOne(appointment)
         
          res.json(result)
        })

      


        app.get('/appointments', async (req,res)=>{
          const email = req.query.email;
          const date =new Date (req.query.date).toLocaleDateString();
          const query = {email: email,date:date}
          
          const cursor = appointmentCollection.find(query);
          const result = await cursor.toArray();
          res.json(result)
        })

          // get admin
          app.get('/users/:email', async (req,res)=>{
            const email = req.params.email;
            const query = {email:email};
            const user = await usersCollection.findOne(query);
            let isAdmin = false
            if(user?.role === 'admin'){
              isAdmin=true
            }
            res.json({admin: isAdmin})
          })

        // post users
        app.post('/users', async (req,res)=>{
          const user = req.body;
          const result = await usersCollection.insertOne(user)
          res.json(result)

        })

        // upsert system 
        app.put('/users', async (req,res)=>{
          const user = req.body;
          const filter = {email: user.email}
          const options = { upsert: true };
          const updateDoc = {$set: user};
          const result =await usersCollection.updateOne(filter,updateDoc,options);
          res.json(result)
        })


        


        // admin handle server
        app.put('/users/admin',verifyToken, async (req,res)=>{
          const user = req.body;
         const requester = req.decodedEmail
         if(requester){
           const requesterAccount = await usersCollection.findOne({email: requester})
           if(requesterAccount.role==='admin'){
            const filter = {email: user.email};
            const updateDoc = {$set: {role: 'admin'}}
            const result = await usersCollection.updateOne(filter,updateDoc)
            res.json(result)
           }
         }
         else{
           res.status(403).json({message: 'you do not have access to make an admin'})
         }
          
          
        })

    }
    finally{
        // await client.close();

    }

}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello Doctors portal')
})

app.listen(port, () => {
  console.log('Example app listening' ,port)
})
