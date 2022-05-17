const express = require('express')
const cors = require('cors')
require('dotenv').config()
const {
    MongoClient,
    ServerApiVersion,
    ObjectId
} = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

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
const run = async () => {
    try {
        await client.connect()
        const serviceCollection = client.db('doctorPortal').collection('services');
        const bookingCollection = client.db('doctorPortal').collection('Booking')
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
            const cursor = serviceCollection.find(query)
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
            const query = { date: date }
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