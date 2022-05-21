const express = require('express')
const cors = require('cors')
require('dotenv').config()
const {
    MongoClient,
    ServerApiVersion
} = require('mongodb');
const app = express()
const port = process.env.PORT || 5000
var jwt = require('jsonwebtoken');

//heroku deploy api link
// https://arcane-brook-53779.herokuapp.com/

// middleware
app.use(cors())
app.use(express.json())


// mongodb
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASS}@cluster0.v7hr7.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
});
/* 
    API Naming Convention
    app.get('/booking') // get all booking in this collection.or get more then  one or by filter
    app.get('/booking/:id') // get a specific booking
    app.post('/booking') // add a new booking
    app.put('/booking/:id') //upsert  ==> update (if exists) or insert (if doesn't exist)
    app.Patch('/booking/:id') *
    app.delete('/booking/:id')
*/
const verifyToken = (req, res, next) => {
    const authorization = req.headers['authorization']
    const token = authorization && authorization.split(' ')[1]
    if (!token) return res.status(403).send({
        message: "Forbidden access",
        status: 403
    })
    jwt.verify(token, process.env.JWT_SCRECT, (err, decoded) => {
        if (err) return res.status(403).send({
            message: "Forbidden access",
            status: 403
        })
        req.decoded = decoded
        next()
    })
}
const run = async () => {
    try {
        await client.connect()
        const serviceCollection = client.db('doctorPortal').collection('services');
        const bookingCollection = client.db('doctorPortal').collection('Booking')
        const userCollection = client.db('doctorPortal').collection('user')
        const doctorCollection = client.db('doctorPortal').collection('doctor')
        // middle ware to verifyAdmin
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({
                email: requester
            })
            if (requesterAccount.role === 'admin') {
                next()
            } else {
                res.status(403).send({
                    message: 'forbidden'
                })
            }
        }
        // find to userCollection
        app.get('/user', verifyToken, async (req, res) => {
            const user = await userCollection.find().toArray()
            res.send(user)
        })
        // user collection
        app.put('/user/admin/:email', [verifyToken,verifyAdmin], async (req, res) => {
            const email = req.params.email
            const filter = {
                email: email
            }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc)
            res.send(result)
        })
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({
                email
            })
            const isAdmin = user.role === 'admin'
            res.send({
                admin: isAdmin
            })
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = {
                email: email
            }
            const options = {
                upsert: true
            }
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            var token = jwt.sign({
                email: email
            }, process.env.JWT_SCRECT, {
                expiresIn: '1d'
            });
            res.send({
                result,
                token
            })
        })

        // get booking query
        app.get('/booking', verifyToken, async (req, res) => {
            const email = req.query.email
            const decoded = req.decoded.email
            if (decoded === email) {
                const patientEmail = {
                    patientEmail: email
                }
                const result = await bookingCollection.find(patientEmail).toArray()
                return res.send(result)
            } else {
                return res.status(403).send({
                    message: "Forbidden access"
                })
            }
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body
            const query = {
                treatment: booking.treatment,
                date: booking.date,
                patientEmail: booking.patientEmail,
                slot: booking.slot
            }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({
                    success: false,
                    booking: exists
                })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({
                success: true,
                result
            })
        })
        app.get('/services', async (req, res) => {
            const query = req.query
            const cursor = serviceCollection.find(query).project({
                name: 1,
                _id: 0
            })
            const result = await cursor.toArray()
            res.send(result)
        })
        // Warning:
        // This is not the proper way to query.
        //After learning more about mongodb,use aggregate lookup,pipeline,match,group
        // available booking
        app.get('/available', async (req, res) => {
            // step 1: get all services
            const date = req.query.date || "May 17, 2022"
            const services = await serviceCollection.find().toArray()
            const query = {
                date: date
            }
            // step 2: get the booking to that day
            const bookings = await bookingCollection.find(query).toArray()
            // step 3: for each service
            services.forEach(service => {
                //step 4: find booking for that services. outPut : [{},{},{},{}]
                const bookingService = bookings.filter(b => b.treatment === service.name)
                // step 5: select slots for the service booking: ['','','','']
                const booked = bookingService.map(s => s.slot)
                // step 6: select those slots that are not in bookedSlots
                // step 7: set available to slots to make it easier
                service.slots = service.slots.filter(s => booked.indexOf(s) === -1)
                // two defendant way
                // service.available = service.slots.filter(s => !booked.includes(s))
            })
            res.send(services)
        })
        // practice available services
        // app.get("/available" ,async(req,res) => {
        //     const date = req.query.date || "May 17, 2022"
        //     const allServices = await serviceCollection.find().toArray()
        //     const booking = await bookingCollection.find({date: date }).toArray()
        //     allServices.forEach(service => {
        //         const booked = booking.filter(b => {
        //             return b.treatment === service.name
        //         })
        //         const bookedSlot = booked.map(s => s.slot)
        //         console.log(bookedSlot)
        //         service.slots = service.slots.filter(sl => !bookedSlot.includes(sl))
        //     });
        //     res.send(allServices)
        // })

        // post a doctor
        app.post('/doctor', [verifyToken, verifyAdmin], async (req, res) => {
            const doctor = req.body
            console.log(doctor)
            const result = await doctorCollection.insertOne(doctor)
            res.send(result)
        })

        // find to all doctor data
        app.get('/doctor',verifyToken,verifyAdmin, async(req,res) => {
            const query = req.query
            const result = await doctorCollection.find(query).toArray()
            res.send(result)
        })
        // doctors delete
        app.delete('/doctor/:email',verifyToken,verifyAdmin, async(req,res) => {
            const email = req.params.email
            console.log(email)
            const filter = {email: email}
            const result = await doctorCollection.deleteOne(filter)
            res.send(result)
        })
    } finally {

    }
}
run().catch(console.dir)

app.get("/", (req, res) => {
    res.send('all is ok')
})

app.listen(port, () => {
    console.log("listening my port is" + port)
})