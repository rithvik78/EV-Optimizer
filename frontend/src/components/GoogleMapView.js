import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  Close as CloseIcon,
  Directions as DirectionsIcon,
  Traffic as TrafficIcon,
  Speed as SpeedIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import ApiService from '../services/ApiService';

const GoogleMapView = ({ origin, destination, onClose }) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for invalid parameters and set error state instead of early return
  useEffect(() => {
    if (!origin || !destination) {
      setError('Invalid route parameters provided');
      setLoading(false);
    } else {
      // Clear error if parameters become valid
      if (error && error.includes('Invalid route parameters')) {
        setError(null);
        setLoading(true);
      }
    }
  }, [origin, destination, error]);

  useEffect(() => {
    // Don't load map if parameters are invalid
    if (!origin || !destination) {
      return;
    }
    const loadMap = async () => {
      try {
        // Add delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!window.google) {
          await loadGoogleMapsScript();
        }
        
        // Wait for Google Maps to be fully loaded
        await waitForGoogleMaps();
        
        if (mapRef.current) {
          await initializeMap();
        }
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        let errorMessage = 'Google Maps is temporarily unavailable. Please try again later.';
        
        if (error.message.includes('API key')) {
          errorMessage = 'Google Maps API configuration issue. Please contact support.';
        } else if (error.message.includes('billing')) {
          errorMessage = 'Google Maps service temporarily unavailable due to billing restrictions.';
        } else if (error.message.includes('load')) {
          errorMessage = 'Unable to load Google Maps. Please check your internet connection.';
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };
    
    loadMap();
  }, []);

  const waitForGoogleMaps = () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkGoogleMaps = () => {
        attempts++;
        
        if (window.google && 
            window.google.maps && 
            window.google.maps.Map && 
            window.google.maps.DirectionsService &&
            window.google.maps.DirectionsRenderer) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Google Maps failed to load completely'));
        } else {
          setTimeout(checkGoogleMaps, 100);
        }
      };
      
      checkGoogleMaps();
    });
  };

  useEffect(() => {
    if (map && directionsService && origin && destination) {
      calculateRoute();
    }
  }, [map, directionsService, origin, destination]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Clean up any listeners or resources
      if (map) {
        try {
          // Clear any listeners
          window.google?.maps?.event?.clearInstanceListeners?.(map);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [map]);

  const loadGoogleMapsScript = () => {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        if (window.google) {
          resolve();
        } else {
          // Script exists but not loaded, wait for it
          existingScript.addEventListener('load', resolve);
          existingScript.addEventListener('error', () => reject(new Error('Existing Google Maps script failed')));
        }
        return;
      }
      
      if (window.google) {
        resolve();
        return;
      }
      
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
        reject(new Error('Google Maps API key not configured'));
        return;
      }
      
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=3.51`;
      script.async = true;
      script.defer = true;
      script.id = 'google-maps-script';
      
      script.onload = () => {
        setTimeout(resolve, 100); // Small delay to ensure all objects are available
      };
      
      script.onerror = () => {
        document.head.removeChild(script);
        reject(new Error('Failed to load Google Maps script - check API key and billing'));
      };
      
      document.head.appendChild(script);
    });
  };

  const initializeMap = () => {
    return new Promise((resolve, reject) => {
      if (!mapRef.current) {
        reject(new Error('Map container not found'));
        return;
      }
      
      // Wait for container to have dimensions
      const checkDimensions = () => {
        if (mapRef.current.offsetWidth === 0) {
          setTimeout(checkDimensions, 100);
          return;
        }
        
        try {
          // Additional safety checks
          if (!window.google || !window.google.maps || !window.google.maps.Map) {
            reject(new Error('Google Maps API not properly loaded'));
            return;
          }
          
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            zoom: 12,
            center: { lat: 34.0522, lng: -118.2437 }, // LA center
            styles: [
              {
                featureType: "all",
                elementType: "geometry.fill",
                stylers: [{ color: "#242f3e" }]
              },
              {
                featureType: "all",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#242f3e" }]
              },
              {
                featureType: "all",
                elementType: "labels.text.fill",
                stylers: [{ color: "#746855" }]
              },
              {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }]
              }
            ],
            mapTypeControl: true,
            zoomControl: true,
            streetViewControl: true,
            fullscreenControl: true,
          });

          // Check for required services
          if (!window.google.maps.DirectionsService || !window.google.maps.DirectionsRenderer) {
            reject(new Error('Google Maps DirectionsService not available'));
            return;
          }
          
          const directionsServiceInstance = new window.google.maps.DirectionsService();
          const directionsRendererInstance = new window.google.maps.DirectionsRenderer({
            draggable: true,
            suppressMarkers: false
          });

          directionsRendererInstance.setMap(mapInstance);

          // Add traffic layer for live traffic (optional - don't fail if not available)
          try {
            if (window.google.maps.TrafficLayer) {
              const trafficLayer = new window.google.maps.TrafficLayer();
              trafficLayer.setMap(mapInstance);
            }
          } catch (trafficError) {
            console.warn('Traffic layer not available:', trafficError);
          }

          setMap(mapInstance);
          setDirectionsService(directionsServiceInstance);
          setDirectionsRenderer(directionsRendererInstance);
          setLoading(false);

          // Listen for route changes
          directionsRendererInstance.addListener('directions_changed', () => {
            displayRouteInfo(directionsRendererInstance.getDirections());
          });

          resolve();
        } catch (error) {
          console.error('Map initialization error:', error);
          reject(error);
        }
      };
      
      checkDimensions();
    });
  };

  const calculateRoute = async () => {
    if (!directionsService || !origin || !destination) return;

    setLoading(true);
    setError(null);

    try {
      // First get route from our backend API for traffic comparison
      const backendRoute = await ApiService.getDirections(origin, destination);
      
      // Then display route on map
      const request = {
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: window.google.maps.TrafficModel.BEST_GUESS
        },
        avoidHighways: false,
        avoidTolls: false
      };

      directionsService.route(request, (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
          
          // Combine frontend and backend data
          const route = result.routes[0];
          const leg = route.legs[0];
          
          const combinedRouteInfo = {
            frontend: {
              distance: leg.distance.text,
              duration: leg.duration.text,
              duration_in_traffic: leg.duration_in_traffic?.text,
              start_address: leg.start_address,
              end_address: leg.end_address
            },
            backend: backendRoute.status === 'OK' ? {
              distance: backendRoute.distance,
              duration: backendRoute.duration,
              duration_in_traffic: backendRoute.duration_in_traffic,
              traffic_delay: backendRoute.traffic_delay_minutes
            } : null
          };
          
          setRouteInfo(combinedRouteInfo);
        } else {
          setError('Could not calculate route: ' + status);
        }
        setLoading(false);
      });

    } catch (error) {
      setError('Route calculation failed: ' + error.message);
      setLoading(false);
    }
  };

  const displayRouteInfo = (directions) => {
    const route = directions.routes[0];
    const leg = route.legs[0];
    
    setRouteInfo(prev => ({
      ...prev,
      frontend: {
        distance: leg.distance.text,
        duration: leg.duration.text,
        duration_in_traffic: leg.duration_in_traffic?.text,
        start_address: leg.start_address,
        end_address: leg.end_address
      }
    }));
  };

  const getTrafficDelayInfo = () => {
    if (!routeInfo?.frontend?.duration_in_traffic || !routeInfo?.frontend?.duration) {
      return null;
    }

    // Parse duration strings to calculate delay
    const parseTime = (timeStr) => {
      const hours = (timeStr.match(/(\d+)\s*hour/) || [0, 0])[1];
      const mins = (timeStr.match(/(\d+)\s*min/) || [0, 0])[1];
      return parseInt(hours) * 60 + parseInt(mins);
    };

    const normalTime = parseTime(routeInfo.frontend.duration);
    const trafficTime = parseTime(routeInfo.frontend.duration_in_traffic);
    const delay = trafficTime - normalTime;

    if (delay <= 0) return null;

    return {
      delay: delay,
      color: delay < 5 ? '#4caf50' : delay < 15 ? '#ff9800' : '#f44336'
    };
  };

  if (error) {
    const isInvalidParams = error.includes('Invalid route parameters');
    
    return (
      <Paper sx={{ p: 3, textAlign: 'center', height: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Alert severity={isInvalidParams ? "warning" : "error"} sx={{ mb: 2 }}>
          <Typography variant="h6" mb={1}>
            {isInvalidParams ? "Invalid Parameters" : "Google Maps Unavailable"}
          </Typography>
          {error}
        </Alert>
        
        {!isInvalidParams && (
          <>
            <Typography variant="body2" color="text.secondary" mb={3}>
              You can still get directions using these alternatives:
            </Typography>
            
            <Box display="flex" gap={2} justifyContent="center" mb={3}>
              <Button
                variant="contained"
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin || '')}&destination=${encodeURIComponent(destination || '')}`;
                  window.open(url, '_blank');
                }}
                sx={{ background: 'linear-gradient(45deg, #4285f4, #34a853)' }}
              >
                Open in Google Maps
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => {
                  const url = `https://maps.apple.com/?saddr=${encodeURIComponent(origin || '')}&daddr=${encodeURIComponent(destination || '')}`;
                  window.open(url, '_blank');
                }}
              >
                Open in Apple Maps
              </Button>
            </Box>
          </>
        )}
        
        <Button variant="text" onClick={onClose} color="primary">
          Close
        </Button>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box display="flex" alignItems="center">
          <DirectionsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Live Route with Traffic
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Paper>

      {/* Route Info */}
      {routeInfo && (
        <Paper sx={{ p: 2, mb: 1 }}>
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <Chip
              icon={<SpeedIcon />}
              label={routeInfo.frontend.distance}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<AccessTimeIcon />}
              label={routeInfo.frontend.duration}
              color="secondary"
              variant="outlined"
            />
            {routeInfo.frontend.duration_in_traffic && (
              <Chip
                icon={<TrafficIcon />}
                label={`${routeInfo.frontend.duration_in_traffic} (with traffic)`}
                color="warning"
                variant="outlined"
              />
            )}
            {(() => {
              const trafficInfo = getTrafficDelayInfo();
              return trafficInfo ? (
                <Chip
                  label={`+${trafficInfo.delay} min delay`}
                  sx={{ backgroundColor: trafficInfo.color, color: 'white' }}
                  size="small"
                />
              ) : null;
            })()}
          </Box>
          
          {routeInfo.backend && (
            <Box mt={1}>
              <Typography variant="caption" color="text.secondary">
                Backend verification: {routeInfo.backend.distance} • {routeInfo.backend.duration}
                {routeInfo.backend.traffic_delay > 0 && ` • +${routeInfo.backend.traffic_delay} min traffic delay`}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Map Container */}
      <Paper sx={{ flexGrow: 1, position: 'relative' }}>
        {loading && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.8)',
              zIndex: 1000
            }}
          >
            <Box textAlign="center">
              <CircularProgress size={60} />
              <Typography variant="body2" mt={2}>
                Loading route with live traffic...
              </Typography>
            </Box>
          </Box>
        )}
        <div 
          ref={mapRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            minHeight: '400px'
          }} 
        />
      </Paper>

      {/* Route Addresses */}
      {routeInfo?.frontend && (
        <Paper sx={{ p: 2, mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>From:</strong> {routeInfo.frontend.start_address}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            <strong>To:</strong> {routeInfo.frontend.end_address}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default GoogleMapView;