# WebXR Base App

A basic WebXR application using Three.js for immersive VR experiences.

## Features

- Checks for WebXR support
- Simple VR scene with a rotating cube
- Enter/Exit VR session

## Requirements

- A WebXR-compatible browser (e.g., Chrome with WebXR API enabled)
- VR headset or compatible device

## Installation

1. Clone or download the repository.
2. Navigate to the WebXR folder.
3. Install dependencies: `npm install`

## Running the App

1. Start the development server: `npm start`
2. Open your browser and go to `http://localhost:8080`
3. Click "Enter XR" to start the VR session.

## Usage

- The app displays a green rotating cube in VR.
- Use VR controls to interact.

## Development

- `index.html`: Main HTML file
- `app.js`: JavaScript code for WebXR and Three.js
- Modify `app.js` to add more 3D objects or interactions.

## Notes

- WebXR requires HTTPS in production, but works on localhost for development.
- Ensure your browser supports WebXR and has the necessary flags enabled.