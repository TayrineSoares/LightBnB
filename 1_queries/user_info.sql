-- Select a single user using their email address.
-- Replace '[email protected]' with the user's email to run the query. 

SELECT id, name, email, password
FROM users 
WHERE email = '[email protected]';