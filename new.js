
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const loanInitiate = require('./loans/initiateLoan');
const loanAmountRoutes = require('./loans/loanAmount');
const loanPaymentRoutes = require('./loans/loanPayment');
const loanLimitRoutes = require('./loans/maxLoanLimit');
const discountRoutes = require('./deposits/discounts');
const homePageRoute = require('./dashboardData/homepage');
const LogModel = require('./auth/models/LogModel');

//auth imports
const {requireAuth, requireAdmin} = require('../../growthspring-backend-main/auth/middleware')
const authRoutes = require('../../growthspring-backend-main/auth/routes')

require('dotenv').config()

//express app
const app = express();

app.use(cors({origin: true , credentials: true}))

//["https://growthspringers.com", "https://www.growthspringers.com", "https://admin.growthspringers.com"]

// Use the express.json() middleware to parse JSON data
app.use(express.json());
app.use(cookieParser())

//connect to mongoDB
const dbURI = process.env.dbURI || 'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';
//'mongodb+srv://blaise1:blaise119976@cluster0.nmt34.mongodb.net/GrowthSpringNew?retryWrites=true&w=majority';


mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async (result) => {

    try {
      app.listen(4000);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error retrieving documents:', error);
    }
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

//register view engine
app.set('view engine', 'ejs');

//middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

//auth routes
app.use('/auth', authRoutes)

//Get discount
app.use(discountRoutes); 

//Auntenticated Routes below (Logged in members)
app.use(requireAuth);
app.use(homePageRoute);

//Admin actions only below
app.use(requireAdmin);
app.use(loanInitiate);
app.use(loanAmountRoutes);
app.use(loanLimitRoutes);
app.use(loanPaymentRoutes);

//Logger
app.post('/log', async (req, res)=>{
    const log = await LogModel.create({page: req.body.page, user: req.user.fullName})
    return res.json({success: true})
})
                        
app.use(photoRouter)
app.use(userRouter)
                        
                    