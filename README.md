# HydroSecure
### IoT-Based Water Flow Monitoring and Early Leak Detection

HydroSecure is a smart water-monitoring system designed to track water flow across a main supply line and a branch line using dual flow sensors. It compares real-time flow readings, detects abnormal differences, and generates leak alerts through a live web dashboard.

The project combines an interactive React dashboard, a FastAPI backend, and simulated sensor data to demonstrate an end-to-end IoT monitoring solution without requiring physical hardware.

## Features

- **Dual-Sensor Monitoring:** Tracks water flow from Sensor A (main supply) and Sensor B (branch line).
- **Real-Time Dashboard:** Displays live flow rates, sensor trends, and system status.
- **Leak Detection:** Identifies flow imbalances using configurable warning and critical thresholds.
- **Consecutive-Sample Validation:** Helps reduce false alerts caused by temporary flow fluctuations.
- **Hysteresis-Based Alert Clearing:** Prevents alerts from repeatedly switching on and off near a threshold.
- **Interactive Flow Comparison:** Visualizes supply and branch flow over time.
- **Live API Integration:** Streams backend readings to the frontend through REST APIs and WebSockets.
- **Simulation Mode:** Demonstrates monitoring and leak-detection behavior without physical sensors.
- **CSV Export:** Supports exporting collected readings for further analysis.
- **Persistent Storage:** Uses SQLite to store application data.

## Dashboard

The HydroSecure dashboard provides:

- Individual flow-rate cards for both sensors
- A live supply-versus-branch flow graph
- Normal-flow status indicators
- Warning and critical leak alerts
- Local simulation and backend simulation modes

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Database | SQLite |
| Communication | REST API, WebSockets |
| Development | Node.js, npm, Python virtual environment |
| Hardware concept | Arduino / ESP32 and dual water-flow sensors |
| Data visualization | Interactive time-series charts |

## System Architecture

```text
Dual Flow Sensors
       |
       v
Water Flow Readings
       |
       v
FastAPI Backend
       |
       +------> Leak Detection Logic
       |
       +------> SQLite Database
       |
       v
REST API + WebSocket
       |
       v
React Dashboard
       |
       +------> Live Flow Monitoring
       +------> Flow Comparison Graph
       +------> Leak Alerts
       +------> CSV Export
```

*The current software simulation can generate readings without physical sensors.*

## Getting Started

### Prerequisites

- Python 3.11 or later
- Node.js 20 or later
- npm

### 1. Clone the repository

```bash
git clone https://github.com/anshiijral/HydroSecure.git
cd HydroSecure
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend API documentation:

http://127.0.0.1:8000/docs

Keep this terminal running.

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the dashboard:

http://localhost:5173

### 4. Run the simulation

1. Open the HydroSecure dashboard.
2. Select **Local sim** to view browser-generated demo readings.
3. Select **Backend** to connect to the FastAPI service.
4. Click **Start API sim** to generate simulated backend readings.
5. Observe the flow comparison graph and leak alerts as readings update.

## Leak Detection Logic

HydroSecure compares the main supply flow with the branch flow.

**Flow difference:**

```text
Flow Difference = Sensor A Flow - Sensor B Flow
```

When the supply flow consistently exceeds the branch flow beyond configured thresholds, the
