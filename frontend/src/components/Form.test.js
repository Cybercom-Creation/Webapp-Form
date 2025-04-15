// import React from 'react';
// import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// import '@testing-library/jest-dom';
// import Form from './Form';

// beforeEach(() => {
//     global.fetch = jest.fn(() =>
//         Promise.resolve({
//             ok: true,
//             json: () => Promise.resolve({ message: 'User created successfully' }),
//         })
//     );
// });

// afterEach(() => {
//     jest.restoreAllMocks();
// });

// describe('Form Component', () => {
//     test('renders the form correctly', () => {
//         render(<Form />);
//         expect(screen.getByText('Submit Your Details')).toBeInTheDocument();
//         expect(screen.getByLabelText('Name:')).toBeInTheDocument();
//         expect(screen.getByLabelText('Email:')).toBeInTheDocument();
//         expect(screen.getByLabelText('Phone Number:')).toBeInTheDocument();
//         expect(screen.getByText('Submit')).toBeInTheDocument();
//     });

//     test('displays error when submitting incomplete form', async () => {
//         render(<Form />);
//         fireEvent.click(screen.getByText('Submit'));
//         screen.debug(); // Logs the current DOM structure
//     });

//     test('submits the form with valid data', async () => {
//         render(<Form />);
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });
//         fireEvent.click(screen.getByText('Submit'));
//         screen.debug(); // Logs the current DOM structure
//     });

//     test('handles screen sharing permission granted', async () => {
//         render(<Form />);
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });
//         fireEvent.click(screen.getByText('Submit')); // Submit the form
//         const agreeButton = await screen.findByText('I Agree');
//         expect(agreeButton).toBeInTheDocument();
//         fireEvent.click(agreeButton); // Click the "I Agree" button
//         // Mock screen sharing permission
//         const mockGetDisplayMedia = jest.fn().mockResolvedValue({
//             getVideoTracks: () => [{ onended: jest.fn() }],
//         });
//         global.navigator.mediaDevices = { getDisplayMedia: mockGetDisplayMedia };

//         await waitFor(() => expect(mockGetDisplayMedia).toHaveBeenCalled());
//         expect(console.log).toHaveBeenCalledWith('Screen sharing started successfully!');
//     });

//     test('handles screen sharing permission denied', async () => {
//         const mockGetDisplayMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));
//         global.navigator.mediaDevices = { getDisplayMedia: mockGetDisplayMedia };

//         render(<Form />);
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });
//         fireEvent.click(screen.getByText('Submit'));

//         const agreeButton = await screen.findByText('I Agree');
//         fireEvent.click(agreeButton);

//         // Wait for the mocked getDisplayMedia to be called
//         await waitFor(() => expect(mockGetDisplayMedia).toHaveBeenCalled());
//         expect(await screen.findByText('You have denied screen-sharing permission.')).toBeInTheDocument();
//     });

//     test('shows warning popup on first violation', async () => {
//         render(<Form />);
//         const agreeButton = await screen.findByText('I Agree'); // Wait for the "I Agree" button to appear
//         fireEvent.click(agreeButton);

//         // Simulate stopping screen sharing
//         const videoTrack = { onended: jest.fn() };
//         const mockGetDisplayMedia = jest.fn().mockResolvedValue({
//             getVideoTracks: () => [videoTrack],
//         });
//         global.navigator.mediaDevices = { getDisplayMedia: mockGetDisplayMedia };

//         videoTrack.onended();
//         expect(await screen.findByText('Warning')).toBeInTheDocument();
//     });

//     test('blocks the test on second violation', async () => {
//         render(<Form />);

//         // Fill in the form fields
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });

//         // Submit the form
//         fireEvent.click(screen.getByText('Submit'));

//         // Wait for the popup to render and find the "I Agree" button
//         const agreeButton = await screen.findByText('I Agree');
//         fireEvent.click(agreeButton);

//         // Simulate two visibilitychange events
//         console.log('Before first visibilitychange event');
//         act(() => {
//             Object.defineProperty(document, 'hidden', { value: true, configurable: true });
//             document.dispatchEvent(new Event('visibilitychange'));
//             console.log('First visibilitychange event triggered');
//         });
//         console.log('After first visibilitychange event');

//         console.log('Before second visibilitychange event');
//         act(() => {
//             Object.defineProperty(document, 'hidden', { value: true, configurable: true });
//             document.dispatchEvent(new Event('visibilitychange'));
//             console.log('Second visibilitychange event triggered');
//         });
//         console.log('After second visibilitychange event');

//         // Debug the DOM to verify the rendered content
//         screen.debug();

//         // Check if the test is blocked
//         expect(await screen.findByText('Access to the Google Form has been blocked!')).toBeInTheDocument();
//     });

//     test('renders the I Agree button after form submission', async () => {
//         render(<Form />);
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });
//         fireEvent.click(screen.getByText('Submit')); // Submit the form

//         // Wait for the popup to render and find the "I Agree" button
//         const agreeButton = await screen.findByText('I Agree');
//         fireEvent.click(agreeButton);
//     });

//     test('renders the I Agree button and handles screen capture permission', async () => {
//         const mockGetDisplayMedia = jest.fn().mockResolvedValue({
//             getVideoTracks: () => [{ onended: jest.fn() }],
//         });
//         global.navigator.mediaDevices = { getDisplayMedia: mockGetDisplayMedia };

//         render(<Form />);

//         // Fill in the form fields
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });

//         // Submit the form
//         fireEvent.click(screen.getByText('Submit'));

//         // Wait for the popup to render and find the "I Agree" button
//         const agreeButton = await screen.findByText('I Agree');
//         expect(agreeButton).toBeInTheDocument();

//         // Click the "I Agree" button
//         fireEvent.click(agreeButton);

//         // Wait for the mocked getDisplayMedia to be called
//         await waitFor(() => expect(mockGetDisplayMedia).toHaveBeenCalled());
//         expect(mockGetDisplayMedia).toHaveBeenCalledTimes(1);
//     });

//     test('blocks the test after two screen-sharing permission denials', async () => {
//         // Mock getDisplayMedia to simulate permission denial
//         const mockGetDisplayMedia = jest.fn()
//             .mockRejectedValueOnce(new Error('Permission denied')) // First denial
//             .mockRejectedValueOnce(new Error('Permission denied')); // Second denial
//         global.navigator.mediaDevices = { getDisplayMedia: mockGetDisplayMedia };

//         render(<Form />);

//         // Fill in the form fields
//         fireEvent.change(screen.getByLabelText('Name:'), { target: { value: 'John Doe' } });
//         fireEvent.change(screen.getByLabelText('Email:'), { target: { value: 'john.doe@example.com' } });
//         fireEvent.change(screen.getByLabelText('Phone Number:'), { target: { value: '1234567890' } });

//         // Submit the form
//         fireEvent.click(screen.getByText('Submit'));

//         // Wait for the instruction popup to render and find the "I Agree" button
//         const agreeButton = await screen.findByText('I Agree');
//         fireEvent.click(agreeButton); // Click the "I Agree" button

//         // Wait for the mocked getDisplayMedia to be called (first denial)
//         await waitFor(() => expect(mockGetDisplayMedia).toHaveBeenCalledTimes(1));

//         // Verify that the warning popup appears
//         expect(await screen.findByText((content) =>
//             content.includes('You have denied screen-sharing permission.')
//         )).toBeInTheDocument();

//         // Close the warning popup
//         fireEvent.click(screen.getByText('Close'));

//         // Click the "I Agree" button again to trigger the second screen capture attempt
//         fireEvent.click(agreeButton);

//         // Wait for the mocked getDisplayMedia to be called again (second denial)
//         await waitFor(() => expect(mockGetDisplayMedia).toHaveBeenCalledTimes(2));

//         // Verify that the test is blocked after the second denial
//         expect(await screen.findByText('Access to the Google Form has been blocked!')).toBeInTheDocument();
//     });
// });