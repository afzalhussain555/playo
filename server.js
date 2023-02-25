const express = require('express');
require('dotenv').config();
const jwt = require("jsonwebtoken");
//const JWT_SECRET = "mysecretkey";
const passport = require('passport');
const { Op } = require('sequelize');
//const session = require('express-session');
const bcrypt = require('bcrypt');
const { User, Event, sequelize, EventAttendee } = require('./models');



const app = express();
const PORT = process.env.PORT || 3002;

const passportJWT = require('passport-jwt');
const { Strategy: JWTStrategy, ExtractJwt } = passportJWT;


const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JWTStrategy(jwtOptions, (payload, done) => {
    User.findByPk(payload.userId)
      .then((user) => {
        if (!user) {
          return done(null, false);
        }

        return done(null, user);
      })
      .catch((error) => {
        done(error, false);
      });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Configure middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(passport.initialize());


// Define routes
app.post('/register', async (req, res) => {
  try {
    const { username, password, fullName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create a new user object
    const user = await User.create({
      username,
      fullName,
      password: bcrypt.hashSync(password, 10),
    });

    // Create a JWT token for the user
    const token = jwt.sign({ userId: user.id, username: username, fullName: user.fullName }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Return the user and token as response
    return res.json({ user, token });
  } catch (error) {
    console.error('Error creating user: ', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Check if password is correct
    const passwordMatches = bcrypt.compareSync(password, user.password);
    if (!passwordMatches) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    // Create a JWT token for the user
    const token = jwt.sign({ userId: user.id, username: username, fullName: user.fullName }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Return the user and token as response
    return res.json({ user, token });
  } catch (error) {
    console.error('Error logging in user: ', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/events', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name, fromTime, toTime, capacity } = req.body;
    const event = await Event.create({
      name,
      fromTime,
      toTime,
      capacity,
      createdBy: req.user.id, // use the authenticated user's ID as the createdBy value
    });
    res.json(event);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


app.get('/events', async (req, res) => {
  try {
   
    const events = await Event.findAll();
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/attendees', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { attendeeid, eventid, userId } = req.query;
  const whereClause = {};

  if (attendeeid) whereClause.id = attendeeid;
  if (eventid) whereClause.eventId = eventid;
  if (userId) whereClause.userId = userId;

  try {
    const events = await EventAttendee.findAll({
      include: {
        model: Event,
        where: {
          createdBy: req.user.id
        },
        as: "event",
        required: true
      },
      where: whereClause
    });
    // console.log("Hello")
    // console.log(events);
    // let attendees = events.flatMap(event => event.EventAttendee);
    // console.log(attendees);
    res.json(events);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/attendees', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { eventId } = req.body;

  try {
    // Check if the user has already sent a request to join the event
    const existingRequest = await EventAttendee.findOne({
      where: {
        eventId,
        userId: req.user.id,
        status: {
          [Op.in]: ['PENDING', 'APPROVED']
        }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You have already sent a request to join this event' });
    }

    // Create a new attendee record with the status set to 'requested'
    const attendee = await EventAttendee.create({
      eventId,
      userId: req.user.id,
      status: 'PENDING'
    });

    res.json({ attendee });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/attendees', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { status, attendeeId } = req.body;

  try {
    // Check if the user has already sent a request to join the event
    const events = await EventAttendee.findAll({
      include: {
        model: Event,
        where: {
          createdBy: req.user.id
        },
        as: "event",
        required: true
      },
      where: {
        id: attendeeId
      }
    });
    console.log(events);
    let attendees = events.flatMap(event => event.EventAttendees);
    console.log(attendees);
   
    if (!attendees.length) {
      return res.status(400).json({ message: 'No such request found for your event' });
    }

    // Create a new attendee record with the status set to 'requested'
    const attendee = await EventAttendee.update(
      { status: status },
      { where: { id: attendeeId } }
    )

    res.json({ attendee });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// Connect to the database and start the server
sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log('Server is running on port 3000');
    });
  })
  .catch((error) => {
    console.error('Error connecting to the database: ', error);
  });

// Start the server
// app.listen(PORT, () => console.log(`Server started on port ${PORT}`));