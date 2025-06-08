# EV Charging Optimization System

A comprehensive web application for optimizing electric vehicle charging schedules in Los Angeles, integrating real-time solar generation, weather data, and utility Time-of-Use (TOU) pricing to minimize charging costs and maximize renewable energy usage.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend│    │   Flask Backend  │    │  External APIs  │
│                 │◄──►│                  │◄──►│                 │
│ • Dashboard     │    │ • ML Models      │    │ • Weather API   │
│ • Optimizer     │    │ • Data Processing│    │ • Solar API     │
│ • Maps          │    │ • API Endpoints  │    │ • Google Maps   │
│ • Chat          │    │ • Real-time Data │    │ • Claude API     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                        ┌──────────────────┐
                        │   Data Storage   │
                        │                  │
                        │ • EV Stations    │
                        │ • ML Models      │
                        │ • Configuration  │
                        └──────────────────┘
```

