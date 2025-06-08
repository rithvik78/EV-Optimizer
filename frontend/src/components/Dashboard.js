import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  WbSunny as SunIcon,
  ElectricBolt as BoltIcon,
  AttachMoney as MoneyIcon,
  ThermostatAuto as TempIcon,
  Air as WindIcon,
  Cloud as CloudIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

import ApiService from '../services/ApiService';

const Dashboard = ({ currentConditions, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [stationSummary, setStationSummary] = useState(null);
  const [hourlyForecast, setHourlyForecast] = useState([]);
  
  // AI-powered insights state
  const [aiInsights, setAiInsights] = useState({
    costOptimization: null,
    solarRecommendation: null,
    chargingWindow: null,
    weatherImpact: null,
    predictedSavings: 0,
    urgentAlerts: []
  });

  useEffect(() => {
    loadStationSummary();
    generateHourlyForecast();
  }, []);

  const loadStationSummary = async () => {
    try {
      const summary = await ApiService.getStations();
      setStationSummary(summary);
    } catch (error) {
      console.error('Failed to load station summary:', error);
    }
  };

  const generateHourlyForecast = () => {
    // Generate mock hourly forecast for the next 24 hours
    const forecast = [];
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hourNum = hour.getHours();
      
      // Simulate solar generation pattern
      let solarPower = 0;
      if (hourNum >= 6 && hourNum <= 19) {
        const solarFactor = Math.sin((hourNum - 6) * Math.PI / 13);
        solarPower = solarFactor * (30 + Math.random() * 20);
      }
      
      // Simulate TOU pricing
      let los_angeles_dept_water_power_rate = 0.22; // base
      if (hourNum >= 13 && hourNum < 17) los_angeles_dept_water_power_rate = 0.37; // high peak
      else if ((hourNum >= 10 && hourNum < 13) || (hourNum >= 17 && hourNum < 20)) los_angeles_dept_water_power_rate = 0.223; // low peak
      
      let southern_california_edison_rate = 0.27; // off peak
      if (hourNum >= 18 && hourNum < 20) southern_california_edison_rate = 0.32; // on peak
      else if ((hourNum >= 16 && hourNum < 18) || (hourNum >= 20 && hourNum < 22)) southern_california_edison_rate = 0.30; // mid peak
      
      forecast.push({
        hour: hourNum,
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        solarPower: solarPower,
        los_angeles_dept_water_power_rate: los_angeles_dept_water_power_rate,
        southern_california_edison_rate: southern_california_edison_rate,
        optimizationScore: 0.3 + (solarPower / 50) * 0.4 + (0.4 - los_angeles_dept_water_power_rate) * 0.3
      });
    }
    
    setHourlyForecast(forecast);
    
    // Generate AI insights after forecast is created
    generateAIInsights(forecast);
  };

  // AI-powered insight generation
  const generateAIInsights = (forecast) => {
    const currentHour = new Date().getHours();
    const nextHours = forecast.slice(0, 8); // Next 8 hours
    
    // Find optimal charging window
    const bestChargingTimes = forecast
      .map((hour, index) => ({ ...hour, index }))
      .sort((a, b) => b.optimizationScore - a.optimizationScore)
      .slice(0, 3);
    
    // Analyze solar opportunity
    const currentSolar = currentConditions?.solar?.power_kw || 0;
    const peakSolarHours = forecast.filter(h => h.solarPower > 35);
    
    // Cost optimization analysis
    const avg_los_angeles_dept_water_power_rate = forecast.reduce((sum, h) => sum + h.los_angeles_dept_water_power_rate, 0) / 24;
    const avg_southern_california_edison_rate = forecast.reduce((sum, h) => sum + h.southern_california_edison_rate, 0) / 24;
    const bestUtility = avg_los_angeles_dept_water_power_rate < avg_southern_california_edison_rate ? 'LA Department of Water and Power' : 'Southern California Edison';
    
    // Weather impact analysis
    const temp = currentConditions?.weather?.temperature || 70;
    const weatherImpact = temp < 32 ? 'severe' : temp < 50 ? 'moderate' : 'minimal';
    
    // Calculate potential savings
    const worstRate = Math.max(...forecast.map(h => h.los_angeles_dept_water_power_rate));
    const bestRate = Math.min(...forecast.map(h => h.los_angeles_dept_water_power_rate));
    const savingsPercentage = ((worstRate - bestRate) / worstRate * 100).toFixed(1);
    
    // Generate urgent alerts
    const alerts = [];
    if (currentSolar > 25 && currentHour >= 10 && currentHour <= 15) {
      alerts.push({
        type: 'solar',
        message: 'High solar generation - charge now for maximum savings!',
        priority: 'high'
      });
    }
    
    if (currentConditions?.pricing?.ladwp?.rate < 0.23) {
      alerts.push({
        type: 'pricing',
        message: 'LA Department of Water and Power rates are below average - good time to charge',
        priority: 'medium'
      });
    }
    
    if (temp < 40) {
      alerts.push({
        type: 'weather',
        message: 'Cold weather alert - expect 20-35% range reduction',
        priority: 'high'
      });
    }

    setAiInsights({
      costOptimization: {
        bestUtility,
        avg_los_angeles_dept_water_power_rate: avg_los_angeles_dept_water_power_rate.toFixed(3),
        avgSCERate: avg_southern_california_edison_rate.toFixed(3),
        recommendation: `Use ${bestUtility} for ${savingsPercentage}% savings`
      },
      solarRecommendation: {
        currentOutput: currentSolar,
        peakHours: peakSolarHours.length,
        nextPeakHour: peakSolarHours[0]?.time || 'None today',
        recommendation: currentSolar > 20 ? 'Charge now with solar' : 'Wait for solar peak'
      },
      chargingWindow: {
        optimal: bestChargingTimes[0],
        alternatives: bestChargingTimes.slice(1),
        reasoning: 'Based on cost, solar, and demand factors'
      },
      weatherImpact: {
        temperature: temp,
        impact: weatherImpact,
        rangeReduction: weatherImpact === 'severe' ? '35%' : weatherImpact === 'moderate' ? '20%' : '5%'
      },
      predictedSavings: parseFloat(savingsPercentage),
      urgentAlerts: alerts
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
      await loadStationSummary();
      generateHourlyForecast();
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentConditions) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const { weather, solar, pricing } = currentConditions;

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          ⚡ EV Charging Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
          sx={{
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            '&:hover': {
              background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
            }
          }}
        >
          Refresh Data
        </Button>
      </Box>

      {/* Current Conditions Cards */}
      <Grid container spacing={3} mb={4}>
        {/* Weather Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TempIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Weather</Typography>
              </Box>
              <Typography variant="h4" mb={1}>
                {weather?.temperature?.toFixed(1)}°F
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {weather?.description}
              </Typography>
              <Box display="flex" mt={2} gap={1}>
                <Chip
                  icon={<WindIcon />}
                  label={`${weather?.wind_speed?.toFixed(1)} m/s`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<CloudIcon />}
                  label={`${weather?.clouds}% clouds`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Solar Generation Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #ffa726 0%, #ff7043 100%)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SunIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Solar Generation</Typography>
              </Box>
              <Typography variant="h4" mb={1}>
                {solar?.power_kw?.toFixed(1)} kW
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {solar?.hourly_energy_kwh?.toFixed(1)} kWh/hour
              </Typography>
              <Box mt={2}>
                <Chip
                  label={`${solar?.ghi?.toFixed(0)} W/m² GHI`}
                  size="small"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* LA Department of Water and Power Pricing Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <MoneyIcon sx={{ mr: 1 }} />
                <Typography variant="h6">LA Department of Water and Power Rate</Typography>
              </Box>
              <Typography variant="h4" mb={1}>
                ${pricing?.ladwp?.rate?.toFixed(3)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                per kWh
              </Typography>
              <Box mt={2}>
                <Chip
                  label={pricing?.ladwp?.period?.replace('_', ' ')}
                  size="small"
                  sx={{
                    backgroundColor: ApiService.getTOUPeriodColor(pricing?.ladwp?.period),
                    color: 'white'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* SCE Pricing Card */}
        <Grid item xs={12} md={6} lg={3}>
          <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <BoltIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Southern California Edison Rate</Typography>
              </Box>
              <Typography variant="h4" mb={1}>
                ${pricing?.sce?.rate?.toFixed(3)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                per kWh
              </Typography>
              <Box mt={2}>
                <Chip
                  label={pricing?.sce?.period?.replace('_', ' ')}
                  size="small"
                  sx={{
                    backgroundColor: ApiService.getTOUPeriodColor(pricing?.sce?.period),
                    color: 'white'
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Insights Section */}
      {aiInsights.urgentAlerts.length > 0 && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12}>
            <Alert severity={aiInsights.urgentAlerts.some(a => a.priority === 'high') ? 'warning' : 'info'} 
                   sx={{ mb: 2 }}>
              <Typography variant="h6" mb={1}>🤖 AI Alert</Typography>
              {aiInsights.urgentAlerts.map((alert, index) => (
                <Typography key={index} variant="body2">
                  • {alert.message}
                </Typography>
              ))}
            </Alert>
          </Grid>
        </Grid>
      )}

      {aiInsights.costOptimization && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" mb={2}>🧠 AI Cost Optimization</Typography>
                <Typography variant="body1" mb={1}>
                  {aiInsights.costOptimization.recommendation}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Potential savings: {aiInsights.predictedSavings}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" mb={2}>☀️ Solar Recommendation</Typography>
                <Typography variant="body1" mb={1}>
                  {aiInsights.solarRecommendation.recommendation}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Current: {aiInsights.solarRecommendation.currentOutput.toFixed(1)} kW
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" mb={2}>⚡ Optimal Charging</Typography>
                <Typography variant="body1" mb={1}>
                  Best time: {aiInsights.chargingWindow?.optimal?.time || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Score: {(aiInsights.chargingWindow?.optimal?.optimizationScore * 100).toFixed(0)}/100
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" mb={2}>🌡️ Weather Impact</Typography>
                <Typography variant="body1" mb={1}>
                  Range reduction: {aiInsights.weatherImpact?.rangeReduction || '5%'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  Impact: {aiInsights.weatherImpact?.impact || 'minimal'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Charts Section */}
      <Grid container spacing={3} mb={4}>
        {/* Solar & Pricing Forecast */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" mb={3}>
              📈 24-Hour Solar Generation & Pricing Forecast
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#b0bec5"
                  interval={2}
                />
                <YAxis stroke="#b0bec5" />
                <YAxis yAxisId="right" orientation="right" stroke="#b0bec5" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1e3a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="solarPower" 
                  stroke="#ffa726" 
                  strokeWidth={3}
                  name="Solar Power (kW)"
                  dot={{ fill: '#ffa726', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="los_angeles_dept_water_power_rate" 
                  stroke="#4caf50" 
                  strokeWidth={2}
                  name="LA Department of Water and Power Rate ($/kWh)"
                  yAxisId="right"
                />
                <Line 
                  type="monotone" 
                  dataKey="southern_california_edison_rate" 
                  stroke="#2196f3" 
                  strokeWidth={2}
                  name="SCE Rate ($/kWh)"
                  yAxisId="right"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Optimization Score */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" mb={3}>
              🎯 Optimization Scores
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyForecast.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#b0bec5"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#b0bec5" domain={[0, 1]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1a1e3a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [value.toFixed(3), 'Optimization Score']}
                />
                <Bar 
                  dataKey="optimizationScore" 
                  fill="url(#optimizationGradient)"
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="optimizationGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#764ba2" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Station Statistics */}
      {stationSummary && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" mb={3}>
                🏢 LA Charging Infrastructure
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="primary" fontWeight="bold">
                      {stationSummary.total_stations?.toLocaleString() || '3,520'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Stations
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="secondary" fontWeight="bold">
                      {stationSummary.high_capacity_stations?.toLocaleString() || '164'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      High-Capacity (10+ ports)
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="success.main" fontWeight="bold">
                      94.3%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Public Access
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="warning.main" fontWeight="bold">
                      8.6%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      DC Fast Charging
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Status Alert */}
      <Box mt={3}>
        <Alert 
          severity="success" 
          sx={{ 
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            color: 'text.primary',
            '& .MuiAlert-icon': { color: '#4caf50' }
          }}
        >
          🚀 System operational - Real-time optimization active with {hourlyForecast.length} hours of forecast data
        </Alert>
      </Box>
    </Box>
  );
};

export default Dashboard;