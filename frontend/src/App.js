import React, { useState } from 'react';
import Form from './components/Form';
import SuccessMessage from './components/SuccessMessage';

function App() {
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleFormSubmit = () => {
        setIsSubmitted(true);
    };

    return (
        <div className="App">
            {isSubmitted ? (
                <SuccessMessage />
            ) : (
                <Form onSubmit={handleFormSubmit} />
            )}
        </div>
    );
}

export default App;