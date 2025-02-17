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
  return pool
    .query(
      `
      SELECT * FROM users 
      WHERE LOWER(users.email) = LOWER($1);
      `,
      [email] 
    )

    .then ((result) => {
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
      [id]
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
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1);`,
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
      console.log("Error:", err.message);
      throw err;
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


const getAllProperties = function (options, limit = 10) {
  // Setup an array to hold any parameters that may be available for the query.
  const queryParams = [];


  // Start the query with all information that comes before the WHERE clause.
  // WHERE 1=1 eliminate the check for an existing WHERE clause and allows us  to use AND for all queries
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  WHERE 1=1
  `;


  // CITY FILTER
  // //Add the city to the params array and create a WHERE clause for the city.
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `AND LOWER(city) LIKE $${queryParams.length} `;
  }

  //  OWNER ID FILTER
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += `AND owner_id = $${queryParams.length} `;
  }

  // MINIMUM PRICE FILTER
  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    queryString += `AND cost_per_night >= $${queryParams.length} `;
  }

  // MAXIMUM PRICE FILTER
  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100);
    queryString += `AND cost_per_night <= $${queryParams.length} `;
  }


  // Add queries that come after the WHERE and before the HAVING clause.
  queryString += `
  GROUP BY properties.id
  ` ;

  // MINUMUM RATING FILTER
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);

    // Use HAVING for the aggregate function avg() instead of WHERE
    queryString += `HAVING avg(property_reviews.rating) >= $${queryParams.length} `;
  }

   // Add queries that come after the HAVING clause and before the LIMIT.
  queryParams.push(limit);
  queryString += `
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
    `;

  return pool.query(queryString, queryParams)
  .then((res) => res.rows)
  .catch((err) => {
    console.error('Error executing query:', err);
    throw new Error('Database query failed');
  });
};


/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night * 100,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms,
  ];

  const queryString = `
    INSERT INTO properties (
      owner_id,
      title,
      description,
      thumbnail_photo_url,
      cover_photo_url,
      cost_per_night,
      street,
      city,
      province,
      post_code,
      country,
      parking_spaces,
      number_of_bathrooms,
      number_of_bedrooms
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    RETURNING *;  -- This will return the full property record including the auto-generated fields
  `;

  return pool.query(queryString, queryParams)
    .then((res) => res.rows[0]) // Return the newly added property
    .catch((err) => {
      console.error('Error adding property:', err);
      throw err;
    });
};


module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
