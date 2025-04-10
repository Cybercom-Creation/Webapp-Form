# User Details Web App - Backend

This is the backend part of the User Details Web App, which collects user information and stores it in a MySQL database.

## Project Structure

- **src/**: Contains the source code for the backend application.
  - **controllers/**: Contains the user-related logic.
    - `userController.js`: Handles user operations such as creating a new user and checking for uniqueness.
  - **models/**: Contains the data models.
    - `userModel.js`: Defines the structure of user data and methods for database interaction.
  - **routes/**: Contains the API route definitions.
    - `userRoutes.js`: Defines the endpoints for user operations.
  - **utils/**: Contains utility functions and configurations.
    - `db.js`: Establishes a connection to the MySQL database.
  - `app.js`: The entry point for the backend application, setting up the Express server and middleware.

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the backend directory:
   ```
   cd user-details-webapp/backend
   ```

3. Install the dependencies:
   ```
   npm install
   ```

## Environment Variables

Make sure to create a `.env` file in the backend directory with the following variables:

```
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
```

## Running the Application

To start the backend server, run:

```
npm start
```

The server will be running on `http://localhost:3000`.

## API Endpoints

- `POST /api/users`: Create a new user with name, email, and phone number. Ensures user uniqueness.

## License

This project is licensed under the MIT License.