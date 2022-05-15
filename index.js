const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

//heroku deploy api link
// https://arcane-brook-53779.herokuapp.com/

// middleware
app.use(cors())
app.use(express.json())


// mongodb
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASS}@cluster0.v7hr7.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const run  = async () => {
    try{
        await client.connect()
        const serviceCollection = client.db('doctorPortal').collection('services')
        app.post('/service',async(req,res) => {
            const body = req.body
            const result = await serviceCollection.insertOne(body);
            res.send(result)
        })
        app.get('/services',async(req,res) => {
            const cursor = serviceCollection.find({})
            const result = await cursor.toArray()
            res.send(result)
        })
    }
    finally{

    }
}
run().catch(console.dir)

app.get("/",(req,res) => {
    res.send('all is ok')
})

app.listen(port,() => {
    console.log("listening my port is" + port)
})