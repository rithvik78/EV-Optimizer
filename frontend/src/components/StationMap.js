import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  Slider,
  Popper,
  ClickAwayListener,
  MenuList,
  MenuItem
} from '@mui/material';
import {
  MyLocation as LocationIcon,
  ElectricCar as CarIcon,
  Speed as FastIcon,
  Public as PublicIcon,
  Business as PrivateIcon
} from '@mui/icons-material';

import ApiService from '../services/ApiService';
import GoogleMapView from './GoogleMapView';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different station types
const createCustomIcon = (type) => {
  const colors = {
    user: '#2196f3',
    public_fast: '#f44336',
    public_slow: '#4caf50',
    private: '#ff9800'
  };
  
  return new L.DivIcon({
    className: 'custom-div-icon',
    html: `<div style="
      background-color: ${colors[type]};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: white;
      font-weight: bold;
    ">${type === 'user' ? '📍' : '⚡'}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

// Component to handle map location updates
const MapController = ({ center, userLocation }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], 12);
    }
  }, [center, map]);
  
  return null;
};

const StationMap = ({ currentConditions }) => {
  const mapRef = useRef();
  const [stations, setStations] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 }); // LA center
  const [filters, setFilters] = useState({
    showPublic: true,
    showPrivate: false,
    showDCFast: true,
    showLevel2: true
  });
  const [showDirections, setShowDirections] = useState(false);
  const [directionsData, setDirectionsData] = useState(null);
  
  // Autocomplete state
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationInputRef = useRef(null);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setMapCenter(location);
          loadNearbyStations(location.lat, location.lng);
          setLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setError('Could not get your location. Using Los Angeles center.');
          loadNearbyStations(mapCenter.lat, mapCenter.lng);
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
      loadNearbyStations(mapCenter.lat, mapCenter.lng);
    }
  };

  // Autocomplete handler
  const handleLocationChange = async (value) => {
    setLocationSearch(value);
    
    if (value.length > 2) {
      try {
        const response = await ApiService.getPlaceAutocomplete(value);
        if (response.status === 'OK') {
          setLocationSuggestions(response.predictions);
          setShowLocationSuggestions(true);
        }
      } catch (error) {
        console.warn('Autocomplete error:', error);
        setShowLocationSuggestions(false);
      }
    } else {
      setShowLocationSuggestions(false);
    }
  };

  const selectLocationSuggestion = (suggestion) => {
    setLocationSearch(suggestion.description);
    setShowLocationSuggestions(false);
    // Auto-search when suggestion is selected
    searchLocationBySuggestion(suggestion);
  };

  const searchLocationBySuggestion = async (suggestion) => {
    setLoading(true);
    setError(null);
    
    try {
      // For autocomplete suggestions, use the exact description provided
      const searchUrls = [
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suggestion.description)}&limit=3&countrycodes=us`,
        // Fallback: try with just the main part of the suggestion
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(suggestion.description.split(',')[0])}&limit=3&bounded=1&viewbox=-118.6682,34.3373,-118.1553,33.7037`
      ];

      let foundLocation = null;

      for (const searchUrl of searchUrls) {
        try {
          const response = await fetch(searchUrl);
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Find the best match (prefer results in LA area)
            const laArea = data.find(result => {
              const lat = parseFloat(result.lat);
              const lon = parseFloat(result.lon);
              return lat >= 33.7037 && lat <= 34.3373 && lon >= -118.6682 && lon <= -118.1553;
            });
            
            foundLocation = laArea || data[0];
            break;
          }
        } catch (attemptError) {
          console.warn('Suggestion search attempt failed:', attemptError);
          continue;
        }
      }

      if (foundLocation) {
        const location = {
          lat: parseFloat(foundLocation.lat),
          lng: parseFloat(foundLocation.lon)
        };
        setUserLocation(location);
        setMapCenter(location);
        loadNearbyStations(location.lat, location.lng);
        setError(null);
      } else {
        setError(`Could not locate "${suggestion.description}". Please try a different search.`);
      }
    } catch (error) {
      console.error('Suggestion search error:', error);
      setError('Search failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const searchLocation = async () => {
    if (!locationSearch.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Smart search logic - don't add location if already included
      let searchQuery = locationSearch.trim();
      const hasLocationInfo = /california|ca|los angeles|la|usa/i.test(searchQuery);
      
      if (!hasLocationInfo) {
        searchQuery += ', Los Angeles, CA';
      }
      
      // Try multiple search strategies
      const searchAttempts = [
        // First attempt: Original search
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=3&countrycodes=us`,
        // Second attempt: Just the search term without additional location
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch.trim())}&limit=3&countrycodes=us`,
        // Third attempt: Search specifically in Los Angeles area
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearch.trim())}&limit=3&bounded=1&viewbox=-118.6682,34.3373,-118.1553,33.7037`
      ];

      let foundLocation = null;

      for (const searchUrl of searchAttempts) {
        try {
          console.log('Trying search:', searchUrl);
          const response = await fetch(searchUrl);
          const data = await response.json();
          
          if (data && data.length > 0) {
            // Find the best match (prefer results in LA area)
            const laArea = data.find(result => {
              const lat = parseFloat(result.lat);
              const lon = parseFloat(result.lon);
              // LA area bounds
              return lat >= 33.7037 && lat <= 34.3373 && lon >= -118.6682 && lon <= -118.1553;
            });
            
            foundLocation = laArea || data[0];
            console.log('Found location:', foundLocation);
            break;
          }
        } catch (attemptError) {
          console.warn('Search attempt failed:', attemptError);
          continue;
        }
      }
      
      if (foundLocation) {
        const location = {
          lat: parseFloat(foundLocation.lat),
          lng: parseFloat(foundLocation.lon)
        };
        setUserLocation(location);
        setMapCenter(location);
        loadNearbyStations(location.lat, location.lng);
        setError(null); // Clear any previous errors
      } else {
        setError(`Location "${locationSearch}" not found. Try searching for landmarks, addresses, or neighborhoods in Los Angeles.`);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Search failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyStations = async (lat, lng) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.getNearbyStations(lat, lng, searchRadius, 50);
      setStations(response.stations || []);
    } catch (err) {
      setError('Unable to load real stations. Showing demo data.');
      generateMockStations(lat, lng);
    } finally {
      setLoading(false);
    }
  };

  const generateMockStations = (centerLat, centerLng) => {
    const mockStations = [];
    const stationTypes = ['ChargePoint', 'EVgo', 'Electrify America', 'Tesla Supercharger', 'Blink'];
    
    for (let i = 0; i < 25; i++) {
      const lat = centerLat + (Math.random() - 0.5) * 0.1;
      const lng = centerLng + (Math.random() - 0.5) * 0.1;
      const distance = Math.sqrt((lat - centerLat)**2 + (lng - centerLng)**2) * 69; // rough miles
      
      mockStations.push({
        id: `mock_${i}`,
        name: `${stationTypes[i % stationTypes.length]} Station ${i + 1}`,
        latitude: lat,
        longitude: lng,
        distance_miles: distance,
        total_ports: Math.floor(Math.random() * 8) + 2,
        has_dc_fast: Math.random() > 0.5,
        is_public: Math.random() > 0.2,
        network: stationTypes[i % stationTypes.length],
        address: `${Math.floor(Math.random() * 9999)} Demo St, Los Angeles, CA`
      });
    }
    setStations(mockStations);
  };

  const handleFilterChange = (filterType) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }));
  };

  const getFilteredStations = () => {
    return stations.filter(station => {
      if (!filters.showPublic && station.is_public) return false;
      if (!filters.showPrivate && !station.is_public) return false;
      if (!filters.showDCFast && station.has_dc_fast) return false;
      if (!filters.showLevel2 && !station.has_dc_fast) return false;
      return true;
    });
  };

  const getStationIcon = (station) => {
    if (station.is_public) {
      return station.has_dc_fast ? 'public_fast' : 'public_slow';
    } else {
      return 'private';
    }
  };

  // Load initial data
  useEffect(() => {
    loadNearbyStations(mapCenter.lat, mapCenter.lng);
  }, [searchRadius]);

  const filteredStations = getFilteredStations();

  return (
    <Box>
      <Typography variant="h4" component="h1" fontWeight="bold" mb={3}>
        🗺️ EV Charging Station Map
      </Typography>

      <Grid container spacing={3}>
        {/* Controls */}
        <Grid item xs={12} lg={3}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" mb={2}>
              🔍 Search Controls
            </Typography>

            <Box position="relative" sx={{ mb: 2 }}>
              <TextField
                fullWidth
                ref={locationInputRef}
                label="Search Location"
                placeholder="e.g., LAX, Santa Monica, Beverly Hills, Downtown LA..."
                value={locationSearch}
                onChange={(e) => handleLocationChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchLocation()}
                onFocus={() => locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                helperText="Try: LAX, Airport, Hollywood, Venice Beach, UCLA, Downtown"
              />
              
              {/* Autocomplete Suggestions */}
              <Popper
                open={showLocationSuggestions}
                anchorEl={locationInputRef.current}
                placement="bottom-start"
                style={{ zIndex: 1300, width: locationInputRef.current?.offsetWidth }}
              >
                <ClickAwayListener onClickAway={() => setShowLocationSuggestions(false)}>
                  <Paper sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <MenuList>
                      {locationSuggestions.map((suggestion, index) => (
                        <MenuItem
                          key={index}
                          onClick={() => selectLocationSuggestion(suggestion)}
                          sx={{ whiteSpace: 'normal', wordWrap: 'break-word' }}
                        >
                          <Typography variant="body2">
                            {suggestion.description}
                          </Typography>
                        </MenuItem>
                      ))}
                    </MenuList>
                  </Paper>
                </ClickAwayListener>
              </Popper>
            </Box>

            {/* Error Message - positioned right after search input */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Button
              fullWidth
              variant="contained"
              onClick={searchLocation}
              disabled={!locationSearch.trim() || loading}
              sx={{ mb: 1, background: 'linear-gradient(45deg, #667eea, #764ba2)' }}
            >
              Search Location
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<LocationIcon />}
              onClick={getCurrentLocation}
              disabled={loading}
              sx={{ mb: 2 }}
            >
              Use My Location
            </Button>

            <Typography variant="subtitle2" mb={1}>
              Search Radius: {searchRadius} miles
            </Typography>
            <Slider
              value={searchRadius}
              onChange={(e, value) => setSearchRadius(value)}
              min={1}
              max={30}
              marks={[
                { value: 3, label: '3mi' },
                { value: 15, label: '15mi' },
                { value: 30, label: '30mi' }
              ]}
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle2" mb={2}>
              Station Filters
            </Typography>

            <Box display="flex" flexDirection="column" gap={1}>
              <Chip
                icon={<PublicIcon />}
                label={`Public (${stations.filter(s => s.is_public).length})`}
                clickable
                color={filters.showPublic ? 'primary' : 'default'}
                onClick={() => handleFilterChange('showPublic')}
              />
              <Chip
                icon={<PrivateIcon />}
                label={`Private (${stations.filter(s => !s.is_public).length})`}
                clickable
                color={filters.showPrivate ? 'primary' : 'default'}
                onClick={() => handleFilterChange('showPrivate')}
              />
              <Chip
                icon={<FastIcon />}
                label={`DC Fast (${stations.filter(s => s.has_dc_fast).length})`}
                clickable
                color={filters.showDCFast ? 'error' : 'default'}
                onClick={() => handleFilterChange('showDCFast')}
              />
              <Chip
                icon={<CarIcon />}
                label={`Level 2 (${stations.filter(s => !s.has_dc_fast).length})`}
                clickable
                color={filters.showLevel2 ? 'success' : 'default'}
                onClick={() => handleFilterChange('showLevel2')}
              />
            </Box>

            <Box mt={3} p={2} bgcolor="background.paper" borderRadius={2}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredStations.length} of {stations.length} stations
              </Typography>
            </Box>

            {loading && (
              <Box display="flex" alignItems="center" gap={1} mt={2}>
                <CircularProgress size={16} />
                <Typography variant="body2">Loading stations...</Typography>
              </Box>
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
                    label={`💰 $${currentConditions.pricing?.ladwp?.rate?.toFixed(3)}`}
                    variant="outlined"
                  />
                  <Chip
                    size="small"
                    label={`🌡️ ${currentConditions.weather?.temperature?.toFixed(1)}°F`}
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Map */}
        <Grid item xs={12} lg={9}>
          <Paper sx={{ p: 2, height: 700 }}>
            <MapContainer
              center={[mapCenter.lat, mapCenter.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
              
              <MapController center={mapCenter} userLocation={userLocation} />
              
              {/* User Location */}
              {userLocation && (
                <Marker
                  position={[userLocation.lat, userLocation.lng]}
                  icon={createCustomIcon('user')}
                >
                  <Popup>
                    <Box sx={{ minWidth: 200 }}>
                      <Typography variant="h6" fontWeight="bold">
                        📍 Your Location
                      </Typography>
                      <Typography variant="body2">
                        Current position
                      </Typography>
                    </Box>
                  </Popup>
                </Marker>
              )}

              {/* Charging Stations */}
              {filteredStations.map((station) => (
                <Marker
                  key={station.id}
                  position={[station.latitude, station.longitude]}
                  icon={createCustomIcon(getStationIcon(station))}
                >
                  <Popup maxWidth={300}>
                    <Box sx={{ minWidth: 250 }}>
                      <Typography variant="h6" fontWeight="bold" mb={1}>
                        {station.name}
                      </Typography>
                      
                      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={station.is_public ? 'Public' : 'Private'}
                          variant="filled"
                          sx={{
                            backgroundColor: station.is_public ? '#4caf50' : '#ff9800',
                            color: '#ffffff',
                            fontWeight: 500,
                            '& .MuiChip-label': {
                              color: '#ffffff'
                            }
                          }}
                        />
                        {station.has_dc_fast && (
                          <Chip size="small" label="DC Fast" color="error" />
                        )}
                        <Chip 
                          size="small" 
                          label={`${station.total_ports} ports`} 
                          variant="filled"
                          sx={{
                            backgroundColor: '#1976d2',
                            color: '#ffffff',
                            fontWeight: 500,
                            '& .MuiChip-label': {
                              color: '#ffffff'
                            }
                          }}
                        />
                      </Box>

                      <Typography variant="body2" mb={1}>
                        <strong>Network:</strong> {station.network || 'Unknown'}
                      </Typography>
                      
                      <Typography variant="body2" mb={2}>
                        <strong>Distance:</strong> {station.distance_miles?.toFixed(1)} miles
                      </Typography>

                      {station.address && (
                        <Typography variant="body2" mb={2} color="text.secondary">
                          {station.address}
                        </Typography>
                      )}

                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          const origin = userLocation ? 
                            `${userLocation.lat},${userLocation.lng}` : 
                            `${mapCenter.lat},${mapCenter.lng}`;
                          const destination = `${station.latitude},${station.longitude}`;
                          
                          setDirectionsData({
                            origin,
                            destination,
                            stationName: station.name
                          });
                          setShowDirections(true);
                        }}
                        sx={{ 
                          background: 'linear-gradient(45deg, #667eea, #764ba2)',
                          color: 'white'
                        }}
                      >
                        Show Directions
                      </Button>
                    </Box>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Google Maps Directions Modal */}
      {showDirections && directionsData && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <Box
            sx={{
              width: '90%',
              height: '90%',
              maxWidth: '1200px',
              maxHeight: '800px',
              backgroundColor: 'white',
              borderRadius: 2,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6">
                Directions to {directionsData.stationName}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <GoogleMapView
                origin={directionsData.origin}
                destination={directionsData.destination}
                onClose={() => setShowDirections(false)}
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default StationMap;