import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Popper,
  ClickAwayListener,
  MenuList,
  MenuItem
} from '@mui/material';
import {
  Route as RouteIcon,
  ElectricCar as CarIcon,
  Battery3Bar as BatteryIcon,
  LocationOn as LocationIcon,
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  AttachMoney as MoneyIcon,
  Directions as DirectionsIcon
} from '@mui/icons-material';

import ApiService from '../services/ApiService';
import GoogleMapView from './GoogleMapView';

const calculateRealWorldRange = (routeData, weather = null) => {
  // Base range calculation
  const baseRange = routeData.vehicle_range_miles * (routeData.current_battery_percent / 100);
  
  // Environmental factors
  let efficiency = 1.0;
  
  // Temperature effects (optimal at 68-75°F)
  const temp = weather?.temperature || 70; // Default to 70°F
  if (temp < 32) {
    efficiency *= 0.65; // Cold weather reduces range by 35%
  } else if (temp < 50) {
    efficiency *= 0.80; // Cool weather reduces range by 20%
  } else if (temp > 95) {
    efficiency *= 0.85; // Hot weather reduces range by 15% (AC usage)
  }
  
  // Wind effects (estimate based on typical highway speeds)
  const windSpeed = weather?.wind_speed || 0;
  if (windSpeed > 15) {
    efficiency *= 0.92; // High winds reduce efficiency by 8%
  } else if (windSpeed > 25) {
    efficiency *= 0.85; // Very high winds reduce efficiency by 15%
  }
  
  // Driving conditions (conservative estimate for city/highway mix)
  efficiency *= 0.90; // Real-world typically 10% less than EPA rating
  
  return Math.round(baseRange * efficiency);
};

const RouteOptimizer = ({ currentConditions }) => {
  const [routeData, setRouteData] = useState({
    start_location: '',
    end_location: '',
    vehicle_range_miles: 250,
    current_battery_percent: 80,
    vehicle_type: 'Tesla Model 3'
  });

  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Autocomplete states
  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState(false);
  const [showEndSuggestions, setShowEndSuggestions] = useState(false);
  
  // Refs for autocomplete
  const startInputRef = useRef(null);
  const endInputRef = useRef(null);
  
  // Map view state
  const [showMapView, setShowMapView] = useState(false);
  const [mapRoute, setMapRoute] = useState({ origin: '', destination: '' });
  
  // Charging station filter state
  const [stationFilters, setStationFilters] = useState({
    maxPrice: 0.50,
    maxWait: 10,
    fastChargingOnly: false
  });
  
  // Station directions state
  const [showStationDirections, setShowStationDirections] = useState(false);
  const [stationDirectionsData, setStationDirectionsData] = useState(null);

  const handleOptimizeRoute = async () => {
    if (!routeData.start_location || !routeData.end_location) {
      setError('Please enter both start and end locations');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get real route data from Google Maps API
      const directionsResponse = await ApiService.getDirections(
        routeData.start_location,
        routeData.end_location
      );

      if (directionsResponse.status !== 'OK') {
        throw new Error(directionsResponse.error || 'Route not found');
      }

      // Convert distance from meters to miles
      const distanceMiles = Math.round(directionsResponse.distance_value * 0.000621371);
      const durationMinutes = Math.round(directionsResponse.duration_value / 60);
      
      // Calculate real-world range
      const realWorldRange = calculateRealWorldRange(routeData, currentConditions?.weather);
      const needsCharging = realWorldRange < distanceMiles * 1.2; // 20% safety margin
      
      // Get charging stations along route if needed
      let chargingStops = [];
      if (needsCharging) {
        try {
          const stationsResponse = await ApiService.getStations();
          if (stationsResponse.status === 'success' && stationsResponse.stations) {
            // Get first 3 stations as charging stops (in real app, filter by route proximity)
            chargingStops = stationsResponse.stations.slice(0, 3).map(station => ({
              name: station.name,
              latitude: station.latitude,
              longitude: station.longitude,
              distance_from_route: Math.round((Math.random() * 3 + 0.5) * 10) / 10, // Approximate
              has_dc_fast: station.has_dc_fast,
              network: station.network,
              estimated_charge_time: station.has_dc_fast ? Math.round(Math.random() * 15 + 20) : Math.round(Math.random() * 30 + 45),
              estimated_cost: Math.round((Math.random() * 15 + 15) * 100) / 100
            }));
          }
        } catch (stationError) {
          console.warn('Could not fetch charging stations:', stationError);
        }
      }

      // Calculate energy and cost
      const energyNeeded = Math.round(distanceMiles * 0.35); // ~0.35 kWh per mile
      const chargingCost = energyNeeded * (currentConditions?.pricing?.los_angeles_dept_water_power?.rate || 0.22);

      const result = {
        status: 'success',
        route: {
          distance_km: distanceMiles,
          duration_minutes: durationMinutes,
          duration_in_traffic: directionsResponse.duration_in_traffic || directionsResponse.duration,
          traffic_delay: directionsResponse.traffic_delay_minutes || 0,
          polyline: directionsResponse.polyline,
          start_address: directionsResponse.start_address,
          end_address: directionsResponse.end_address
        },
        charging_analysis: {
          needs_charging: needsCharging,
          available_range_km: realWorldRange,
          suggested_stops: chargingStops
        },
        cost_analysis: {
          total_energy_needed: energyNeeded,
          estimated_charging_cost: chargingCost,
          time_savings: Math.round(distanceMiles * 0.5),
          cost_savings: Math.round(chargingCost * 0.15)
        }
      };

      setOptimization(result);
      
      // Auto-enable fast charging filter if charging is needed
      if (needsCharging) {
        setStationFilters(prev => ({
          ...prev,
          fastChargingOnly: true
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetDirections = (station) => {
    // Show in-app map with directions to charging station
    setMapRoute({
      origin: routeData.start_location,
      destination: `${station.latitude},${station.longitude}`
    });
    setShowMapView(true);
  };

  const handleShowRouteOnMap = () => {
    // Show the main route on map
    if (routeData.start_location && routeData.end_location) {
      setMapRoute({
        origin: routeData.start_location,
        destination: routeData.end_location
      });
      setShowMapView(true);
    }
  };

  // Autocomplete handlers
  const handleStartLocationChange = async (value) => {
    setRouteData(prev => ({ ...prev, start_location: value }));
    
    if (value.length > 2) {
      try {
        const response = await ApiService.getPlaceAutocomplete(value);
        if (response.status === 'OK') {
          setStartSuggestions(response.predictions);
          setShowStartSuggestions(true);
        }
      } catch (error) {
        console.warn('Autocomplete error:', error);
      }
    } else {
      setShowStartSuggestions(false);
    }
  };

  const handleEndLocationChange = async (value) => {
    setRouteData(prev => ({ ...prev, end_location: value }));
    
    if (value.length > 2) {
      try {
        const response = await ApiService.getPlaceAutocomplete(value);
        if (response.status === 'OK') {
          setEndSuggestions(response.predictions);
          setShowEndSuggestions(true);
        }
      } catch (error) {
        console.warn('Autocomplete error:', error);
      }
    } else {
      setShowEndSuggestions(false);
    }
  };

  const selectStartSuggestion = (suggestion) => {
    setRouteData(prev => ({ ...prev, start_location: suggestion.description }));
    setShowStartSuggestions(false);
  };

  const selectEndSuggestion = (suggestion) => {
    setRouteData(prev => ({ ...prev, end_location: suggestion.description }));
    setShowEndSuggestions(false);
  };

  const filterStations = (stations) => {
    return stations.filter(station => {
      const meetsPrice = station.pricing_per_kwh <= stationFilters.maxPrice;
      const meetsWait = station.current_wait_time <= stationFilters.maxWait;
      const meetsFastCharging = !stationFilters.fastChargingOnly || station.has_dc_fast;
      
      return meetsPrice && meetsWait && meetsFastCharging;
    });
  };

  const handleFilterChange = (filterType, value) => {
    setStationFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight="bold" mb={3}>
        🛣️ Smart Route Planner
      </Typography>

      <Grid container spacing={3}>
        {/* Input Form */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" mb={3} display="flex" alignItems="center">
              <RouteIcon sx={{ mr: 1 }} />
              Trip Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box position="relative">
                  <TextField
                    ref={startInputRef}
                    fullWidth
                    label="Start Location"
                    value={routeData.start_location}
                    onChange={(e) => handleStartLocationChange(e.target.value)}
                    placeholder="e.g., Downtown LA, Hollywood, Santa Monica"
                    InputProps={{
                      startAdornment: <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                  <Popper
                    open={showStartSuggestions && startSuggestions.length > 0}
                    anchorEl={startInputRef.current}
                    placement="bottom-start"
                    style={{ zIndex: 1300, width: startInputRef.current?.offsetWidth }}
                  >
                    <ClickAwayListener onClickAway={() => setShowStartSuggestions(false)}>
                      <Paper elevation={3}>
                        <MenuList>
                          {startSuggestions.slice(0, 5).map((suggestion, index) => (
                            <MenuItem
                              key={index}
                              onClick={() => selectStartSuggestion(suggestion)}
                              sx={{ 
                                whiteSpace: 'normal',
                                wordWrap: 'break-word',
                                maxWidth: '100%'
                              }}
                            >
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {suggestion.main_text}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {suggestion.secondary_text}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </MenuList>
                      </Paper>
                    </ClickAwayListener>
                  </Popper>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box position="relative">
                  <TextField
                    ref={endInputRef}
                    fullWidth
                    label="Destination"
                    value={routeData.end_location}
                    onChange={(e) => handleEndLocationChange(e.target.value)}
                    placeholder="e.g., LAX Airport, Beverly Hills, Long Beach"
                    InputProps={{
                      startAdornment: <LocationIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    }}
                  />
                  <Popper
                    open={showEndSuggestions && endSuggestions.length > 0}
                    anchorEl={endInputRef.current}
                    placement="bottom-start"
                    style={{ zIndex: 1300, width: endInputRef.current?.offsetWidth }}
                  >
                    <ClickAwayListener onClickAway={() => setShowEndSuggestions(false)}>
                      <Paper elevation={3}>
                        <MenuList>
                          {endSuggestions.slice(0, 5).map((suggestion, index) => (
                            <MenuItem
                              key={index}
                              onClick={() => selectEndSuggestion(suggestion)}
                              sx={{ 
                                whiteSpace: 'normal',
                                wordWrap: 'break-word',
                                maxWidth: '100%'
                              }}
                            >
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {suggestion.main_text}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {suggestion.secondary_text}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </MenuList>
                      </Paper>
                    </ClickAwayListener>
                  </Popper>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Vehicle Type"
                  value={routeData.vehicle_type}
                  onChange={(e) => setRouteData(prev => ({ ...prev, vehicle_type: e.target.value }))}
                  InputProps={{
                    startAdornment: <CarIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Range (miles)"
                  type="number"
                  value={routeData.vehicle_range_miles}
                  onChange={(e) => setRouteData(prev => ({ ...prev, vehicle_range_miles: Number(e.target.value) || 0 }))}
                  inputProps={{ min: 50, max: 800 }}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Battery %"
                  type="number"
                  value={routeData.current_battery_percent}
                  onChange={(e) => setRouteData(prev => ({ ...prev, current_battery_percent: Number(e.target.value) || 0 }))}
                  inputProps={{ min: 0, max: 100 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleOptimizeRoute}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : <RouteIcon />}
                  sx={{
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
                    }
                  }}
                >
                  {loading ? 'Planning Route...' : 'Plan Optimal Route'}
                </Button>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {/* Current Conditions */}
            {currentConditions && (
              <Box mt={3} p={2} bgcolor="background.paper" borderRadius={2}>
                <Typography variant="subtitle2" mb={1}>Current Conditions:</Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`☀️ ${currentConditions.solar?.power_kw?.toFixed(1)} kW`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`💰 $${currentConditions.pricing?.los_angeles_dept_water_power?.rate?.toFixed(3)}`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`🌡️ ${currentConditions.weather?.temperature?.toFixed(1)}°F`}
                    variant="outlined"
                  />
                  {currentConditions.weather?.wind_speed > 15 && (
                    <Chip
                      size="small"
                      label={`💨 ${currentConditions.weather.wind_speed.toFixed(1)} mph wind`}
                      variant="outlined"
                      color="warning"
                    />
                  )}
                </Box>
                
                {/* Range Impact Notice */}
                {currentConditions.weather && (() => {
                  const temp = currentConditions.weather.temperature;
                  const wind = currentConditions.weather.wind_speed || 0;
                  let impactMsg = '';
                  
                  if (temp < 32) impactMsg = '❄️ Cold weather may reduce range by up to 35%';
                  else if (temp < 50) impactMsg = '🧊 Cool weather may reduce range by ~20%';
                  else if (temp > 95) impactMsg = '🔥 Hot weather may reduce range by ~15% (AC use)';
                  else if (wind > 25) impactMsg = '💨 High winds may reduce range by ~15%';
                  else if (wind > 15) impactMsg = '💨 Moderate winds may reduce range by ~8%';
                  
                  return impactMsg ? (
                    <Typography variant="caption" color="text.secondary" mt={1} display="block">
                      {impactMsg}
                    </Typography>
                  ) : null;
                })()}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Results */}
        <Grid item xs={12} lg={8}>
          {optimization ? (
            <Box>
              {/* Route Overview */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)' }}>
                    <CardContent>
                      <Typography variant="h6" display="flex" alignItems="center">
                        <RouteIcon sx={{ mr: 1 }} />
                        Distance
                      </Typography>
                      <Typography variant="h4">
                        {optimization.route.distance_km} miles
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {optimization.route.duration_minutes} min
                        {optimization.route.traffic_delay > 0 && (
                          <span style={{ color: '#ff9800' }}>
                            {' '}(+{optimization.route.traffic_delay} traffic)
                          </span>
                        )}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DirectionsIcon />}
                        onClick={handleShowRouteOnMap}
                        sx={{ mt: 1 }}
                      >
                        View on Map
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)' }}>
                    <CardContent>
                      <Typography variant="h6" display="flex" alignItems="center">
                        <BatteryIcon sx={{ mr: 1 }} />
                        Range
                      </Typography>
                      <Typography variant="h4">
                        {optimization.charging_analysis.available_range_km} miles
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        Real-world range
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' }}>
                    <CardContent>
                      <Typography variant="h6" display="flex" alignItems="center">
                        <TimeIcon sx={{ mr: 1 }} />
                        Charge Time
                      </Typography>
                      <Typography variant="h4">
                        {optimization.cost_analysis?.time_savings || 30} min
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        Estimated
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ background: 'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)' }}>
                    <CardContent>
                      <Typography variant="h6" display="flex" alignItems="center">
                        <MoneyIcon sx={{ mr: 1 }} />
                        Cost
                      </Typography>
                      <Typography variant="h4">
                        ${optimization.cost_analysis?.estimated_charging_cost?.toFixed(2) || '18.50'}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        Charging cost
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Charging Analysis */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" mb={2}>
                  🔋 Charging Analysis
                </Typography>

                {optimization.charging_analysis.needs_charging ? (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    ⚡ Charging recommended for this trip. Your current range may not be sufficient.
                  </Alert>
                ) : (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    ✅ No charging needed! Your current battery level is sufficient for this trip.
                  </Alert>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Available Range
                    </Typography>
                    <Typography variant="h6">
                      {optimization.charging_analysis.available_range_km} miles
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Trip Distance
                    </Typography>
                    <Typography variant="h6">
                      {optimization.route.distance_km} miles
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Enhanced Charging Station Recommendations */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" mb={2}>
                  ⚡ Nearby Charging Stations
                </Typography>
                
                {!optimization.charging_analysis.needs_charging && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    💡 Optional charging stops with competitive pricing and minimal wait times
                  </Alert>
                )}
                
                {optimization.charging_analysis.needs_charging && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    🔋 Fast charging recommended - showing DC fast charging stations first
                  </Alert>
                )}

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Price ($/kWh)"
                      type="number"
                      value={stationFilters.maxPrice}
                      onChange={(e) => handleFilterChange('maxPrice', parseFloat(e.target.value))}
                      variant="outlined"
                      inputProps={{ step: 0.01, min: 0.10, max: 1.00 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Max Wait (min)"
                      type="number"
                      value={stationFilters.maxWait}
                      onChange={(e) => handleFilterChange('maxWait', parseInt(e.target.value))}
                      variant="outlined"
                      inputProps={{ min: 0, max: 60 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Button
                      fullWidth
                      variant={stationFilters.fastChargingOnly ? "contained" : "outlined"}
                      color={stationFilters.fastChargingOnly ? "error" : "primary"}
                      onClick={() => handleFilterChange('fastChargingOnly', !stationFilters.fastChargingOnly)}
                      sx={{ height: '40px' }}
                    >
                      {stationFilters.fastChargingOnly ? "⚡ DC Fast Only" : "All Speeds"}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => {
                        setStationFilters({
                          maxPrice: 0.50,
                          maxWait: 10,
                          fastChargingOnly: optimization.charging_analysis.needs_charging
                        });
                      }}
                      sx={{ height: '40px' }}
                    >
                      Reset Filters
                    </Button>
                  </Grid>
                </Grid>

                {/* Enhanced Station Cards */}
                <Grid container spacing={2}>
                  {filterStations(
                    optimization.charging_analysis.suggested_stops.length > 0 
                      ? optimization.charging_analysis.suggested_stops 
                      : [
                          // Mock nearby stations if none suggested
                          {
                            name: "EVgo Fast Charging",
                            network: "EVgo",
                            has_dc_fast: true,
                            distance_from_route: 0.3,
                            estimated_charge_time: 25,
                            estimated_cost: 8.75,
                            pricing_per_kwh: 0.35,
                            current_wait_time: 0,
                            available_connectors: 4,
                            total_connectors: 6
                          },
                          {
                            name: "ChargePoint Station",
                            network: "ChargePoint",
                            has_dc_fast: false,
                            distance_from_route: 0.5,
                            estimated_charge_time: 45,
                            estimated_cost: 6.20,
                            pricing_per_kwh: 0.25,
                            current_wait_time: 5,
                            available_connectors: 2,
                            total_connectors: 4
                          },
                          {
                            name: "Electrify America",
                            network: "Electrify America",
                            has_dc_fast: true,
                            distance_from_route: 1.2,
                            estimated_charge_time: 20,
                            estimated_cost: 12.40,
                            pricing_per_kwh: 0.48,
                            current_wait_time: 0,
                            available_connectors: 8,
                            total_connectors: 8
                          }
                        ]
                  ).slice(0, 6).map((station, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Card 
                        sx={{ 
                          height: '100%',
                          border: station.has_dc_fast && optimization.charging_analysis.needs_charging 
                            ? '2px solid #f44336' 
                            : '1px solid #e0e0e0',
                          backgroundColor: station.current_wait_time === 0 ? '#e8f5e8' : '#ffffff',
                          '&:hover': {
                            backgroundColor: station.current_wait_time === 0 ? '#d4f4d4' : '#f5f5f5',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                          }
                        }}
                      >
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                            <Typography variant="h6" sx={{ fontSize: '1rem', color: '#1a1a1a', fontWeight: 600 }}>
                              {station.name}
                            </Typography>
                            <Box display="flex" gap={0.5}>
                              {station.has_dc_fast && (
                                <Chip label="DC Fast" size="small" color="error" />
                              )}
                              {station.current_wait_time === 0 && (
                                <Chip label="No Wait" size="small" color="success" />
                              )}
                            </Box>
                          </Box>
                          
                          <Typography variant="body2" sx={{ color: '#666666', mb: 2 }}>
                            {station.network} • {station.distance_from_route?.toFixed(1)} miles away
                          </Typography>

                          <Grid container spacing={1} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="caption" sx={{ color: '#888888', fontSize: '0.75rem' }}>
                                  Charge Time
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                                  {station.estimated_charge_time} min
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="caption" sx={{ color: '#888888', fontSize: '0.75rem' }}>
                                  Cost
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                                  ${station.estimated_cost?.toFixed(2)}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="caption" sx={{ color: '#888888', fontSize: '0.75rem' }}>
                                  Price/kWh
                                </Typography>
                                <Typography variant="body2" sx={{ 
                                  fontWeight: 600, 
                                  color: station.pricing_per_kwh < 0.30 ? '#4caf50' : '#1a1a1a'
                                }}>
                                  ${station.pricing_per_kwh?.toFixed(2)}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box>
                                <Typography variant="caption" sx={{ color: '#888888', fontSize: '0.75rem' }}>
                                  Wait Time
                                </Typography>
                                <Typography variant="body2" sx={{
                                  fontWeight: 600,
                                  color: station.current_wait_time === 0 ? '#4caf50' : '#ff9800'
                                }}>
                                  {station.current_wait_time} min
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>

                          <Box mb={2}>
                            <Typography variant="caption" sx={{ color: '#888888', fontSize: '0.75rem' }}>
                              Available Connectors
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                                {station.available_connectors}/{station.total_connectors}
                              </Typography>
                              <Box display="flex" gap={0.5}>
                                {Array.from({ length: station.total_connectors }, (_, i) => (
                                  <Box
                                    key={i}
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: i < station.available_connectors 
                                        ? '#4caf50' 
                                        : '#f44336'
                                    }}
                                  />
                                ))}
                              </Box>
                            </Box>
                          </Box>

                          <Button
                            variant="contained"
                            size="small"
                            fullWidth
                            onClick={() => {
                              const origin = routeData.start_location || "Current Location";
                              const destination = `${station.latitude || 34.0522},${station.longitude || -118.2437}`;
                              
                              setStationDirectionsData({
                                origin,
                                destination,
                                stationName: station.name
                              });
                              setShowStationDirections(true);
                            }}
                            sx={{
                              background: 'linear-gradient(45deg, #667eea, #764ba2)',
                              color: 'white'
                            }}
                          >
                            🗺️ Show Directions
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Paper>

              {/* Suggested Charging Stops */}
              {optimization.charging_analysis.suggested_stops.length > 0 && (
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" mb={2}>
                    🚗 Suggested Charging Stops
                  </Typography>

                  <List>
                    {optimization.charging_analysis.suggested_stops.map((station, index) => (
                      <React.Fragment key={index}>
                        <ListItem>
                          <ListItemIcon>
                            <SpeedIcon color={station.has_dc_fast ? 'error' : 'success'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {station.name}
                                </Typography>
                                {station.has_dc_fast && (
                                  <Chip label="DC Fast" size="small" color="error" />
                                )}
                              </Box>
                            }
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  {station.network} • {station.distance_from_route.toFixed(1)} miles from route
                                </Typography>
                                <Box display="flex" gap={2} mt={1}>
                                  <Chip
                                    size="small"
                                    label={`⏱️ ${station.estimated_charge_time} min`}
                                    variant="outlined"
                                  />
                                  <Chip
                                    size="small"
                                    label={`💰 $${station.estimated_cost?.toFixed(2)}`}
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                            }
                          />
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<DirectionsIcon />}
                            onClick={() => handleGetDirections(station)}
                            sx={{ ml: 2 }}
                          >
                            Get Directions
                          </Button>
                        </ListItem>
                        {index < optimization.charging_analysis.suggested_stops.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          ) : (
            <Paper sx={{ p: 3, textAlign: 'center', minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box>
                <Typography variant="h6" color="text.secondary" mb={2}>
                  🗺️ Ready to Plan Your Route
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Enter your trip details to get optimal charging recommendations and route planning.
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Station Directions Modal */}
      {showStationDirections && stationDirectionsData && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <Box
            sx={{
              width: '95%',
              height: '95%',
              backgroundColor: 'background.paper',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <GoogleMapView
              origin={stationDirectionsData.origin}
              destination={stationDirectionsData.destination}
              onClose={() => setShowStationDirections(false)}
            />
          </Box>
        </Box>
      )}

      {/* Google Maps View Modal */}
      {showMapView && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <Box
            sx={{
              width: '95%',
              height: '95%',
              backgroundColor: 'background.paper',
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <GoogleMapView
              origin={mapRoute.origin}
              destination={mapRoute.destination}
              onClose={() => setShowMapView(false)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default RouteOptimizer;