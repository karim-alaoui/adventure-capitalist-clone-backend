const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// configure database connection
const pool = new Pool({
  user: 'adventure_capitalist_user',
  host: 'localhost',
  database: 'adventure_capitalist_clone',
  password: 'postgres',
  port: 5432,
});

// allow requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Define route handler for GET /api/business/:userId
// this endpoint returns list of businesses
app.get('/api/business/:userId', async (req, res) => {
  //get the user id
  const userId = req.params.userId;
  console.log(userId + " opened the game");
  try {
    // Get capital of user from users table
    const userResult = await pool.query('SELECT capital, last_save FROM users WHERE id = $1', [userId]);
    let capital = 0;
    let last_save = 0;
    let offlineTime = 0;
    let offlineRewards = 0;

    // get the user's capital and last save time
    if (userResult.rows.length === 0) {
      // User not found, insert new record with capital 1000
      await pool.query('INSERT INTO users (id, capital) VALUES ($1, $2)', [userId, 1000]);
      capital = 1000;
      console.log(userId + " is a new user");
    } else {
      // User found, get his capital and last save time
      capital = parseFloat(userResult.rows[0].capital);
      last_save = userResult.rows[0].last_save;
      console.log(userId + "'s last save was " + last_save.toLocaleString());
    }

    // Get list of businesses from businesses table
    const businessResult = await pool.query('SELECT * FROM business ORDER BY unlocking_price ASC');

    // Get records from business_user table (if user is new, there will be no records)
    // business_table stores the progress of a user in a specific business
    const businessUserResult = await pool.query('SELECT * FROM business_user WHERE user_id = $1', [userId]);
    const businessUserMap = new Map();
    businessUserResult.rows.forEach((row) => {
      businessUserMap.set(row.business_id, { current_level: row.current_level, is_managed: row.is_managed });
    });

    // Merge data from businesses and business_user tables
    const businesses = businessResult.rows.map((row) => {
      const business = {
        id: row.id,
        name: row.name,
        unlocking_price: row.unlocking_price,
        current_level: row.current_level,
        base_rewards: row.base_rewards,
        base_upgrading_price: row.base_upgrading_price,
        cooldown: row.cooldown,
        manager_cost: row.manager_cost,
        is_managed: row.is_managed,
      };
      if (businessUserMap.has(Number(row.id))) {
        const userBusiness = businessUserMap.get(Number(row.id));
        business.current_level = userBusiness.current_level;
        business.is_managed = userBusiness.is_managed;
        if(business.is_managed){
          // Calculate the time difference between the last_save time and the current time
          const currentTime = new Date();
          offlineTime = (currentTime.getTime() - last_save.getTime()) / 1000;
          businessReward = userBusiness.current_level * business.base_rewards;
          businessCyclesDoneOffline = Math.floor(offlineTime / business.cooldown);
          BusinessOfflineReward = businessReward * businessCyclesDoneOffline;
          offlineRewards = parseFloat(offlineRewards + BusinessOfflineReward);
        }
      }
      return business;
    });

    // Send response with capital, businesses, and offline rewards
    res.json({ capital, businesses, offlineRewards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post("/api/saveUserData", async (req, res) => {
  
  const { userId, capital, businesses } = req.body;
  console.log(userId + " closed the game");

  // Delete existing businesses for the user
  try {
    await pool.query(
      "DELETE FROM business_user WHERE user_id = $1",
      [userId]
    );
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }

  // Save user capital and saving time to the database
  // Check if user exists
  const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
  if (user.rows.length === 0) {
    // User does not exist, create new user
    try {
      await pool.query(
        "INSERT INTO users (id, capital, last_save) VALUES ($1, $2, NOW())",
        [userId, capital]
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  } else {
    // User exists, update user capital
    try {
      await pool.query(
        "UPDATE users SET capital = $1, last_save = NOW() WHERE id = $2",
        [capital, userId]
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // Save businesses to the database
  for (const business of businesses) {
    try {
      await pool.query(
        "INSERT INTO business_user (user_id, business_id, name, current_level, is_managed) VALUES ($1, $2, $3, $4, $5)",
        [userId, business.id, business.name, business.current_level, business.is_managed]
      );
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  res.json({ message: "Data saved successfully" });
});

//back end port 3003
app.listen(3003, () => {
  console.log('Server listening on port 3003');
});
