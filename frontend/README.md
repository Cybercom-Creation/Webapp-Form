# User Details Web App - Frontend

This project is a React application that collects user details such as name, email address, and phone number. Upon submission, it displays a Google Form link and stores the details in a MySQL database, ensuring user uniqueness.

## Project Structure

```
frontend
├── public
│   ├── index.html        # Main HTML file for the React app
│   └── favicon.ico       # Favicon for the web application
├── src
│   ├── components
│   │   ├── Form.js       # Component for collecting user details
│   │   └── SuccessMessage.js # Component for displaying success message and Google Form link
│   ├── App.js            # Main component of the React application
│   ├── index.js          # Entry point for the React application
│   └── styles
│       └── App.css       # Styles for the React application
└── package.json          # Configuration file for the frontend
```

## Getting Started

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd user-details-webapp/frontend
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the application:**
   ```
   npm start
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000`.

## Features

- User-friendly form to collect name, email, and phone number.
- Validation to ensure user uniqueness before submission.
- Displays a Google Form link upon successful submission.

## Technologies Used

- React
- CSS
- Axios (for API calls)

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes. 

## License

This project is licensed under the MIT License.