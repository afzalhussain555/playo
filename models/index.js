const Sequelize = require('sequelize');
const { DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_DATABASE, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'mysql',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  timezone: "+05:30"
});

const User = sequelize.define('User', {
  username: Sequelize.STRING,
  password: Sequelize.STRING,
  fullName: Sequelize.STRING,
});

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  fromTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'from_time',
  },
  toTime: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'to_time',
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

Event.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'user',
});

const EventAttendee = sequelize.define('EventAttendee', {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  eventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id',
    },
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
});

EventAttendee.belongsTo(Event, {
  foreignKey: "eventId",
  as: "event"
})

module.exports = { sequelize, Event, User, EventAttendee };