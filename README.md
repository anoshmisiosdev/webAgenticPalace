# webAgenticPalace
SensAI Hackathon

Go to https://github.com/anoshmisiosdev/webAgenticPalace/blob/main/WebXR/README.md

# WebXR Base App

A WebXR application using Spark.js for rendering Gaussian Splats (.spz files) in immersive VR.

## Features

- Loads and renders a Gaussian Splat (.spz) model using Spark.js
- WebXR support for VR experiences
- Uses Three.js for 3D rendering

## Requirements

- A WebXR-compatible browser (e.g., Chrome with WebXR API enabled)
- VR headset or compatible device
- The TestWorld.spz file in the Example folder

## Installation

1. Clone or download the repository.
2. Navigate to the WebXR folder.
3. Install dependencies: `npm install`

## Running the App

1. Start the development server: `npm run dev`
2. Open your browser and go to the provided URL (usually `http://localhost:5173`)
3. Click "Enter XR" to start the VR session and view the splat model.
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