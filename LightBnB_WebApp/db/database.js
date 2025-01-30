const properties = require("./json/properties.json");
const users = require("./json/users.json");

// connects to the database using node-postgres
const { Pool } = require("pg");

const pool = new Pool({
  user: "development",
  password: "development",
  host: "localhost",
  database: "lightbnb",
});


/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */

const getUserWithEmail = (email) => {
  //console.log("Email being queried:", email);
  return pool
    .query(
      `
      SELECT * FROM users 
      WHERE LOWER(users.email) = LOWER($1);
      `,
      [email] //// Pass the email as a parameter
    )

    .then ((result) => {
      //console.log("THIS IS MY RESULT OBJECT", result);
      // result.rows always contains the result of your SQL query
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    })    
    .catch((err) => {
      console.log(err.message);
      throw err;
    });
  };


/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = (id) => {
  return pool
    .query(
      `
      SELECT * FROM users 
      WHERE users.id = $1;
      `, 
      [id] //// Pass the id as a parameter
    )

  .then((result) => {
    if (result.rows.length > 0) {
      return result.rows[0];
    } else {
      return null;
    }
  })    
  .catch((err) => {
    console.log(err.message);
    throw err;
  })
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = (user) => {
  // First, check if the email already exists in the database
  return pool
    .query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1);`,  // Check for an existing user with the same email
      [user.email]
    )
    .then((result) => {
      // If an existing user is found, return an error message
      if (result.rows.length > 0) {
        throw new Error('Email is already in use');
      }

      // If email is not taken, proceed with the user insertion
      return pool
        .query(
        `INSERT INTO users (name, email, password) 
        VALUES ($1, $2, $3) 
        RETURNING *;`,  // Insert the new user and return the inserted user
        [user.name, user.email, user.password]
        );
    })
    .then((result) => {
      const newUser = result.rows[0];  // Get the newly inserted user
      return newUser;  // Return the newly added user
    })
    .catch((err) => {
      console.log("Error:", err.message);  // Log any errors
      throw err;  // Re-throw the error to propagate it
    });
};
/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = (guest_id, limit = 10) => {
  return pool 
    .query(
      `
      SELECT reservations.*, 
      properties.title,
      properties.number_of_bedrooms, 
      properties.number_of_bathrooms, 
      properties.parking_spaces
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      JOIN property_reviews ON properties.id = property_reviews.property_id
      WHERE reservations.guest_id = $1
      GROUP BY properties.id, reservations.id
      ORDER BY reservations.start_date
      LIMIT $2;
      `, [guest_id, limit]
    )
    .then ((result) => {
      //console.log("Query result:", result.rows);  // Log the result for debugging
      if (result.rows.length > 0) {
      return result.rows;
      } else {
        return [];
      }
    })
    .catch((err) => {
      console.log(err.message);
      throw err;
    });
  };
  

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */


const getAllProperties = (options, limit = 10) => {
  return pool
    .query(`SELECT * FROM properties LIMIT $1`, [limit])
    .then((result) => {
      //console.log(result.rows);
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
