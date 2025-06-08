import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress
} from '@mui/material';
import {
  ElectricCar as CarIcon,
  Schedule as ScheduleIcon,
  TrendingUp as OptimizeIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import ApiService from '../services/ApiService';

const ChargingOptimizer = ({ currentConditions }) => {
  const [sessionData, setSessionData] = useState({
    vehicle_type: 'Tesla Model 3',
    energy_needed_kwh: 60,
    session_start: new Date(),
    session_end: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
    utility: 'los_angeles_dept_water_power',
    current_battery_percent: 20,
    target_battery_percent: 90
  });

  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // User Behavior Tracking
  const [predictions, setPredictions] = useState({
    predictedUsage: null,
    behaviorPattern: 'learning',
    recommendations: [],
    efficiencyTrends: [],
    personalizedSchedule: null
  });
  
  const [userLearning, setUserLearning] = useState({
    chargingHistory: [],
    preferredTimes: [],
    costSensitivity: 'medium',
    usagePatterns: []
  });

  const vehicleTypes = [
    { name: 'Tesla Model 3', capacity: 75, efficiency: 4.2 },
    { name: 'Tesla Model Y', capacity: 81, efficiency: 4.1 },
    { name: 'Tesla Model S', capacity: 100, efficiency: 3.8 },
    { name: 'Chevy Bolt', capacity: 65, efficiency: 4.0 },
    { name: 'Nissan Leaf', capacity: 62, efficiency: 4.3 },
    { name: 'BMW i3', capacity: 42, efficiency: 5.6 },
    { name: 'Audi e-tron', capacity: 95, efficiency: 2.9 },
    { name: 'Hyundai Kona Electric', capacity: 64, efficiency: 4.5 }
  ];

  const handleVehicleChange = (vehicleName) => {
    const vehicle = vehicleTypes.find(v => v.name === vehicleName);
    if (vehicle) {
      const energyNeeded = vehicle.capacity * 
        ((sessionData.target_battery_percent - sessionData.current_battery_percent) / 100);
      
      setSessionData(prev => ({
        ...prev,
        vehicle_type: vehicleName,
        energy_needed_kwh: Math.round(energyNeeded)
      }));
    }
  };

  // Optimization Functions
  const predictOptimalTiming = (currentConditions) => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Analyze solar generation patterns
    const solarScore = currentConditions?.solar?.power_kw > 20 ? 0.8 : 0.3;
    
    // Analyze pricing patterns  
    const currentRate = currentConditions?.pricing?.los_angeles_dept_water_power?.rate || 0.25;
    const priceScore = currentRate < 0.25 ? 0.9 : currentRate < 0.30 ? 0.6 : 0.3;
    
    // Consider user historical patterns (simulated)
    const historyScore = userLearning.preferredTimes.includes(currentHour) ? 0.7 : 0.5;
    
    const overallScore = (solarScore * 0.4 + priceScore * 0.4 + historyScore * 0.2);
    
    return {
      score: overallScore,
      recommendation: overallScore > 0.7 ? 'optimal' : overallScore > 0.5 ? 'good' : 'wait',
      reasoning: `Solar: ${(solarScore * 100).toFixed(0)}%, Price: ${(priceScore * 100).toFixed(0)}%, History: ${(historyScore * 100).toFixed(0)}%`
    };
  };

  const generateRecommendations = (sessionData, currentConditions) => {
    const recommendations = [];
    
    // Battery health recommendation
    if (sessionData.target_battery_percent > 85) {
      recommendations.push({
        type: 'battery_health',
        message: 'Consider charging to 80% for better battery longevity',
        priority: 'medium',
        action: 'Adjust target to 80%'
      });
    }
    
    // Cost optimization
    const timing = predictOptimalTiming(currentConditions);
    if (timing.recommendation === 'wait') {
      recommendations.push({
        type: 'cost_optimization',
        message: 'Waiting 2-3 hours could save 15-25% on charging costs',
        priority: 'low',
        action: 'Delay charging'
      });
    }
    
    // Solar opportunity
    if (currentConditions?.solar?.power_kw > 25) {
      recommendations.push({
        type: 'solar_opportunity',
        message: 'High solar generation available - charge now for maximum savings',
        priority: 'high',
        action: 'Charge immediately'
      });
    }
    
    // Smart scheduling based on patterns
    const preferredHour = userLearning.preferredTimes[0];
    if (preferredHour && Math.abs(new Date().getHours() - preferredHour) > 2) {
      recommendations.push({
        type: 'pattern_based',
        message: `Based on your history, you typically charge around ${preferredHour}:00`,
        priority: 'low',
        action: `Schedule for ${preferredHour}:00`
      });
    }
    
    return recommendations;
  };

  const analyzeUserBehavior = (sessionData) => {
    // Simulate learning from user behavior
    const newPreferredTime = new Date(sessionData.session_start).getHours();
    
    setUserLearning(prev => ({
      ...prev,
      preferredTimes: [...new Set([...prev.preferredTimes, newPreferredTime])].slice(-5),
      chargingHistory: [...prev.chargingHistory, {
        timestamp: new Date(),
        vehicle: sessionData.vehicle_type,
        energyNeeded: sessionData.energy_needed_kwh,
        targetBattery: sessionData.target_battery_percent
      }].slice(-20)
    }));
    
    // Update predictions
    const timingPredictions = predictOptimalTiming(currentConditions);
    const recommendations = generateRecommendations(sessionData, currentConditions);
    
    setPredictions(prev => ({
      ...prev,
      recommendations: recommendations,
      behaviorPattern: userLearning.chargingHistory.length > 5 ? 'learned' : 'learning',
      predictedUsage: {
        nextChargeTime: newPreferredTime,
        typicalEnergy: sessionData.energy_needed_kwh,
        efficiency: timingPredictions.score
      }
    }));
  };

  const handleOptimize = async () => {
    if (!sessionData.session_start || !sessionData.session_end) {
      setError('Please select valid start and end times');
      return;
    }

    if (sessionData.session_end <= sessionData.session_start) {
      setError('End time must be after start time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const optimizationRequest = {
        session_start: sessionData.session_start.toISOString(),
        session_end: sessionData.session_end.toISOString(),
        energy_needed_kwh: sessionData.energy_needed_kwh,
        utility: sessionData.utility
      };

      const result = await ApiService.optimizeChargingSession(optimizationRequest);
      
      // Learn from user behavior and generate insights
      analyzeUserBehavior(sessionData);
      
      setOptimization(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateNaiveCost = () => {
    if (!currentConditions) return 0;
    
    const rate = sessionData.utility === 'los_angeles_dept_water_power' 
      ? currentConditions.pricing.ladwp.rate 
      : currentConditions.pricing.sce.rate;
    
    return sessionData.energy_needed_kwh * rate;
  };

  const getSavingsInfo = () => {
    if (!optimization) return null;
    
    const naiveCost = calculateNaiveCost();
    const optimizedCost = optimization.optimization_summary.total_cost;
    const savings = naiveCost - optimizedCost;
    const savingsPercent = (savings / naiveCost) * 100;
    
    return { savings, savingsPercent, naiveCost, optimizedCost };
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight="bold" mb={3}>
        Charging Session Optimizer
      </Typography>

      <Grid container spacing={3}>
        {/* Input Form */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={3} display="flex" alignItems="center">
              <CarIcon sx={{ mr: 1 }} />
              Session Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Vehicle Type</InputLabel>
                  <Select
                    value={sessionData.vehicle_type}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    label="Vehicle Type"
                  >
                    {vehicleTypes.map((vehicle) => (
                      <MenuItem key={vehicle.name} value={vehicle.name}>
                        {vehicle.name} ({vehicle.capacity} kWh)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Current Battery %"
                  type="number"
                  value={sessionData.current_battery_percent}
                  onChange={(e) => setSessionData(prev => ({
                    ...prev,
                    current_battery_percent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                  }))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Target Battery %"
                  type="number"
                  value={sessionData.target_battery_percent}
                  onChange={(e) => setSessionData(prev => ({
                    ...prev,
                    target_battery_percent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                  }))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Energy Needed (kWh)"
                  type="number"
                  value={sessionData.energy_needed_kwh}
                  onChange={(e) => setSessionData(prev => ({
                    ...prev,
                    energy_needed_kwh: Math.max(0, parseFloat(e.target.value) || 0)
                  }))}
                  inputProps={{ min: 0, step: 0.1 }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Utility Provider</InputLabel>
                  <Select
                    value={sessionData.utility}
                    onChange={(e) => setSessionData(prev => ({ ...prev, utility: e.target.value }))}
                    label="Utility Provider"
                  >
                    <MenuItem value="los_angeles_dept_water_power">LA Department of Water and Power</MenuItem>
                    <MenuItem value="southern_california_edison">Southern California Edison</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" mb={1}>Session Start</Typography>
                <DatePicker
                  selected={sessionData.session_start}
                  onChange={(date) => setSessionData(prev => ({ ...prev, session_start: date }))}
                  showTimeSelect
                  dateFormat="MMM d, yyyy h:mm aa"
                  customInput={
                    <TextField 
                      fullWidth 
                      variant="outlined"
                      sx={{ '& input': { color: 'inherit' } }}
                    />
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" mb={1}>Session End</Typography>
                <DatePicker
                  selected={sessionData.session_end}
                  onChange={(date) => setSessionData(prev => ({ ...prev, session_end: date }))}
                  showTimeSelect
                  dateFormat="MMM d, yyyy h:mm aa"
                  customInput={
                    <TextField 
                      fullWidth 
                      variant="outlined"
                      sx={{ '& input': { color: 'inherit' } }}
                    />
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleOptimize}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <OptimizeIcon />}
                  sx={{
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
                    }
                  }}
                >
                  {loading ? 'Optimizing...' : 'Optimize Charging'}
                </Button>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>

        {/* Results */}
        <Grid item xs={12} lg={8}>
          {optimization ? (
            <Box>
              {/* Summary Cards */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)' }}>
                    <CardContent>
                      <Typography variant="h6" display="flex" alignItems="center">
                        <MoneyIcon sx={{ mr: 1 }} />
                        Total Cost
                      </Typography>
                      <Typography variant="h4">
                        {ApiService.formatCurrency(optimization.optimization_summary.total_cost)}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {ApiService.formatCurrency(optimization.optimization_summary.average_rate)}/kWh avg
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' }}>
                    <CardContent>
                      <Typography variant="h6">Solar Offset</Typography>
                      <Typography variant="h4">
                        {optimization.optimization_summary.solar_percentage.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {ApiService.formatEnergy(optimization.optimization_summary.solar_offset_kwh)} solar
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)' }}>
                    <CardContent>
                      <Typography variant="h6">Charging Hours</Typography>
                      <Typography variant="h4">
                        {optimization.optimization_summary.charging_hours}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {ApiService.formatEnergy(optimization.optimization_summary.total_energy_kwh)} total
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)' }}>
                    <CardContent>
                      <Typography variant="h6">Savings</Typography>
                      {(() => {
                        const savingsInfo = getSavingsInfo();
                        return savingsInfo ? (
                          <>
                            <Typography variant="h4">
                              {ApiService.formatCurrency(savingsInfo.savings)}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                              {savingsInfo.savingsPercent.toFixed(1)}% vs immediate
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="h4">--</Typography>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Charging Schedule */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" mb={3} display="flex" alignItems="center">
                  <ScheduleIcon sx={{ mr: 1 }} />
                  Optimized Charging Schedule
                </Typography>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell align="right">Energy (kWh)</TableCell>
                        <TableCell align="right">Rate ($/kWh)</TableCell>
                        <TableCell align="right">Cost</TableCell>
                        <TableCell align="right">Solar (kW)</TableCell>
                        <TableCell align="right">Score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {optimization.charging_schedule.map((hour, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {ApiService.formatDate(hour.datetime)}
                          </TableCell>
                          <TableCell align="right">
                            {ApiService.formatEnergy(hour.energy_kwh)}
                          </TableCell>
                          <TableCell align="right">
                            ${hour.utility_rate.toFixed(3)}
                          </TableCell>
                          <TableCell align="right">
                            {ApiService.formatCurrency(hour.charging_cost)}
                          </TableCell>
                          <TableCell align="right">
                            {ApiService.formatPower(hour.solar_available_kw)}
                          </TableCell>
                          <TableCell align="right">
                            <Box display="flex" alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={hour.optimization_score * 100}
                                sx={{ 
                                  width: 50, 
                                  mr: 1,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: hour.optimization_score > 0.7 ? '#4caf50' : 
                                                   hour.optimization_score > 0.4 ? '#ff9800' : '#f44336'
                                  }
                                }}
                              />
                              <Typography variant="caption">
                                {(hour.optimization_score * 100).toFixed(0)}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Summary */}
                <Box mt={3} p={2} bgcolor="background.paper" borderRadius={2}>
                  <Typography variant="h6" mb={2}>Optimization Summary</Typography>
                  <Typography variant="body2" paragraph>
                    Your {sessionData.vehicle_type} charging session has been optimized for {sessionData.utility === 'los_angeles_dept_water_power' ? 'LA Department of Water and Power' : 'Southern California Edison'} 
                    Time-of-Use rates. The system scheduled {optimization.optimization_summary.charging_hours} hours 
                    of charging to minimize costs while maximizing solar energy utilization.
                  </Typography>
                  
                  {optimization.optimization_summary.solar_percentage > 50 && (
                    <Alert severity="success" sx={{ mt: 1 }}>
                      Excellent solar utilization! Over {optimization.optimization_summary.solar_percentage.toFixed(0)}% 
                      of your charging will be powered by renewable solar energy.
                    </Alert>
                  )}

                  {getSavingsInfo()?.savingsPercent > 10 && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Great savings! You'll save {getSavingsInfo().savingsPercent.toFixed(1)}% compared to 
                      immediate charging during current rates.
                    </Alert>
                  )}
                </Box>
              </Paper>
            </Box>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box>
                <Typography variant="h6" color="text.secondary" mb={2}>
                  Ready to Optimize Your Charging
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter your vehicle details and charging window to get started with smart optimization.
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ChargingOptimizer;