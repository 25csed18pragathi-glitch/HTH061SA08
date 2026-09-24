# FlowSync2.0

FlowSync2.0 is a smart adaptive traffic management system with a real-time traffic simulation, adaptive signal control logic, safety validation, and backend persistence.

## Overview

The system combines:

- React frontend for the operations dashboard and control pages
- Node.js/Express backend for API orchestration and MongoDB persistence
- Python detection service for OpenCV/YOLO analysis when a model is available
- A seeded synthetic traffic generator for reproducible scenarios
- Real-time adaptive signal decisions with safety enforcement

## Architecture

React Frontend
  ↓
Traffic Context / Shared State
  ↓
Simulation + Traffic Input
  ↓
Adaptive Signal Algorithm
  ↓
Safety Validator
  ↓
Signal Control + Event Logging
  ↓
Backend API
  ↓
MongoDB

Video flow:

React
  ↓
Node/Express
  ↓
Python Service
  ↓
OpenCV / YOLO (when available)
  ↓
Vehicle counts + queue estimate
  ↓
Traffic state + adaptive controller

## Frontend stack

- React + Vite
- React Router
- Recharts for charts
- Lucide icons for UI

## Backend stack

- Node.js
- Express
- MongoDB via Mongoose
- Environment-based configuration with .env

## MongoDB

The backend supports real MongoDB persistence through the MONGODB_URI environment variable. If MongoDB is unavailable, the app stays usable in local simulation mode and shows a clear warning instead of fabricating persistence.

## Python service

The Python service resides in the python-service folder and exposes a small Flask API for video analysis. It can run OpenCV + YOLO when the model is installed, otherwise it falls back to the clearly labeled manual estimation flow.

## Simulation architecture

The simulator uses deterministic seeded randomness and scenario definitions for:

- OFF-PEAK
- NORMAL
- RUSH HOUR
- SUDDEN SURGE

The same seed and scenario produce reproducible demand. The surge scenario increases West-bound arrival rates at 30 seconds to test adaptive response.

## Adaptive logic

The adaptive controller calculates priority from:

- density
- queue length
- waiting time
- anti-starvation boost
- emergency and pedestrian safety constraints

The final phase decision is passed through the safety validator before it is applied.

## Run locally

1. Install frontend dependencies:
   npm install
2. Install backend dependencies:
   cd backend && npm install
3. Optional: start the Python service:
   cd python-service && python app.py
4. Start the backend:
   cd backend && npm start
5. Start the frontend:
   npm run dev

## Configuration

The backend environment file is expected to live at backend/.env and should follow the example in backend/.env.example.

## Notes

This project intentionally keeps the working simulation and UI while integrating the missing safety, health-check, and persistence wiring so the system behaves as a connected smart traffic platform rather than a disconnected mock.
