# User Details Web Application

This project is a web application designed to collect user details such as name, email address, and phone number. The application is structured into two main parts: the backend and the frontend.

## Project Structure

```
user-details-webapp
├── backend
│   ├── src
│   │   ├── controllers
│   │   │   └── userController.js
│   │   ├── models
│   │   │   └── userModel.js
│   │   ├── routes
│   │   │   └── userRoutes.js
│   │   ├── utils
│   │   │   └── db.js
│   │   └── app.js
│   ├── package.json
│   └── README.md
├── frontend
│   ├── public
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src
│   │   ├── components
│   │   │   ├── Form.js
│   │   │   └── SuccessMessage.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── styles
│   │       └── App.css
│   ├── package.json
│   └── README.md
└── README.md
```

## Features

- **User Registration**: Collects user details (name, email, phone number) through a form.
- **Database Storage**: Stores user details in a MySQL database, ensuring uniqueness to prevent duplicate entries.
- **Success Message**: Upon successful submission, displays a message along with a link to a Google Form.

## Getting Started

### Prerequisites

- Node.js
- MySQL

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the backend directory and install dependencies:
   ```
   cd backend
   npm install
   ```

3. Navigate to the frontend directory and install dependencies:
   ```
   cd frontend
   npm install
   ```

### Configuration

- Set up your MySQL database and update the environment variables in the backend to connect to your database:
  - `DB_HOST`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

### Running the Application

1. Start the backend server:
   ```
   cd backend
   node src/app.js
   ```

2. Start the frontend application:
   ```
   cd frontend
   npm start
   ```

## Usage

- Access the application in your web browser at `http://localhost:3000`.
- Fill out the form with your details and submit to see the success message and Google Form link.

## License

This project is licensed under the MIT License.